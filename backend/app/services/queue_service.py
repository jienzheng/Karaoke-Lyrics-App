"""
Queue service - manages karaoke sessions and song queues
"""
from typing import Optional, List
from datetime import datetime
from app.models.schemas import Session, QueueItem, Song, LyricsDisplayMode
from app.models.database import get_db
from app.services.spotify_service import SpotifyService


class QueueService:
    """Service for managing sessions and queues"""

    def __init__(self):
        self.spotify_service = SpotifyService()

    async def create_session(self, name: str, host_id: str) -> Session:
        """
        Create a new karaoke session
        """
        db = get_db()

        # Insert session
        result = db.table("sessions").insert({
            "name": name,
            "host_id": host_id,
            "is_active": True,
            "lyrics_display_mode": "both"
        }).execute()

        if not result.data:
            raise Exception("Failed to create session")

        session_data = result.data[0]

        # Add host as participant
        db.table("session_participants").insert({
            "session_id": session_data["id"],
            "user_id": host_id
        }).execute()

        return Session(
            id=session_data["id"],
            name=session_data["name"],
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"])
        )

    async def join_session(self, session_id: str, user_id: str) -> Optional[Session]:
        """
        Join an existing session
        """
        db = get_db()

        # Check if session exists and is active
        session_result = db.table("sessions").select("*").eq("id", session_id).eq("is_active", True).execute()

        if not session_result.data:
            return None

        session_data = session_result.data[0]

        # Add user to participants (ignore if already exists)
        try:
            db.table("session_participants").insert({
                "session_id": session_id,
                "user_id": user_id
            }).execute()
        except Exception:
            # User already in session, that's fine
            pass

        return Session(
            id=session_data["id"],
            name=session_data["name"],
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"])
        )

    async def get_session(self, session_id: str) -> Optional[Session]:
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
            host_id=session_data["host_id"],
            created_at=datetime.fromisoformat(session_data["created_at"]),
            is_active=session_data["is_active"],
            lyrics_display_mode=LyricsDisplayMode(session_data["lyrics_display_mode"])
        )

    async def add_to_queue(
        self,
        session_id: str,
        song_id: str,
        user_id: str,
        access_token: str = None
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
        max_pos_result = db.table("queue_items") \
            .select("position") \
            .eq("session_id", session_id) \
            .order("position", desc=True) \
            .limit(1) \
            .execute()

        next_position = 0 if not max_pos_result.data else max_pos_result.data[0]["position"] + 1

        # Insert queue item
        result = db.table("queue_items").insert({
            "session_id": session_id,
            "song_id": song.id,
            "song_name": song.name,
            "artist_name": song.artist,
            "album_name": song.album,
            "duration_ms": song.duration_ms,
            "spotify_uri": song.spotify_uri,
            "image_url": song.image_url,
            "added_by": user_id,
            "position": next_position
        }).execute()

        if not result.data:
            raise Exception("Failed to add song to queue")

        item_data = result.data[0]

        return QueueItem(
            id=item_data["id"],
            song=song,
            added_by=item_data["added_by"],
            added_at=datetime.fromisoformat(item_data["created_at"]),
            position=item_data["position"]
        )

    async def get_queue(self, session_id: str) -> List[QueueItem]:
        """
        Get all queue items for a session
        """
        db = get_db()

        result = db.table("queue_items") \
            .select("*") \
            .eq("session_id", session_id) \
            .order("position") \
            .execute()

        queue_items = []
        for item_data in result.data:
            song = Song(
                id=item_data["song_id"],
                name=item_data["song_name"],
                artist=item_data["artist_name"],
                album=item_data["album_name"],
                duration_ms=item_data["duration_ms"],
                spotify_uri=item_data["spotify_uri"],
                image_url=item_data["image_url"]
            )

            queue_item = QueueItem(
                id=item_data["id"],
                song=song,
                added_by=item_data["added_by"],
                added_at=datetime.fromisoformat(item_data["created_at"]),
                position=item_data["position"]
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
        session_result = db.table("sessions").select("host_id").eq("id", item["session_id"]).execute()

        if session_result.data:
            session_host = session_result.data[0]["host_id"]
            if item["added_by"] != user_id and session_host != user_id:
                return False

        # Delete the item
        db.table("queue_items").delete().eq("id", queue_item_id).execute()

        return True

    async def play_next(self, session_id: str, user_id: str) -> Optional[QueueItem]:
        """
        Move to next song in queue
        """
        db = get_db()

        # Get current playing song
        current_result = db.table("queue_items") \
            .select("*") \
            .eq("session_id", session_id) \
            .eq("is_playing", True) \
            .execute()

        # Mark current as not playing
        if current_result.data:
            db.table("queue_items") \
                .update({"is_playing": False}) \
                .eq("id", current_result.data[0]["id"]) \
                .execute()

        # Get next song
        next_result = db.table("queue_items") \
            .select("*") \
            .eq("session_id", session_id) \
            .order("position") \
            .limit(1) \
            .execute()

        if not next_result.data:
            return None

        next_item = next_result.data[0]

        # Mark as playing
        db.table("queue_items") \
            .update({"is_playing": True}) \
            .eq("id", next_item["id"]) \
            .execute()

        song = Song(
            id=next_item["song_id"],
            name=next_item["song_name"],
            artist=next_item["artist_name"],
            album=next_item["album_name"],
            duration_ms=next_item["duration_ms"],
            spotify_uri=next_item["spotify_uri"],
            image_url=next_item["image_url"]
        )

        return QueueItem(
            id=next_item["id"],
            song=song,
            added_by=next_item["added_by"],
            added_at=datetime.fromisoformat(next_item["created_at"]),
            position=next_item["position"]
        )

    async def get_current_song(self, session_id: str) -> Optional[QueueItem]:
        """
        Get currently playing song
        """
        db = get_db()

        result = db.table("queue_items") \
            .select("*") \
            .eq("session_id", session_id) \
            .eq("is_playing", True) \
            .execute()

        if not result.data:
            return None

        item_data = result.data[0]

        song = Song(
            id=item_data["song_id"],
            name=item_data["song_name"],
            artist=item_data["artist_name"],
            album=item_data["album_name"],
            duration_ms=item_data["duration_ms"],
            spotify_uri=item_data["spotify_uri"],
            image_url=item_data["image_url"]
        )

        return QueueItem(
            id=item_data["id"],
            song=song,
            added_by=item_data["added_by"],
            added_at=datetime.fromisoformat(item_data["created_at"]),
            position=item_data["position"]
        )
