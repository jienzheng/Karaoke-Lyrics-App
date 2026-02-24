from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from typing import List
from app.models.schemas import QueueItem, QueueAddRequest, Song, Session, SessionCreate, SessionJoin, PlaybackStateUpdate, PlaybackStateResponse
from app.services.queue_service import QueueService
from app.models.database import get_db

router = APIRouter()
queue_service = QueueService()


# ==================== Session Management ====================

@router.post("/session/create", response_model=Session)
async def create_session(session_data: SessionCreate, user_id: str = Query(...)):
    """
    Create a new karaoke session
    """
    try:
        session = await queue_service.create_session(
            name=session_data.name,
            host_id=user_id,
            refresh_token=session_data.refresh_token,
        )
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.post("/session/join", response_model=Session)
async def join_session(join_data: SessionJoin, user_id: str = Query(...)):
    """
    Join an existing session
    """
    try:
        session = await queue_service.join_session(
            session_id=join_data.session_id,
            user_id=user_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to join session: {str(e)}")


@router.get("/session/{session_id}", response_model=Session)
async def get_session(session_id: str):
    """
    Get session details
    """
    try:
        session = await queue_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")


# ==================== Queue Management ====================

@router.post("/add", response_model=QueueItem)
async def add_to_queue(request: Request, request_body: QueueAddRequest, user_id: str = Query(...)):
    """
    Add a song to the queue
    """
    try:
        # Extract Bearer token from Authorization header
        access_token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header[7:]

        # Guest fallback: use host's Spotify token
        if not access_token:
            try:
                access_token = queue_service.get_host_access_token(request_body.session_id)
            except Exception:
                pass

        queue_item = await queue_service.add_to_queue(
            session_id=request_body.session_id,
            song_id=request_body.song_id,
            user_id=user_id,
            access_token=access_token
        )
        return queue_item
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add song to queue: {str(e)}")


@router.get("/{session_id}/list", response_model=List[QueueItem])
async def get_queue(session_id: str):
    """
    Get all songs in the queue for a session
    """
    try:
        queue_items = await queue_service.get_queue(session_id)
        return queue_items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue: {str(e)}")


@router.delete("/{queue_item_id}")
async def remove_from_queue(queue_item_id: str, user_id: str = Query(...)):
    """
    Remove a song from the queue
    """
    try:
        success = await queue_service.remove_from_queue(queue_item_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Queue item not found or unauthorized")
        return {"message": "Song removed from queue"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove song: {str(e)}")


@router.post("/{session_id}/reorder")
async def reorder_queue(session_id: str, queue_item_id: str = Query(...), new_position: int = Query(...)):
    """
    Move a queue item to a new position
    """
    try:
        success = await queue_service.reorder_queue_item(session_id, queue_item_id, new_position)
        if not success:
            raise HTTPException(status_code=404, detail="Queue item not found")
        return {"message": "Queue reordered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reorder queue: {str(e)}")


class ReorderBatchRequest(BaseModel):
    item_ids: List[str]


@router.post("/{session_id}/reorder-batch")
async def reorder_queue_batch(session_id: str, body: ReorderBatchRequest):
    """
    Reorder all queue items at once. Accepts a list of item IDs in desired order.
    """
    try:
        success = await queue_service.reorder_queue_batch(session_id, body.item_ids)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to reorder queue")
        return {"message": "Queue reordered"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reorder queue: {str(e)}")


@router.post("/{session_id}/next")
async def play_next(session_id: str, user_id: str = Query(...)):
    """
    Move to the next song in the queue
    """
    try:
        next_song = await queue_service.play_next(session_id, user_id)
        if not next_song:
            return {"message": "No more songs in queue"}
        return {"current_song": next_song}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to play next song: {str(e)}")


@router.get("/{session_id}/current")
async def get_current_song(session_id: str):
    """
    Get the currently playing song. Returns null if nothing is playing.
    """
    try:
        current_song = await queue_service.get_current_song(session_id)
        if not current_song:
            return None
        return current_song
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get current song: {str(e)}")


# ==================== Playback State Sync ====================

@router.put("/{session_id}/playback-state")
async def update_playback_state(session_id: str, body: PlaybackStateUpdate):
    """Host reports current playback position so guests can sync lyrics."""
    try:
        queue_service.update_playback_state(
            session_id=session_id,
            is_playing=body.is_playing,
            position_ms=body.position_ms,
            song_id=body.song_id,
            countdown=body.countdown,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update playback state: {str(e)}")


@router.get("/{session_id}/playback-state")
async def get_playback_state(session_id: str):
    """Guests poll for the host's current playback position."""
    try:
        state = queue_service.get_playback_state(session_id)
        if not state:
            return None
        return PlaybackStateResponse(
            is_playing=state["is_playing"],
            position_ms=state["position_ms"],
            song_id=state.get("song_id"),
            countdown=state.get("countdown"),
            updated_at=state["updated_at"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playback state: {str(e)}")
