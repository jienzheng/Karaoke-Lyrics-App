from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# ==================== Enums ====================


class LanguageType(StrEnum):
    """Supported language types"""

    CHINESE = "chinese"
    JAPANESE = "japanese"
    KOREAN = "korean"
    ENGLISH = "english"
    OTHER = "other"


class LyricsDisplayMode(StrEnum):
    """Lyrics display mode options"""

    ORIGINAL = "original"
    ROMANIZED = "romanized"
    BOTH = "both"


# ==================== Authentication ====================


class SpotifyAuthURL(BaseModel):
    """Spotify authorization URL response"""

    auth_url: str


class SpotifyToken(BaseModel):
    """Spotify access token"""

    access_token: str
    refresh_token: str | None = None
    expires_in: int
    token_type: str = "Bearer"


class User(BaseModel):
    """User model"""

    id: str
    spotify_id: str
    display_name: str
    email: str | None = None
    image_url: str | None = None
    is_guest: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GuestJoinRequest(BaseModel):
    """Request to join a session as a guest"""

    display_name: str
    session_code: str


class GuestJoinResponse(BaseModel):
    """Response after guest joins a session"""

    user_id: str
    session_id: str
    is_guest: bool


# ==================== Songs & Lyrics ====================


class Song(BaseModel):
    """Song model from Spotify"""

    id: str
    name: str
    artist: str
    album: str | None = None
    duration_ms: int
    spotify_uri: str
    image_url: str | None = None


class LyricLine(BaseModel):
    """Single line of lyrics with timing"""

    start_time: float  # seconds
    end_time: float | None = None
    time_ms: int | None = None  # milliseconds (for frontend)
    text: str
    romanized_text: str | None = None
    words: list[dict[str, Any]] | None = None  # For word-level timing


class Lyrics(BaseModel):
    """Lyrics model with metadata"""

    song_id: str
    language: LanguageType
    lines: list[LyricLine]
    synced: bool = False  # Whether lyrics have time sync
    source: str = "lrclib"  # Source of lyrics


class LyricsRequest(BaseModel):
    """Request to fetch lyrics"""

    song_name: str
    artist_name: str
    album_name: str | None = None
    duration: int | None = None


class LyricsResponse(BaseModel):
    """Response containing lyrics"""

    song_id: str
    original_lyrics: Lyrics
    romanized_lyrics: Lyrics | None = None
    detected_language: LanguageType


# ==================== Queue & Session ====================


class QueueItem(BaseModel):
    """Item in the queue"""

    id: str
    song: Song
    added_by: str  # User ID
    added_by_name: str | None = None
    added_at: datetime = Field(default_factory=datetime.utcnow)
    position: int


class QueueAddRequest(BaseModel):
    """Request to add song to queue"""

    song_id: str
    session_id: str


class Session(BaseModel):
    """Karaoke session"""

    id: str
    name: str
    code: str = ""
    host_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    current_song: Song | None = None
    lyrics_display_mode: LyricsDisplayMode = LyricsDisplayMode.BOTH


class SessionCreate(BaseModel):
    """Request to create a session"""

    name: str
    refresh_token: str | None = None


class SessionJoin(BaseModel):
    """Request to join a session"""

    session_id: str


# ==================== Romanization ====================


class RomanizationRequest(BaseModel):
    """Request to romanize text"""

    text: str
    language: LanguageType


class RomanizationResponse(BaseModel):
    """Romanized text response"""

    original_text: str
    romanized_text: str
    language: LanguageType


# ==================== Playback ====================


class PlaybackState(BaseModel):
    """Current playback state"""

    is_playing: bool
    position_ms: int
    current_song: Song | None = None
    volume: int = 100  # 0-100


class PlaybackControl(BaseModel):
    """Playback control commands"""

    action: str  # play, pause, next, previous, seek
    position_ms: int | None = None
    volume: int | None = None


class PlaybackStateUpdate(BaseModel):
    """Host reports current playback position for guest sync"""

    is_playing: bool
    position_ms: int
    song_id: str | None = None
    countdown: int | None = None


class PlaybackStateResponse(BaseModel):
    """Playback state returned to guests for lyrics sync"""

    is_playing: bool
    position_ms: int
    song_id: str | None = None
    countdown: int | None = None
    updated_at: datetime
