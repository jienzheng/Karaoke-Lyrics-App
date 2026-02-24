"""
Queue service - manages karaoke sessions and song queues
"""

import asyncio
import logging
import random
import string
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.schemas import (
    LanguageType,
    LyricsDisplayMode,
    LyricsResponse,
    QueueItem,
    Session,
    Song,
)
from app.services.lyrics_service import LyricsService
from app.services.romanization_service import RomanizationService
from app.services.spotify_auth import SpotifyAuthService
from app.services.spotify_service import SpotifyService

logger = logging.getLogger(__name__)


class QueueService:
    """Service for managing sessions and queues"""

    def __init__(self):
        self.spotify_service = SpotifyService()
        self.spotify_auth = SpotifyAuthService()
        self.lyrics_service = LyricsService()
        self.romanization_service = RomanizationService()

    @staticmethod
    def _build_song(row: dict) -> Song:
        """Construct a Song from a queue_items DB row."""
        return Song(
            id=row["song_id"],
            name=row["song_name"],
            artist=row["artist_name"],
            album=row["album_name"],
            duration_ms=row["duration_ms"],
            spotify_uri=row["spotify_uri"],
            image_url=row["image_url"],
        )

    @staticmethod
    def _generate_code(length: int = 6) -> str:
        """Generate a random alphanumeric session code"""
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

    @staticmethod
    def _resolve_display_names(user_ids: list[str]) -> dict[str, str]:
        """Batch-resolve user UUIDs to display names."""
        if not user_ids:
            return {}
        db = get_db()
        result = (
            db.table("users").select("id, display_name").in_("id", list(set(user_ids))).execute()
        )
        return {row["id"]: row["display_name"] for row in (result.data or [])}

    @staticmethod
    def _update_last_activity(session_id: str) -> None:
        """Update last_activity_at timestamp on a session."""
        db = get_db()
        db.table("sessions").update({"last_activity_at": datetime.utcnow().isoformat()}).eq(
            "id", session_id
        ).execute()

    def get_host_access_token(self, session_id: str) -> str:
        """Get a fresh Spotify access token for the session host."""
        db = get_db()
        result = db.table("sessions").select("host_refresh_token").eq("id", session_id).execute()
        if not result.data or not result.data[0].get("host_refresh_token"):
            raise Exception("No host refresh token found for session")
        refresh_token = result.data[0]["host_refresh_token"]
        token_data = self.spotify_auth.refresh_access_token(refresh_token)
        return token_data["access_token"]

    async def create_session(
        self, name: str, host_id: str, refresh_token: str | None = None
    ) -> Session:
        """
        Create a new karaoke session
        """
        db = get_db()
        code = self._generate_code()

        insert_data = {
            "name": name,
            "host_id": host_id,
            "code": code,
            "is_active": True,
            "lyrics_display_mode": "both",
        }
        if refresh_token:
            insert_data["host_refresh_token"] = refresh_token

        # Insert session
        result = db.table("sessions").insert(insert_data).execute()

        if not result.data:
            raise Exception("Failed to create session")

        session_data = result.data[0]

        # Add host as participant
        db.table("session_participants").insert(
            {"session_id": session_data["id"], "user_id": host_id}
        ).execute()

        return Session(
            id=session_data["id"],
            name=session_data["name"],
            code=session_data.get("code", ""),
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"]),
        )

    async def join_session(self, session_id: str, user_id: str) -> Session | None:
        """
        Join an existing session. session_id can be a UUID or a 6-char code.
        """
        db = get_db()

        # Try lookup by code first (short codes), then fall back to UUID
        session_result = (
            db.table("sessions")
            .select("*")
            .eq("code", session_id.upper())
            .eq("is_active", True)
            .execute()
        )
        if not session_result.data:
            session_result = (
                db.table("sessions")
                .select("*")
                .eq("id", session_id)
                .eq("is_active", True)
                .execute()
            )

        if not session_result.data:
            return None

        session_data = session_result.data[0]

        # Add user to participants (ignore if already exists)
        try:
            db.table("session_participants").insert(
                {"session_id": session_data["id"], "user_id": user_id}
            ).execute()
        except Exception:
            # User already in session, that's fine
            pass

        return Session(
            id=session_data["id"],
            name=session_data["name"],
            code=session_data.get("code", ""),
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"]),
        )

    async def get_session(self, session_id: str) -> Session | None:
        """
        Get session details
        """
        db = get_db()

        result = db.table("sessions").select("*").eq("id", session_id).execute()

        if not result.data:
            return None

        session_data = result.data[0]

        return Session(
            id=session_data["id"],
            name=session_data["name"],
            code=session_data.get("code", ""),
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"]),
        )

    async def add_to_queue(
        self, session_id: str, song_id: str, user_id: str, access_token: str | None = None
    ) -> QueueItem:
        """
        Add song to queue
        """
        db = get_db()

        # Get song details from Spotify (if access_token provided)
        song = None
        if access_token:
            song = await self.spotify_service.get_track(song_id, access_token)

        if not song:
            raise Exception("Could not fetch song details")

        # Get current max position
        max_pos_result = (
            db.table("queue_items")
            .select("position")
            .eq("session_id", session_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        )

        next_position = 0 if not max_pos_result.data else max_pos_result.data[0]["position"] + 1

        # Insert queue item
        result = (
            db.table("queue_items")
            .insert(
                {
                    "session_id": session_id,
                    "song_id": song.id,
                    "song_name": song.name,
                    "artist_name": song.artist,
                    "album_name": song.album,
                    "duration_ms": song.duration_ms,
                    "spotify_uri": song.spotify_uri,
                    "image_url": song.image_url,
                    "added_by": user_id,
                    "position": next_position,
                }
            )
            .execute()
        )

        if not result.data:
            raise Exception("Failed to add song to queue")

        item_data = result.data[0]

        # Update session activity timestamp
        self._update_last_activity(session_id)

        # Pre-fetch lyrics in the background so they're cached when the song plays
        asyncio.create_task(self._prefetch_lyrics(song))  # noqa: RUF006

        names = self._resolve_display_names([user_id])

        return QueueItem(
            id=item_data["id"],
            song=song,
            added_by=item_data["added_by"],
            added_by_name=names.get(user_id),
            added_at=datetime.fromisoformat(item_data["created_at"]),
            position=item_data["position"],
        )

    async def _prefetch_lyrics(self, song: Song) -> None:
        """Pre-fetch and cache lyrics for a song in the background."""
        try:
            # Skip if already cached
            cached = await self.lyrics_service.get_cached_lyrics(song.id)
            if cached:
                logger.info("Pre-fetch: lyrics already cached for %s", song.name)
                return

            logger.info("Pre-fetching lyrics for %s - %s", song.name, song.artist)

            lyrics_data = await self.lyrics_service.fetch_lyrics(
                song_name=song.name,
                artist_name=song.artist,
                album_name=song.album,
                duration=song.duration_ms // 1000 if song.duration_ms else None,
            )

            if not lyrics_data:
                logger.info("Pre-fetch: no lyrics found for %s", song.name)
                return

            lyrics_data.song_id = song.id

            # Romanize if CJK
            romanized_lyrics = None
            if lyrics_data.language in (
                LanguageType.CHINESE,
                LanguageType.JAPANESE,
                LanguageType.KOREAN,
            ):
                romanized_lyrics = await self.romanization_service.romanize_lyrics(lyrics_data)

            response = LyricsResponse(
                song_id=song.id,
                original_lyrics=lyrics_data,
                romanized_lyrics=romanized_lyrics,
                detected_language=lyrics_data.language,
            )

            await self.lyrics_service.cache_lyrics(
                song.id, response, song_name=song.name, artist_name=song.artist
            )
            logger.info("Pre-fetch: lyrics cached for %s", song.name)

        except Exception as e:
            logger.warning("Pre-fetch lyrics failed for %s: %s", song.name, e)

    async def get_queue(self, session_id: str) -> list[QueueItem]:
        """
        Get all queue items for a session
        """
        db = get_db()

        result = (
            db.table("queue_items")
            .select("*")
            .eq("session_id", session_id)
            .order("position")
            .execute()
        )

        if not result.data:
            return []

        user_ids = [item["added_by"] for item in result.data]
        names = self._resolve_display_names(user_ids)

        queue_items = []
        for item_data in result.data:
            song = self._build_song(item_data)

            queue_item = QueueItem(
                id=item_data["id"],
                song=song,
                added_by=item_data["added_by"],
                added_by_name=names.get(item_data["added_by"]),
                added_at=datetime.fromisoformat(item_data["created_at"]),
                position=item_data["position"],
            )
            queue_items.append(queue_item)

        return queue_items

    async def remove_from_queue(self, queue_item_id: str, user_id: str) -> bool:
        """
        Remove item from queue
        """
        db = get_db()

        # Check if item exists and user has permission
        item_result = db.table("queue_items").select("*").eq("id", queue_item_id).execute()

        if not item_result.data:
            return False

        item = item_result.data[0]

        # Check if user is the one who added it or is the session host
        session_result = (
            db.table("sessions").select("host_id").eq("id", item["session_id"]).execute()
        )

        if session_result.data:
            session_host = session_result.data[0]["host_id"]
            if item["added_by"] != user_id and session_host != user_id:
                return False

        # Delete the item
        db.table("queue_items").delete().eq("id", queue_item_id).execute()

        # Update session activity timestamp
        self._update_last_activity(item["session_id"])

        return True

    async def play_next(self, session_id: str, user_id: str) -> QueueItem | None:
        """
        Move to next song in queue. Removes the current song and starts the next one.
        """
        db = get_db()

        # Get current playing song
        current_result = (
            db.table("queue_items")
            .select("*")
            .eq("session_id", session_id)
            .eq("is_playing", True)
            .execute()
        )

        # Delete the current song from the queue so we advance
        if current_result.data:
            db.table("queue_items").delete().eq("id", current_result.data[0]["id"]).execute()

        # Get next song (lowest position remaining)
        next_result = (
            db.table("queue_items")
            .select("*")
            .eq("session_id", session_id)
            .order("position")
            .limit(1)
            .execute()
        )

        if not next_result.data:
            return None

        next_item = next_result.data[0]

        # Mark as playing
        db.table("queue_items").update({"is_playing": True}).eq("id", next_item["id"]).execute()

        song = self._build_song(next_item)
        names = self._resolve_display_names([next_item["added_by"]])

        return QueueItem(
            id=next_item["id"],
            song=song,
            added_by=next_item["added_by"],
            added_by_name=names.get(next_item["added_by"]),
            added_at=datetime.fromisoformat(next_item["created_at"]),
            position=next_item["position"],
        )

    async def reorder_queue_item(
        self, session_id: str, queue_item_id: str, new_position: int
    ) -> bool:
        """
        Move a queue item to a new position by swapping with the item at that position.
        """
        db = get_db()

        # Get the item to move
        item_result = db.table("queue_items").select("*").eq("id", queue_item_id).execute()
        if not item_result.data:
            return False

        old_position = item_result.data[0]["position"]

        # Get the item currently at the target position
        target_result = (
            db.table("queue_items")
            .select("*")
            .eq("session_id", session_id)
            .eq("position", new_position)
            .execute()
        )

        if not target_result.data:
            # No item at target position, just move directly
            db.table("queue_items").update({"position": new_position}).eq(
                "id", queue_item_id
            ).execute()
        else:
            # Swap positions
            target_id = target_result.data[0]["id"]
            db.table("queue_items").update({"position": new_position}).eq(
                "id", queue_item_id
            ).execute()
            db.table("queue_items").update({"position": old_position}).eq("id", target_id).execute()

        return True

    async def get_current_song(self, session_id: str) -> QueueItem | None:
        """
        Get currently playing song
        """
        db = get_db()

        result = (
            db.table("queue_items")
            .select("*")
            .eq("session_id", session_id)
            .eq("is_playing", True)
            .execute()
        )

        if not result.data:
            return None

        item_data = result.data[0]

        song = self._build_song(item_data)
        names = self._resolve_display_names([item_data["added_by"]])

        return QueueItem(
            id=item_data["id"],
            song=song,
            added_by=item_data["added_by"],
            added_by_name=names.get(item_data["added_by"]),
            added_at=datetime.fromisoformat(item_data["created_at"]),
            position=item_data["position"],
        )

    async def reorder_queue_batch(self, session_id: str, item_ids: list[str]) -> bool:
        """
        Reorder queue items by assigning positions 0, 1, 2, ... to the given item IDs.
        """
        db = get_db()

        for position, item_id in enumerate(item_ids):
            db.table("queue_items").update({"position": position}).eq("id", item_id).eq(
                "session_id", session_id
            ).execute()

        return True

    def update_playback_state(
        self,
        session_id: str,
        is_playing: bool,
        position_ms: int,
        song_id: str | None = None,
        countdown: int | None = None,
    ) -> None:
        """Upsert playback position so guests can sync lyrics."""
        db = get_db()
        row = {
            "session_id": session_id,
            "is_playing": is_playing,
            "position_ms": position_ms,
            "song_id": song_id,
            "countdown": countdown,
            "updated_at": datetime.utcnow().isoformat(),
        }
        db.table("playback_state").upsert(row, on_conflict="session_id").execute()
        if is_playing:
            self._update_last_activity(session_id)

    @staticmethod
    def get_playback_state(session_id: str) -> dict | None:
        """Return the current playback state row for a session, or None."""
        db = get_db()
        result = db.table("playback_state").select("*").eq("session_id", session_id).execute()
        if not result.data:
            return None
        return result.data[0]

    @staticmethod
    async def cleanup_inactive_sessions() -> int:
        """
        Delete active sessions that have had no queue activity for 30+ minutes
        and currently have an empty queue. Returns the number of sessions deleted.
        """
        db = get_db()
        cutoff = (datetime.utcnow() - timedelta(minutes=5)).isoformat()

        # Find active sessions where last_activity_at is older than cutoff
        stale = (
            db.table("sessions")
            .select("id")
            .eq("is_active", True)
            .lt("last_activity_at", cutoff)
            .execute()
        )

        if not stale.data:
            return 0

        deleted = 0
        for session in stale.data:
            # Check if queue is empty
            queue_count = (
                db.table("queue_items")
                .select("id", count="exact")
                .eq("session_id", session["id"])
                .execute()
            )
            if queue_count.count == 0:
                db.table("sessions").delete().eq("id", session["id"]).execute()
                deleted += 1
                logger.info("Cleaned up inactive session %s", session["id"])

        return deleted
