#!/usr/bin/env python3
"""
Shared utilities for Chinese character conversion between traditional and simplified forms.

This module provides conversion functions that handle edge cases not covered by hanziconv,
particularly for radicals and rare characters.
"""

# Traditional -> simplified is performed by OpenCC (Open Chinese Convert), which
# is more accurate than hanziconv for our goal (learning Mainland simplified):
# hanziconv both misses simplifications (週, 託, 採, ...) and has outright bugs
# (呼 -> 唿). hanziconv is kept if OpenCC is not installed.
#
# The authoritative config is "t2s" (generic Traditional -> Simplified). The
# region-specific configs (tw2s/hk2s) are intentionally NOT used as the source
# of truth because they first normalize toward Taiwan/Hong-Kong preferred shapes
# and can over-convert (e.g. tw2s: 抬 -> 擡), which is the opposite of what we
# want. The regional configs are still shown in the warning for context.
#   t2s   : Traditional (generic)    -> Simplified   (authoritative)
#   tw2s  : Traditional (Taiwan)     -> Simplified
#   tw2sp : Traditional (Taiwan)     -> Simplified, with Mainland phrasing
#   hk2s  : Traditional (Hong Kong)  -> Simplified
_OPENCC_PRIMARY_CONFIG = "t2s"
_OPENCC_CONFIGS = ("t2s", "tw2s", "tw2sp", "hk2s")
# Mutable module-level state (lowercase so the type checker does not treat these
# as immutable constants).
_opencc_converters: dict[str, object] | None = None
_opencc_disabled = False


def _opencc_simplified_all(char: str) -> dict[str, str] | None:
    """
    Return each common OpenCC config's simplified form for `char`, keyed by
    config name. Returns None if OpenCC is not installed.
    """
    global _opencc_converters, _opencc_disabled
    if _opencc_disabled:
        return None
    if _opencc_converters is None:
        try:
            from opencc import OpenCC

            _opencc_converters = {cfg: OpenCC(cfg) for cfg in _OPENCC_CONFIGS}
        except ImportError:
            _opencc_disabled = True
            return None
    return {cfg: conv.convert(char) for cfg, conv in _opencc_converters.items()}  # type: ignore[attr-defined]


# Special cases where HanziConv doesn't recognize the simplified/traditional relationship
# Format: (simplified, traditional)
SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS: list[tuple[str, str]] = [
    # Metal radical
    ("钅", "釒"),
    # Food radical
    ("饣", "飠"),
    # Keep-eye-on character
    ("𠬤", "睪"),
    # Huge/great character
    ("钜", "鉅"),
]

# Build lookup dictionaries for fast access
_SIMPLIFIED_TO_TRADITIONAL: dict[str, str] = {simp: trad for simp, trad in SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS}
_TRADITIONAL_TO_SIMPLIFIED: dict[str, str] = {trad: simp for simp, trad in SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS}


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
    Convert a traditional Chinese character to its Mainland simplified form.

    Conversion priority:
      1. The hand-maintained special cases (radicals / rare chars).
      2. OpenCC's authoritative `t2s` (generic Traditional -> Simplified) mapping.
      3. hanziconv, used only as a fallback when OpenCC is not installed.

    Args:
        char: A single Chinese character
        use_hanziconv: Whether to use external converters at all (default: True).
            When False, only the hand-maintained special cases are applied.

    Returns:
        The simplified form of the character, or the original if no conversion found
    """
    # Check special cases first
    if char in _TRADITIONAL_TO_SIMPLIFIED:
        return _TRADITIONAL_TO_SIMPLIFIED[char]

    if not use_hanziconv:
        return char

    # hanziconv is used both as a cross-check and as a fallback, so compute it
    # up front (tolerating its absence).
    try:
        from hanziconv import HanziConv

        hanziconv_result: str | None = HanziConv.toSimplified(char)
    except ImportError:
        hanziconv_result = None

    # OpenCC t2s is authoritative when available.
    opencc_results = _opencc_simplified_all(char)
    if opencc_results is not None:
        chosen = opencc_results[_OPENCC_PRIMARY_CONFIG]
        return chosen

    # OpenCC unavailable: fall back to hanziconv, then to the original char.
    if hanziconv_result is not None:
        return hanziconv_result
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


def get_all_special_pairs() -> list[tuple[str, str]]:
    """
    Get all registered special simplified/traditional pairs.

    Returns:
        List of (simplified, traditional) tuples
    """
    return SPECIAL_SIMPLIFIED_TRADITIONAL_PAIRS.copy()
