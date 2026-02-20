from fastapi import APIRouter, HTTPException, Query
from typing import List
import httpx
from app.models.schemas import Song
from app.services.spotify_service import SpotifyService

router = APIRouter()
spotify_service = SpotifyService()


@router.get("/search", response_model=List[Song])
async def search_songs(
    q: str = Query(..., description="Search query"),
    access_token: str = Query(..., description="Spotify access token"),
    limit: int = Query(20, ge=1, le=50, description="Number of results")
):
    """
    Search for songs on Spotify
    """
    try:
        songs = await spotify_service.search_songs(
            query=q,
            access_token=access_token,
            limit=limit
        )
        return songs
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid or expired access token")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/track/{track_id}", response_model=Song)
async def get_track(
    track_id: str,
    access_token: str = Query(..., description="Spotify access token")
):
    """
    Get track details by ID
    """
    try:
        song = await spotify_service.get_track(track_id, access_token)
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
