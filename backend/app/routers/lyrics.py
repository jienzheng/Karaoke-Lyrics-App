from fastapi import APIRouter, HTTPException, Query, Request

from app.models.schemas import LanguageType, LyricsRequest, LyricsResponse
from app.services.lyrics_service import LyricsService
from app.services.queue_service import QueueService
from app.services.romanization_service import RomanizationService
from app.services.spotify_service import SpotifyService

router = APIRouter()
lyrics_service = LyricsService()
romanization_service = RomanizationService()
spotify_service = SpotifyService()
queue_service = QueueService()


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
            duration=request.duration,
        )

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found")

        # Detect language and romanize if needed
        romanized_lyrics = None
        if lyrics_data.language in (
            LanguageType.CHINESE,
            LanguageType.JAPANESE,
            LanguageType.KOREAN,
        ):
            romanized_lyrics = await romanization_service.romanize_lyrics(lyrics_data)

        return LyricsResponse(
            song_id=lyrics_data.song_id,
            original_lyrics=lyrics_data,
            romanized_lyrics=romanized_lyrics,
            detected_language=lyrics_data.language,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch lyrics: {e!s}")


@router.get("/song/{song_id}", response_model=LyricsResponse)
async def get_lyrics_by_song_id(
    song_id: str,
    request: Request,
    session_id: str | None = Query(None, description="Session ID (fallback token)"),
    song_name: str | None = Query(None, description="Song name (avoids Spotify lookup)"),
    artist_name: str | None = Query(None, description="Artist name (avoids Spotify lookup)"),
    album_name: str | None = Query(None, description="Album name"),
    duration: int | None = Query(None, description="Duration in ms"),
):
    """
    Get lyrics for a song by Spotify ID.
    Checks cache first, then fetches from LRCLIB.
    If song_name/artist_name are provided, skips the Spotify API call entirely.
    """
    try:
        # Check cache first
        cached = await lyrics_service.get_cached_lyrics(song_id)
        if cached:
            return cached

        # Resolve song metadata — prefer query params (no token needed)
        track_name = song_name
        track_artist = artist_name
        track_album = album_name
        track_duration = duration // 1000 if duration else None

        # Fall back to Spotify API if metadata not provided
        if not track_name or not track_artist:
            access_token = None
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                access_token = auth_header[7:]

            track = None
            if access_token:
                try:
                    track = await spotify_service.get_track(song_id, access_token)
                except Exception:
                    pass

            if not track and session_id:
                try:
                    fresh_token = queue_service.get_host_access_token(session_id)
                    track = await spotify_service.get_track(song_id, fresh_token)
                except Exception:
                    pass

            if not track:
                raise HTTPException(
                    status_code=404,
                    detail="Could not resolve song metadata. Pass song_name and artist_name params or a valid token.",
                )

            track_name = track.name
            track_artist = track.artist
            track_album = track.album
            track_duration = track.duration_ms // 1000 if track.duration_ms else None

        # Fetch lyrics from LRCLIB
        lyrics_data = await lyrics_service.fetch_lyrics(
            song_name=track_name,
            artist_name=track_artist,
            album_name=track_album,
            duration=track_duration,
        )

        if not lyrics_data:
            raise HTTPException(status_code=404, detail="Lyrics not found")

        # Override song_id to be the Spotify ID
        lyrics_data.song_id = song_id

        # Romanize if needed
        romanized_lyrics = None
        if lyrics_data.language in (
            LanguageType.CHINESE,
            LanguageType.JAPANESE,
            LanguageType.KOREAN,
        ):
            romanized_lyrics = await romanization_service.romanize_lyrics(lyrics_data)

        response = LyricsResponse(
            song_id=song_id,
            original_lyrics=lyrics_data,
            romanized_lyrics=romanized_lyrics,
            detected_language=lyrics_data.language,
        )

        # Cache for future requests
        await lyrics_service.cache_lyrics(
            song_id, response, song_name=track_name, artist_name=track_artist
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lyrics: {e!s}")


@router.get("/search")
async def search_lyrics(song_name: str = Query(...), artist_name: str = Query(...)):
    """
    Search for lyrics without fetching
    """
    try:
        results = await lyrics_service.search_lyrics(song_name, artist_name)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e!s}")
