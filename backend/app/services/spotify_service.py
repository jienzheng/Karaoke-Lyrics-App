"""
Spotify API service for searching songs and managing playback
"""
import httpx
from typing import List, Optional
from app.models.schemas import Song


class SpotifyService:
    """Service for Spotify API operations"""

    def __init__(self):
        self.api_base_url = "https://api.spotify.com/v1"

    async def search_songs(
        self,
        query: str,
        access_token: str,
        limit: int = 20
    ) -> List[Song]:
        """
        Search for songs on Spotify

        Args:
            query: Search query
            access_token: Valid Spotify access token
            limit: Maximum number of results

        Returns:
            List of Song objects
        """
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        params = {
            "q": query,
            "type": "track",
            "limit": limit
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/search",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()

        songs = []
        for item in data.get("tracks", {}).get("items", []):
            song = Song(
                id=item["id"],
                name=item["name"],
                artist=", ".join([artist["name"] for artist in item["artists"]]),
                album=item["album"]["name"],
                duration_ms=item["duration_ms"],
                spotify_uri=item["uri"],
                image_url=item["album"]["images"][0]["url"] if item["album"]["images"] else None
            )
            songs.append(song)

        return songs

    async def get_track(self, track_id: str, access_token: str) -> Optional[Song]:
        """
        Get track details by ID

        Args:
            track_id: Spotify track ID
            access_token: Valid Spotify access token

        Returns:
            Song object or None
        """
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/tracks/{track_id}",
                headers=headers
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            item = response.json()

        return Song(
            id=item["id"],
            name=item["name"],
            artist=", ".join([artist["name"] for artist in item["artists"]]),
            album=item["album"]["name"],
            duration_ms=item["duration_ms"],
            spotify_uri=item["uri"],
            image_url=item["album"]["images"][0]["url"] if item["album"]["images"] else None
        )
