#!/usr/bin/env python3
"""
Shared utilities for scanning phrase notes (e.g. TOCFL) in Anki.

Provides phrase-scanning logic that reads the Traditional/Pinyin/Variants fields
of phrase notes and maps each character to its occurrences (pinyin syllable,
phrase, meaning).
"""

import json
import re

from .anki_utils import find_notes_by_query, get_notes_info
from .pinyin_utils import extract_pinyin_syllables


def extract_characters_from_phrases(note_types: list[str], only_unsuspended: bool = False) -> dict[str, list[tuple[str, str, str]]]:
    """
    Extract all unique characters from TOCFL notes with their pinyin and meanings

    Args:
        note_types (list): List of note types to process (e.g., ["TOCFL"])
        only_unsuspended (bool): If True, only consider notes that have at least
            one unsuspended card.

    Returns:
        dict: Dictionary mapping characters to their occurrences with pinyin and meanings
    """
    print("\n=== Extracting characters from phrases ===")
    char_data: dict[str, list[tuple[str, str, str]]] = {}  # {char: [(pinyin_syllable, phrase, meaning), ...]}

    for note_type in note_types:
        print(f"\nProcessing {note_type} notes...")
        query = f"note:{note_type} -is:suspended" if only_unsuspended else f"note:{note_type}"
        note_ids = find_notes_by_query(query)
        print(f"Found {len(note_ids)} {'unsuspended ' if only_unsuspended else ''}notes of type {note_type}")

        if not note_ids:
            continue

        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i : i + batch_size]
            notes_info = get_notes_info(batch_ids)

            for note_info in notes_info:
                meaning = note_info["fields"].get("Meaning", {}).get("value", "").strip()

                # Check if Variants field exists and has content
                variants_raw = note_info["fields"].get("Variants", {}).get("value", "").strip()
                variants_list: list[dict[str, str]] = []

                if variants_raw:
                    # Parse Variants JSON array
                    try:
                        parsed_variants = json.loads(variants_raw)
                        if isinstance(parsed_variants, list):
                            variants_list = parsed_variants
                    except json.JSONDecodeError as e:
                        print(f"Warning: Failed to parse Variants JSON: {e}")

                # If no variants, use the Traditional and Pinyin fields as a single variant
                if not variants_list:
                    traditional_raw = note_info["fields"].get("Traditional", {}).get("value", "").strip()
                    pinyin_raw = note_info["fields"].get("Pinyin", {}).get("value", "").strip()

                    # Clean HTML tags from pinyin
                    pinyin_raw = pinyin_raw.replace("<div>", "").replace("</div>", "").strip()

                    if not traditional_raw or not pinyin_raw:
                        print("Warning: missing traditional or pinyin", note_info)
                        continue

                    variants_list = [{"Traditional": traditional_raw, "Pinyin": pinyin_raw}]

                # Process each variant
                for variant in variants_list:
                    traditional_raw = variant.get("Traditional", "").strip()
                    pinyin_raw = variant.get("Pinyin", "").strip()

                    if not traditional_raw or not pinyin_raw:
                        continue

                    # Handle variants separated by / (e.g., "一塊/一塊兒" or "yīkuài/yīkuàir")
                    # Take only the first variant before the slash
                    traditional = traditional_raw.split("/")[0].strip()
                    pinyin = pinyin_raw.split("/")[0].strip()

                    # Remove parenthetical content (e.g., "籠(子)" -> "籠", "lóng(zi)" -> "lóng")
                    # This handles optional suffixes
                    traditional = re.sub(r"\([^)]*\)", "", traditional).strip()
                    pinyin = re.sub(r"\([^)]*\)", "", pinyin).strip()

                    # Remove ellipsis and surrounding characters (e.g., "以…為…" -> skip)
                    if "…" in traditional or "..." in traditional:
                        continue

                    # Skip entries with Latin letters or numbers (e.g., "KTV", "BBC", "101")
                    if re.search(r"[A-Za-z0-9]", traditional):
                        continue

                    # Remove punctuation from traditional (e.g., "哪裡,哪裡" -> "哪裡哪裡")
                    # Include middle dot . which is used in foreign names
                    # Also remove question marks and other sentence-ending punctuation
                    traditional = re.sub(r"[，、。！？；：．·?!]", "", traditional).strip()  # noqa: RUF001

                    # Remove punctuation and clean pinyin
                    # Include middle dot, apostrophes, and question marks used in sentences
                    pinyin = re.sub(r"[,，、。！？；：．·'?!]", " ", pinyin).strip()  # noqa: RUF001
                    # Remove hyphens (e.g., "chāo-shāng" -> "chāo shāng")
                    pinyin = pinyin.replace("-", " ")
                    # Convert to lowercase to handle capitalized syllables (e.g., "Ōu" -> "ōu")
                    # But preserve tone marks
                    pinyin = pinyin.lower()
                    # Normalize multiple spaces to single space
                    pinyin = re.sub(r"\s+", " ", pinyin).strip()

                    if not traditional or not pinyin:
                        continue

                    # Extract pinyin syllables
                    try:
                        pinyin_syllables = extract_pinyin_syllables(pinyin, len(traditional))
                    except Exception as e:
                        print(f"Error extracting pinyin for '{traditional}' (from '{traditional_raw}'): {e}")
                        continue

                    # Map each character to its pinyin syllable
                    if len(pinyin_syllables) == len(traditional):
                        for char, syllable in zip(traditional, pinyin_syllables, strict=False):
                            if char not in char_data:
                                char_data[char] = []
                            char_data[char].append((syllable, traditional, meaning))

    print(f"Extracted data for {len(char_data)} unique characters")
    return char_data
