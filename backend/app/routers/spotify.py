from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional
import httpx
from app.models.schemas import Song
from app.services.spotify_service import SpotifyService
from app.services.queue_service import QueueService

router = APIRouter()
spotify_service = SpotifyService()
queue_service = QueueService()


def _extract_token(request: Request, access_token: Optional[str] = None, session_id: Optional[str] = None) -> str:
    """Extract access token from Authorization header, query param, or host token via session_id."""
    if access_token:
        return access_token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    # Guest fallback: use host's token via session_id
    if session_id:
        try:
            return queue_service.get_host_access_token(session_id)
        except Exception:
            raise HTTPException(status_code=401, detail="Could not get host access token for guest")
    raise HTTPException(status_code=401, detail="Access token required")


@router.get("/search", response_model=List[Song])
async def search_songs(
    request: Request,
    q: str = Query(..., description="Search query"),
    access_token: Optional[str] = Query(None, description="Spotify access token"),
    session_id: Optional[str] = Query(None, description="Session ID (for guest users)"),
    limit: int = Query(10, ge=1, le=10, description="Number of results (max 10 for Spotify Dev Mode)")
):
    """
    Search for songs on Spotify
    """
    try:
        token = _extract_token(request, access_token, session_id)
        songs = await spotify_service.search_songs(
            query=q,
            access_token=token,
            limit=limit
        )
        return songs
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired access token")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/track/{track_id}", response_model=Song)
async def get_track(
    request: Request,
    track_id: str,
    access_token: Optional[str] = Query(None, description="Spotify access token")
):
    """
    Get track details by ID
    """
    try:
        token = _extract_token(request, access_token)
        song = await spotify_service.get_track(track_id, token)
        if not song:
            raise HTTPException(status_code=404, detail="Track not found")
        return song
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired access token")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get track: {str(e)}")
