from fastapi import APIRouter, HTTPException, Query, Request
from app.models.schemas import LyricsRequest, LyricsResponse, Lyrics
from app.services.lyrics_service import LyricsService
from app.services.romanization_service import RomanizationService
from app.services.spotify_service import SpotifyService

router = APIRouter()
lyrics_service = LyricsService()
romanization_service = RomanizationService()
spotify_service = SpotifyService()


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
async def get_lyrics_by_song_id(song_id: str, request: Request):
    """
    Get lyrics for a song by Spotify ID.
    Checks cache first, then fetches from Spotify + LRCLIB.
    """
    try:
        # Check cache first
        cached = await lyrics_service.get_cached_lyrics(song_id)
        if cached:
            return cached

        # Extract Bearer token to fetch track info from Spotify
        access_token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header[7:]

        if not access_token:
            raise HTTPException(status_code=401, detail="Access token required to fetch lyrics")

        # Get track details from Spotify
        track = await spotify_service.get_track(song_id, access_token)
        if not track:
            raise HTTPException(status_code=404, detail="Track not found on Spotify")

        # Fetch lyrics from LRCLIB
        lyrics_data = await lyrics_service.fetch_lyrics(
            song_name=track.name,
            artist_name=track.artist,
            album_name=track.album,
            duration=track.duration_ms // 1000 if track.duration_ms else None,
        )

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found")

        # Override song_id to be the Spotify ID
        lyrics_data.song_id = song_id

        # Romanize if needed
        romanized_lyrics = None
        if lyrics_data.language in ["chinese", "japanese", "korean"]:
            romanized_lyrics = await romanization_service.romanize_lyrics(lyrics_data)

        response = LyricsResponse(
            song_id=song_id,
            original_lyrics=lyrics_data,
            romanized_lyrics=romanized_lyrics,
            detected_language=lyrics_data.language,
        )

        # Cache for future requests
        await lyrics_service.cache_lyrics(song_id, response, song_name=track.name, artist_name=track.artist)

        return response

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
