"""
Lyrics service - fetches and processes lyrics from LRCLIB
"""
import httpx
import re
from typing import Optional, List
from app.models.schemas import Lyrics, LyricsResponse, LyricLine, LanguageType
from app.models.database import get_db


class LyricsService:
    """Service for fetching and managing lyrics from LRCLIB"""

    def __init__(self):
        self.lrclib_base_url = "https://lrclib.net/api"

    def detect_language(self, text: str) -> LanguageType:
        """
        Detect language of lyrics text
        Simple heuristic based on Unicode ranges
        """
        # Count characters in different language ranges
        chinese_count = len(re.findall(r'[\u4e00-\u9fff]', text))
        japanese_count = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))
        korean_count = len(re.findall(r'[\uac00-\ud7af]', text))

        total_asian = chinese_count + japanese_count + korean_count

        # If more than 10% of characters are from an Asian language
        threshold = len(text) * 0.1

        if chinese_count > threshold and chinese_count >= japanese_count:
            return LanguageType.CHINESE
        elif japanese_count > threshold:
            return LanguageType.JAPANESE
        elif korean_count > threshold:
            return LanguageType.KOREAN
        elif total_asian < threshold and len(text) > 0:
            return LanguageType.ENGLISH
        else:
            return LanguageType.OTHER

    def parse_lrc(self, lrc_content: str) -> List[LyricLine]:
        """
        Parse LRC format lyrics into structured format
        LRC format: [mm:ss.xx]lyric text
        """
        lines = []
        lrc_pattern = r'\[(\d+):(\d+)\.(\d+)\](.*)'

        for line in lrc_content.split('\n'):
            match = re.match(lrc_pattern, line)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                centiseconds = int(match.group(3))
                text = match.group(4).strip()

                # Convert to seconds
                start_time = minutes * 60 + seconds + centiseconds / 100

                if text:  # Only add non-empty lines
                    lines.append(LyricLine(
                        start_time=start_time,
                        time_ms=int(start_time * 1000),
                        text=text
                    ))

        # Sort by start time and calculate end times
        lines.sort(key=lambda x: x.start_time)
        for i in range(len(lines) - 1):
            lines[i].end_time = lines[i + 1].start_time

        # Last line end time is 5 seconds after start (estimate)
        if lines:
            lines[-1].end_time = lines[-1].start_time + 5.0

        return lines

    async def fetch_lyrics(
        self,
        song_name: str,
        artist_name: str,
        album_name: Optional[str] = None,
        duration: Optional[int] = None
    ) -> Optional[Lyrics]:
        """
        Fetch lyrics from LRCLIB API

        Args:
            song_name: Name of the song
            artist_name: Name of the artist
            album_name: Optional album name for better matching
            duration: Optional duration in seconds for better matching

        Returns:
            Lyrics object or None if not found
        """
        params = {
            "track_name": song_name,
            "artist_name": artist_name,
        }

        if album_name:
            params["album_name"] = album_name
        if duration:
            params["duration"] = duration

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.lrclib_base_url}/get",
                    params=params,
                    timeout=10.0
                )

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()

            # Try synced lyrics first, fallback to plain lyrics
            lrc_content = data.get("syncedLyrics") or data.get("plainLyrics")

            if not lrc_content:
                return None

            # Parse LRC content
            lines = self.parse_lrc(lrc_content) if data.get("syncedLyrics") else []

            # If no synced lyrics, create unsynced lines
            if not lines and data.get("plainLyrics"):
                plain_lines = data.get("plainLyrics").split('\n')
                lines = [
                    LyricLine(start_time=i * 3.0, text=line.strip())
                    for i, line in enumerate(plain_lines) if line.strip()
                ]

            # Detect language
            full_text = ' '.join([line.text for line in lines])
            detected_language = self.detect_language(full_text)

            # Generate a song_id from the data
            song_id = f"{artist_name}_{song_name}".lower().replace(' ', '_')

            lyrics = Lyrics(
                song_id=song_id,
                language=detected_language,
                lines=lines,
                synced=bool(data.get("syncedLyrics")),
                source="lrclib"
            )

            return lyrics

        except httpx.HTTPError as e:
            print(f"HTTP error fetching lyrics: {e}")
            return None
        except Exception as e:
            print(f"Error fetching lyrics: {e}")
            return None

    async def get_cached_lyrics(self, song_id: str) -> Optional[LyricsResponse]:
        """
        Get lyrics from cache/database
        """
        try:
            db = get_db()
            result = db.table("lyrics_cache").select("*").eq("song_id", song_id).execute()

            if not result.data:
                return None

            cached = result.data[0]

            # Reconstruct LyricsResponse from cached JSON
            original_lines = [
                LyricLine(
                    start_time=line["start_time"],
                    end_time=line.get("end_time"),
                    time_ms=line.get("time_ms"),
                    text=line["text"],
                    romanized_text=line.get("romanized_text"),
                )
                for line in cached["original_lyrics"]
            ]

            original_lyrics = Lyrics(
                song_id=song_id,
                language=LanguageType(cached["language"]),
                lines=original_lines,
                synced=cached.get("synced", False),
                source=cached.get("source", "lrclib"),
            )

            romanized_lyrics = None
            if cached.get("romanized_lyrics"):
                romanized_lines = [
                    LyricLine(
                        start_time=line["start_time"],
                        end_time=line.get("end_time"),
                        time_ms=line.get("time_ms"),
                        text=line["text"],
                        romanized_text=line.get("romanized_text"),
                    )
                    for line in cached["romanized_lyrics"]
                ]
                romanized_lyrics = Lyrics(
                    song_id=song_id,
                    language=LanguageType(cached["language"]),
                    lines=romanized_lines,
                    synced=cached.get("synced", False),
                    source=cached.get("source", "lrclib"),
                )

            return LyricsResponse(
                song_id=song_id,
                original_lyrics=original_lyrics,
                romanized_lyrics=romanized_lyrics,
                detected_language=LanguageType(cached["language"]),
            )
        except Exception as e:
            print(f"Error reading lyrics cache: {e}")
            return None

    async def cache_lyrics(
        self, song_id: str, response: LyricsResponse,
        song_name: str = "", artist_name: str = ""
    ) -> None:
        """
        Cache a LyricsResponse to the database
        """
        try:
            db = get_db()

            original_lines = [line.model_dump() for line in response.original_lyrics.lines]
            romanized_lines = (
                [line.model_dump() for line in response.romanized_lyrics.lines]
                if response.romanized_lyrics
                else None
            )

            db.table("lyrics_cache").upsert({
                "song_id": song_id,
                "song_name": song_name or song_id,
                "artist_name": artist_name or "",
                "language": response.detected_language.value,
                "synced": response.original_lyrics.synced,
                "source": response.original_lyrics.source,
                "original_lyrics": original_lines,
                "romanized_lyrics": romanized_lines,
            }).execute()
        except Exception as e:
            print(f"Error caching lyrics: {e}")

    async def search_lyrics(self, song_name: str, artist_name: str) -> list:
        """
        Search for available lyrics on LRCLIB
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.lrclib_base_url}/search",
                    params={
                        "q": f"{song_name} {artist_name}"
                    },
                    timeout=10.0
                )

                if response.status_code == 404:
                    return []

                response.raise_for_status()
                results = response.json()

            return results

        except Exception as e:
            print(f"Error searching lyrics: {e}")
            return []
