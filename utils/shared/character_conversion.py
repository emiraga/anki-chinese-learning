#!/usr/bin/env python3
"""
Shared utilities for Chinese character conversion between traditional and simplified forms.

This module provides conversion functions that handle edge cases not covered by hanziconv,
particularly for radicals and rare characters.
"""

from typing import Dict, Tuple


# Special cases where HanziConv doesn't recognize the simplified/traditional relationship
# Format: (simplified, traditional)
SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS: list[Tuple[str, str]] = [
    # Metal radical
    ('钅', '釒'),
    # Food radical
    ('饣', '飠'),
    # Keep-eye-on character
    ('𠬤', '睪'),
    # Huge/great character
    ('钜', '鉅'),
]

# Build lookup dictionaries for fast access
_SIMPLIFIED_TO_TRADITIONAL: Dict[str, str] = {simp: trad for simp, trad in SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS}
_TRADITIONAL_TO_SIMPLIFIED: Dict[str, str] = {trad: simp for simp, trad in SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS}


def to_traditional(char: str, use_hanziconv: bool = True) -> str:
    """
    Convert a simplified Chinese character to traditional form.

    This function checks special cases first, then falls back to hanziconv if available.

    Args:
        char: A single Chinese character
        use_hanziconv: Whether to use hanziconv as fallback (default: True)

    Returns:
        The traditional form of the character, or the original if no conversion found
    """
    # Check special cases first
    if char in _SIMPLIFIED_TO_TRADITIONAL:
        return _SIMPLIFIED_TO_TRADITIONAL[char]

    # Fall back to hanziconv if available and requested
    if use_hanziconv:
        try:
            from hanziconv import HanziConv
            return HanziConv.toTraditional(char)
        except ImportError:
            pass

    return char


def to_simplified(char: str, use_hanziconv: bool = True) -> str:
    """
    Convert a traditional Chinese character to simplified form.

    This function checks special cases first, then falls back to hanziconv if available.

    Args:
        char: A single Chinese character
        use_hanziconv: Whether to use hanziconv as fallback (default: True)

    Returns:
        The simplified form of the character, or the original if no conversion found
    """
    # Check special cases first
    if char in _TRADITIONAL_TO_SIMPLIFIED:
        return _TRADITIONAL_TO_SIMPLIFIED[char]

    # Fall back to hanziconv if available and requested
    if use_hanziconv:
        try:
            from hanziconv import HanziConv
            return HanziConv.toSimplified(char)
        except ImportError:
            pass

    return char


def is_simplified(char: str) -> bool:
    """
    Check if a character is in simplified form.

    A character is considered simplified if converting it to traditional yields a different character.

    Args:
        char: A single Chinese character

    Returns:
        True if the character is simplified, False otherwise
    """
    return to_traditional(char) != char


def is_traditional(char: str) -> bool:
    """
    Check if a character is in traditional form.

    A character is considered traditional if converting it to simplified yields a different character.

    Args:
        char: A single Chinese character

    Returns:
        True if the character is traditional, False otherwise
    """
    return to_simplified(char) != char


def add_special_pair(simplified: str, traditional: str) -> None:
    """
    Add a new special simplified/traditional character pair at runtime.

    Use this to extend the conversion tables for characters not recognized by hanziconv.

    Args:
        simplified: The simplified form
        traditional: The traditional form
    """
    if len(simplified) != 1 or len(traditional) != 1:
        raise ValueError("Both simplified and traditional must be single characters")

    SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS.append((simplified, traditional))
    _SIMPLIFIED_TO_TRADITIONAL[simplified] = traditional
    _TRADITIONAL_TO_SIMPLIFIED[traditional] = simplified


def get_all_special_pairs() -> list[Tuple[str, str]]:
    """
    Get all registered special simplified/traditional pairs.

    Returns:
        List of (simplified, traditional) tuples
    """
    return SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS.copy()
