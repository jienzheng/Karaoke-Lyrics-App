from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.schemas import QueueItem, QueueAddRequest, Song, Session, SessionCreate, SessionJoin
from app.services.queue_service import QueueService
from app.models.database import get_db

router = APIRouter()
queue_service = QueueService()


# ==================== Session Management ====================

@router.post("/session/create", response_model=Session)
async def create_session(session_data: SessionCreate, user_id: str):
    """
    Create a new karaoke session
    """
    try:
        session = await queue_service.create_session(
            name=session_data.name,
            host_id=user_id
        )
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.post("/session/join", response_model=Session)
async def join_session(join_data: SessionJoin, user_id: str):
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
async def add_to_queue(request: QueueAddRequest, user_id: str):
    """
    Add a song to the queue
    """
    try:
        queue_item = await queue_service.add_to_queue(
            session_id=request.session_id,
            song_id=request.song_id,
            user_id=user_id
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
async def remove_from_queue(queue_item_id: str, user_id: str):
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


@router.post("/{session_id}/next")
async def play_next(session_id: str, user_id: str):
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


@router.get("/{session_id}/current", response_model=QueueItem)
async def get_current_song(session_id: str):
    """
    Get the currently playing song
    """
    try:
        current_song = await queue_service.get_current_song(session_id)
        if not current_song:
            raise HTTPException(status_code=404, detail="No song currently playing")
        return current_song
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get current song: {str(e)}")
