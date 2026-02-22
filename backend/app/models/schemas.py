from pydantic import BaseModel, Field
from typing import Any, Optional, List, Dict
from datetime import datetime
from enum import Enum


# ==================== Enums ====================

class LanguageType(str, Enum):
    """Supported language types"""
    CHINESE = "chinese"
    JAPANESE = "japanese"
    KOREAN = "korean"
    ENGLISH = "english"
    OTHER = "other"


class LyricsDisplayMode(str, Enum):
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
    refresh_token: Optional[str] = None
    expires_in: int
    token_type: str = "Bearer"


class User(BaseModel):
    """User model"""
    id: str
    spotify_id: str
    display_name: str
    email: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==================== Songs & Lyrics ====================

class Song(BaseModel):
    """Song model from Spotify"""
    id: str
    name: str
    artist: str
    album: Optional[str] = None
    duration_ms: int
    spotify_uri: str
    image_url: Optional[str] = None


class LyricLine(BaseModel):
    """Single line of lyrics with timing"""
    start_time: float  # seconds
    end_time: Optional[float] = None
    text: str
    romanized_text: Optional[str] = None
    words: Optional[List[Dict[str, Any]]] = None  # For word-level timing


class Lyrics(BaseModel):
    """Lyrics model with metadata"""
    song_id: str
    language: LanguageType
    lines: List[LyricLine]
    synced: bool = False  # Whether lyrics have time sync
    source: str = "lrclib"  # Source of lyrics


class LyricsRequest(BaseModel):
    """Request to fetch lyrics"""
    song_name: str
    artist_name: str
    album_name: Optional[str] = None
    duration: Optional[int] = None


class LyricsResponse(BaseModel):
    """Response containing lyrics"""
    song_id: str
    original_lyrics: Lyrics
    romanized_lyrics: Optional[Lyrics] = None
    detected_language: LanguageType


# ==================== Queue & Session ====================

class QueueItem(BaseModel):
    """Item in the queue"""
    id: str
    song: Song
    added_by: str  # User ID
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
    host_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    current_song: Optional[Song] = None
    lyrics_display_mode: LyricsDisplayMode = LyricsDisplayMode.BOTH


class SessionCreate(BaseModel):
    """Request to create a session"""
    name: str


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
    current_song: Optional[Song] = None
    volume: int = 100  # 0-100


class PlaybackControl(BaseModel):
    """Playback control commands"""
    action: str  # play, pause, next, previous, seek
    position_ms: Optional[int] = None
    volume: Optional[int] = None
