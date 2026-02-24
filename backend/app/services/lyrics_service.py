"""
Lyrics service - fetches and processes lyrics from LRCLIB
"""
import httpx
import re
from datetime import datetime
from typing import Optional, List
from app.models.schemas import Lyrics, LyricsResponse, LyricLine, LanguageType
from app.models.database import get_db

LYRICS_CACHE_MAX = 500


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

    def _parse_lrclib_data(self, data: dict) -> Optional[tuple]:
        """Parse an LRCLIB response dict into (lines, synced, detected_language).
        Returns None if no usable lyrics content."""
        lrc_content = data.get("syncedLyrics") or data.get("plainLyrics")
        if not lrc_content:
            return None

        lines = self.parse_lrc(lrc_content) if data.get("syncedLyrics") else []

        if not lines and data.get("plainLyrics"):
            plain_lines = data.get("plainLyrics").split('\n')
            lines = [
                LyricLine(start_time=i * 3.0, text=line.strip())
                for i, line in enumerate(plain_lines) if line.strip()
            ]

        if not lines:
            return None

        full_text = ' '.join([line.text for line in lines])
        detected_language = self.detect_language(full_text)
        synced = bool(data.get("syncedLyrics"))
        return lines, synced, detected_language

    def _expected_language_from_metadata(self, song_name: str, artist_name: str) -> Optional[LanguageType]:
        """Guess the expected language from song/artist name characters."""
        combined = song_name + " " + artist_name
        korean_chars = len(re.findall(r'[\uac00-\ud7af]', combined))
        japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', combined))
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', combined))

        if korean_chars > 0:
            return LanguageType.KOREAN
        if japanese_chars > 0:
            return LanguageType.JAPANESE
        if chinese_chars > 0:
            return LanguageType.CHINESE
        return None

    async def _search_for_better_lyrics(
        self, song_name: str, artist_name: str, expected_lang: LanguageType
    ) -> Optional[dict]:
        """Search LRCLIB for alternatives and return the best match for expected_lang."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.lrclib_base_url}/search",
                    params={"q": f"{song_name} {artist_name}"},
                    timeout=10.0,
                )
                if response.status_code != 200:
                    return None
                results = response.json()

            for result in results:
                # Check artist matches reasonably
                result_artist = (result.get("artistName") or "").lower()
                if artist_name.lower() not in result_artist and result_artist not in artist_name.lower():
                    continue
                parsed = self._parse_lrclib_data(result)
                if parsed and parsed[2] == expected_lang:
                    return result
            return None
        except Exception:
            return None

    async def _lrclib_get(self, song_name: str, artist_name: str) -> Optional[dict]:
        """Try LRCLIB /get with just track + artist (no album/duration to avoid
        strict-match failures). Returns the JSON dict or None."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.lrclib_base_url}/get",
                    params={"track_name": song_name, "artist_name": artist_name},
                    timeout=10.0,
                )
                if response.status_code in (400, 404):
                    return None
                response.raise_for_status()
                return response.json()
        except Exception:
            return None

    async def _lrclib_search(self, song_name: str, artist_name: str) -> Optional[dict]:
        """Fuzzy-search LRCLIB and return the best matching result,
        preferring synced lyrics over plain lyrics."""
        try:
            # Use the first artist name (before comma) for cleaner search
            primary_artist = artist_name.split(",")[0].strip()
            query = f"{song_name} {primary_artist}"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.lrclib_base_url}/search",
                    params={"q": query},
                    timeout=10.0,
                )
                if response.status_code != 200:
                    return None
                results = response.json()

            if not results:
                return None

            # Score results: prefer synced lyrics, then matching artist
            primary_lower = primary_artist.lower()
            best = None
            best_score = -1
            for r in results:
                score = 0
                r_artist = (r.get("artistName") or "").lower()
                # Artist match
                if primary_lower in r_artist or r_artist in primary_lower:
                    score += 10
                # Synced lyrics available
                if r.get("syncedLyrics"):
                    score += 5
                # Has any lyrics at all
                if r.get("plainLyrics"):
                    score += 1
                if score > best_score:
                    best_score = score
                    best = r

            return best
        except Exception:
            return None

    async def fetch_lyrics(
        self,
        song_name: str,
        artist_name: str,
        album_name: Optional[str] = None,
        duration: Optional[int] = None
    ) -> Optional[Lyrics]:
        """
        Fetch lyrics from LRCLIB API.

        Strategy:
        1. Try /get with just track_name + artist_name (album/duration cause
           strict-match 404s when Spotify metadata doesn't exactly match).
        2. If /get fails, fall back to /search (fuzzy) and pick the best result.
        3. Validate language against song/artist metadata and search for a
           better match if there's a mismatch (e.g. Japanese vs Korean).
        """
        # Step 1: try exact /get (no album/duration — they cause mismatches)
        data = await self._lrclib_get(song_name, artist_name)

        # Step 2: if /get failed, try with primary artist only (before comma)
        if not data and "," in artist_name:
            primary_artist = artist_name.split(",")[0].strip()
            data = await self._lrclib_get(song_name, primary_artist)

        # Step 3: if /get returned only unsynced lyrics, try /search for a synced version
        if data and not data.get("syncedLyrics") and data.get("plainLyrics"):
            search_data = await self._lrclib_search(song_name, artist_name)
            if search_data and search_data.get("syncedLyrics"):
                data = search_data

        # Step 4: fall back to fuzzy /search if /get found nothing
        if not data:
            data = await self._lrclib_search(song_name, artist_name)

        if not data:
            return None

        try:
            parsed = self._parse_lrclib_data(data)
            if not parsed:
                return None
            lines, synced, detected_language = parsed

            # Validate: does the detected language match what we'd expect
            # from the song/artist metadata?
            expected_lang = self._expected_language_from_metadata(song_name, artist_name)
            if (
                expected_lang
                and detected_language != expected_lang
                and detected_language in (LanguageType.JAPANESE, LanguageType.KOREAN, LanguageType.CHINESE)
            ):
                print(f"Language mismatch for '{song_name}' by '{artist_name}': "
                      f"got {detected_language.value}, expected {expected_lang.value}. Searching for better match...")
                better = await self._search_for_better_lyrics(song_name, artist_name, expected_lang)
                if better:
                    alt_parsed = self._parse_lrclib_data(better)
                    if alt_parsed:
                        lines, synced, detected_language = alt_parsed
                        print(f"Found better match with language: {detected_language.value}")

            song_id = f"{artist_name}_{song_name}".lower().replace(' ', '_')

            lyrics = Lyrics(
                song_id=song_id,
                language=detected_language,
                lines=lines,
                synced=synced,
                source="lrclib"
            )

            return lyrics

        except Exception as e:
            print(f"Error processing lyrics: {e}")
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

            # Touch updated_at for LRU eviction
            try:
                db.table("lyrics_cache").update({"updated_at": datetime.utcnow().isoformat()}).eq("song_id", song_id).execute()
            except Exception:
                pass

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

            # Evict oldest entries if cache exceeds limit
            self._evict_cache(db)
        except Exception as e:
            print(f"Error caching lyrics: {e}")

    @staticmethod
    def _evict_cache(db) -> None:
        """Remove oldest lyrics cache entries if total exceeds LYRICS_CACHE_MAX."""
        try:
            count_result = db.table("lyrics_cache").select("id", count="exact").execute()
            total = count_result.count or 0
            if total <= LYRICS_CACHE_MAX:
                return

            excess = total - LYRICS_CACHE_MAX
            # Get the oldest entries by updated_at
            oldest = db.table("lyrics_cache") \
                .select("id") \
                .order("updated_at") \
                .limit(excess) \
                .execute()

            if oldest.data:
                ids_to_delete = [row["id"] for row in oldest.data]
                db.table("lyrics_cache").delete().in_("id", ids_to_delete).execute()
        except Exception as e:
            print(f"Error evicting lyrics cache: {e}")

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
