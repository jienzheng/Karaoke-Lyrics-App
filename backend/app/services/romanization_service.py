"""
Romanization service - converts Asian languages to romanized form
"""
import re
from typing import Optional
from pypinyin import pinyin, Style
from pykakasi import kakasi
from hangul_romanize import Transliter
from hangul_romanize.rule import academic
from app.models.schemas import Lyrics, LyricLine, LanguageType


class RomanizationService:
    """Service for romanizing Chinese, Japanese, and Korean text"""

    def __init__(self):
        # Initialize Japanese romanizer
        self.kks = kakasi()

        # Initialize Korean romanizer
        self.korean_transliter = Transliter(academic)

    def detect_language(self, text: str) -> LanguageType:
        """
        Detect language of text based on Unicode ranges
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

    def romanize_chinese(self, text: str) -> str:
        """
        Convert Chinese characters to Pinyin

        Args:
            text: Chinese text

        Returns:
            Pinyin romanization with tone marks
        """
        try:
            # Get pinyin with tone marks
            result = pinyin(text, style=Style.TONE, heteronym=False)
            # Flatten and join with spaces
            romanized = ' '.join([item[0] for item in result])
            return romanized
        except Exception as e:
            print(f"Error romanizing Chinese: {e}")
            return text

    def romanize_japanese(self, text: str) -> str:
        """
        Convert Japanese (Hiragana/Katakana/Kanji) to Romaji

        Args:
            text: Japanese text

        Returns:
            Romaji romanization
        """
        try:
            result = self.kks.convert(text)
            # Extract the 'hepburn' romanization
            romanized = ''.join([item['hepburn'] for item in result])
            return romanized
        except Exception as e:
            print(f"Error romanizing Japanese: {e}")
            return text

    def romanize_korean(self, text: str) -> str:
        """
        Convert Korean (Hangul) to Romanization

        Args:
            text: Korean text

        Returns:
            Romanized Korean (Academic system)
        """
        try:
            romanized = self.korean_transliter.translit(text)
            return romanized
        except Exception as e:
            print(f"Error romanizing Korean: {e}")
            return text

    async def romanize_text(self, text: str, language: LanguageType) -> str:
        """
        Romanize text based on language

        Args:
            text: Text to romanize
            language: Language of the text

        Returns:
            Romanized text
        """
        if language == LanguageType.CHINESE:
            return self.romanize_chinese(text)
        elif language == LanguageType.JAPANESE:
            return self.romanize_japanese(text)
        elif language == LanguageType.KOREAN:
            return self.romanize_korean(text)
        elif language in [LanguageType.ENGLISH, LanguageType.OTHER]:
            return text
        else:
            raise ValueError(f"Unsupported language: {language}")

    async def romanize_lyrics(self, lyrics: Lyrics) -> Optional[Lyrics]:
        """
        Romanize entire lyrics object line by line

        Args:
            lyrics: Lyrics object with original text

        Returns:
            New Lyrics object with romanized text
        """
        if lyrics.language not in [LanguageType.CHINESE, LanguageType.JAPANESE, LanguageType.KOREAN]:
            # No romanization needed
            return None

        romanized_lines = []
        for line in lyrics.lines:
            romanized_text = await self.romanize_text(line.text, lyrics.language)
            romanized_line = LyricLine(
                start_time=line.start_time,
                end_time=line.end_time,
                text=romanized_text,
                romanized_text=None,  # Already romanized
                words=line.words
            )
            romanized_lines.append(romanized_line)

        romanized_lyrics = Lyrics(
            song_id=lyrics.song_id,
            language=lyrics.language,
            lines=romanized_lines,
            synced=lyrics.synced,
            source=lyrics.source
        )

        return romanized_lyrics
