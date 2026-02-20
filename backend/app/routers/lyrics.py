from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import LyricsRequest, LyricsResponse, Lyrics
from app.services.lyrics_service import LyricsService
from app.services.romanization_service import RomanizationService

router = APIRouter()
lyrics_service = LyricsService()
romanization_service = RomanizationService()


@router.post("/fetch", response_model=LyricsResponse)
async def fetch_lyrics(request: LyricsRequest):
    """
    Fetch lyrics for a song and return both original and romanized versions
    """
    try:
        # Fetch lyrics from LRCLIB
        lyrics_data = await lyrics_service.fetch_lyrics(
            song_name=request.song_name,
            artist_name=request.artist_name,
            album_name=request.album_name,
            duration=request.duration
        )

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found")

        # Detect language and romanize if needed
        romanized_lyrics = None
        if lyrics_data.language in ["chinese", "japanese", "korean"]:
            romanized_lyrics = await romanization_service.romanize_lyrics(lyrics_data)

        return LyricsResponse(
            song_id=lyrics_data.song_id,
            original_lyrics=lyrics_data,
            romanized_lyrics=romanized_lyrics,
            detected_language=lyrics_data.language
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch lyrics: {str(e)}")


@router.get("/song/{song_id}", response_model=LyricsResponse)
async def get_lyrics_by_song_id(song_id: str):
    """
    Get cached lyrics for a song by Spotify ID
    """
    try:
        # Check cache first (to be implemented with database)
        lyrics_data = await lyrics_service.get_cached_lyrics(song_id)

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found in cache")

        return lyrics_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lyrics: {str(e)}")


@router.get("/search")
async def search_lyrics(
    song_name: str = Query(...),
    artist_name: str = Query(...)
):
    """
    Search for lyrics without fetching
    """
    try:
        results = await lyrics_service.search_lyrics(song_name, artist_name)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
