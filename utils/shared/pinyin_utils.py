#!/usr/bin/env python3
"""
Shared utilities for pinyin manipulation.

This module provides functions for working with pinyin:
- Removing tone marks
- Extracting tone numbers
- Adding tone marks to syllables
- Converting between pinyin and zhuyin
"""

import re

import dragonmapper.transcriptions


def remove_tone_marks(pinyin: str) -> str:
    """
    Remove tone marks from pinyin to get the syllable.

    Args:
        pinyin: Pinyin with tone marks (e.g., "hǎo")

    Returns:
        Pinyin without tone marks (e.g., "hao")
    """
    try:
        # Convert to numbered pinyin first, then strip numbers
        numbered = dragonmapper.transcriptions.accented_to_numbered(pinyin)
        # Remove the tone numbers
        return re.sub(r'[1-5]', '', numbered).lower()
    except Exception:
        # If conversion fails, try manual approach
        tone_map = {
            'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
            'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
            'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
            'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
            'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
            'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü',
        }
        result = pinyin.lower()
        for toned, plain in tone_map.items():
            result = result.replace(toned, plain)
        return result


def get_tone_number(pinyin: str) -> int | None:
    """
    Extract the tone number from pinyin with tone marks.

    Args:
        pinyin: Pinyin with tone marks (e.g., "hǎo")

    Returns:
        Tone number (1-5) or None if cannot determine.
        Tone 5 represents the neutral tone (no mark).
    """
    try:
        numbered = dragonmapper.transcriptions.accented_to_numbered(pinyin)
        # Extract the number at the end
        match = re.search(r'([1-5])$', numbered)
        if match:
            return int(match.group(1))
        # No tone number means neutral tone (tone 5)
        return 5
    except Exception:
        return None


def syllable_with_tone(syllable: str, tone: int) -> str:
    """
    Generate pinyin with a specific tone mark.

    Args:
        syllable: Base syllable without tone (e.g., "ma")
        tone: Tone number (1-5, where 5 is neutral)

    Returns:
        Pinyin with tone mark (e.g., "mǎ" for tone 3)
    """
    if tone == 5:
        # Neutral tone - just return the syllable as-is
        return syllable
    try:
        numbered = f"{syllable}{tone}"
        return dragonmapper.transcriptions.numbered_to_accented(numbered)
    except Exception:
        return syllable


def pinyin_with_zhuyin(pinyin: str) -> str:
    """
    Convert pinyin to 'pinyin (zhuyin)' format.

    Args:
        pinyin: Pinyin with tone marks (e.g., "hǎo")

    Returns:
        Pinyin with zhuyin appended (e.g., "hǎo (ㄏㄠˇ)")
    """
    try:
        zhuyin = dragonmapper.transcriptions.pinyin_to_zhuyin(pinyin)
        return f"{pinyin} ({zhuyin})"
    except Exception:
        return pinyin
