#!/usr/bin/env python3
"""
Shared utilities for Chinese-English dictionary lookups.

This module provides a common interface for looking up Chinese words/phrases
in the chinese-english-lookup dictionary.
"""

from chinese_english_lookup import Dictionary
from typing import Optional


# Module-level dictionary instance (lazy initialized)
_dictionary: Optional[Dictionary] = None


def get_dictionary() -> Dictionary:
    """
    Get or create the Chinese-English dictionary instance.

    The dictionary is lazily initialized and cached for reuse.

    Returns:
        Dictionary instance
    """
    global _dictionary
    if _dictionary is None:
        _dictionary = Dictionary()
    return _dictionary


def lookup_meaning(text: str, max_definitions: int = 3) -> Optional[str]:
    """
    Look up the meaning of a Chinese word or phrase in the dictionary.

    Args:
        text: Chinese text (traditional or simplified) to look up
        max_definitions: Maximum number of definitions to include (default: 3)

    Returns:
        Semicolon-separated definitions if found, None if not found
    """
    if not text or not text.strip():
        return None

    dictionary = get_dictionary()

    try:
        entry = dictionary.lookup(text.strip())
        if entry and entry.definition_entries:
            # Collect all definitions from all definition entries
            all_definitions = []
            for def_entry in entry.definition_entries:
                all_definitions.extend(def_entry.definitions)

            if all_definitions:
                # Limit to max_definitions and join with semicolons
                limited_defs = all_definitions[:max_definitions]
                return '; '.join(limited_defs)
    except Exception:
        # Dictionary lookup failed, return None to allow fallback
        pass

    return None


def lookup_character_meaning(char: str, occurrences: Optional[list] = None, max_definitions: int = 3) -> str:
    """
    Extract a meaning for a character from phrases containing it or from dictionary.

    This is useful when you have context about how the character is used in phrases.

    Args:
        char: The single character to look up
        occurrences: Optional list of (pinyin_syllable, phrase, meaning) tuples
                    showing how the character is used in phrases
        max_definitions: Maximum number of definitions to include

    Returns:
        Extracted meaning or empty string if not found
    """
    if not char or len(char) != 1:
        return ""

    # Look for single-character phrases first if occurrences provided
    if occurrences:
        for pinyin, phrase, meaning in occurrences:
            if phrase == char and meaning:
                return meaning

    # Fall back to dictionary lookup
    meaning = lookup_meaning(char, max_definitions)
    return meaning if meaning else ""
