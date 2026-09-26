#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Clean up single-character phrase notes by consolidating them into Hanzi notes.

This script finds phrase notes (TOCFL) that contain only a single
character in their Traditional field, matches them with existing Hanzi notes by
character and pinyin, and then:
1. Copies the phrase note's "Meaning" field into the Hanzi note's "Meaning 2" field
2. Adds a "ready-for-deletion" tag to the phrase note

This helps consolidate learning materials and identify phrase notes that can be
safely deleted since their content is preserved in the Hanzi notes.
"""

import re
import sys
from collections import defaultdict
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    AnkiNoteInfo,
    add_tags,
    find_notes_by_type,
    get_field_value,
    iter_notes_info,
    update_note_fields,
)
from shared.cli import parse_no_arguments


def clean_pinyin(pinyin_text: str) -> str:
    """
    Clean and normalize pinyin text for comparison

    Args:
        pinyin_text (str): Raw pinyin text (may contain HTML tags)

    Returns:
        str: Cleaned and normalized pinyin
    """
    # Remove HTML tags
    pinyin = re.sub(r"<[^>]+>", "", pinyin_text)
    # Convert to lowercase
    pinyin = pinyin.lower()
    # Remove extra whitespace
    return pinyin.strip()


def extract_hanzi_notes() -> dict[tuple[str, str], AnkiNoteInfo]:
    """
    Extract all single-character Hanzi notes with their pinyin

    Returns:
        dict: Dictionary mapping (character, pinyin) -> note_info
    """
    print("\n=== Extracting Hanzi notes ===")
    hanzi_note_ids = find_notes_by_type("Hanzi", "-is:suspended")

    hanzi_map: dict[tuple[str, str], AnkiNoteInfo] = {}

    for note_info in iter_notes_info(hanzi_note_ids):
        traditional = get_field_value(note_info, "Traditional")
        pinyin_raw = get_field_value(note_info, "Pinyin")

        # Only consider single character notes
        if len(traditional) == 1 and pinyin_raw:
            pinyin = clean_pinyin(pinyin_raw)
            key = (traditional, pinyin)
            hanzi_map[key] = note_info

    print(f"Found {len(hanzi_map)} single-character Hanzi notes")
    return hanzi_map


def extract_single_char_phrase_notes(note_types: list[str]) -> list[tuple[AnkiNoteInfo, str, str]]:
    """
    Extract phrase notes that have a single character in Traditional field

    Args:
        note_types (list): List of note types to process (e.g., ["TOCFL"])

    Returns:
        list: List of (note_info, character, pinyin) tuples
    """
    print("\n=== Extracting single-character phrase notes ===")
    single_char_phrases: list[tuple[AnkiNoteInfo, str, str]] = []

    for note_type in note_types:
        print(f"\nProcessing {note_type} notes...")
        note_ids = find_notes_by_type(note_type, "-is:suspended")

        for note_info in iter_notes_info(note_ids):
            traditional_raw = get_field_value(note_info, "Traditional")
            pinyin_raw = get_field_value(note_info, "Pinyin")

            # Check if Traditional field has exactly one character
            if len(traditional_raw) == 1 and pinyin_raw:
                pinyin = clean_pinyin(pinyin_raw)
                single_char_phrases.append((note_info, traditional_raw, pinyin))

    print(f"Found {len(single_char_phrases)} single-character phrase notes", note_types)
    return single_char_phrases


def process_phrase_note(
    phrase_note_info: AnkiNoteInfo, character: str, pinyin: str, hanzi_map: dict[tuple[str, str], AnkiNoteInfo], note_type: str
) -> tuple[bool, str | None]:
    """
    Process a single-character phrase note and update corresponding Hanzi note

    Args:
        phrase_note_info (dict): The phrase note information
        character (str): The character
        pinyin (str): The cleaned pinyin
        hanzi_map (dict): Map of (char, pinyin) -> Hanzi note info
        note_type (str): The note type (e.g., "TOCFL", "Dangdai")

    Returns:
        tuple: (success: bool, skip_reason: str or None)
    """
    # Check if matching Hanzi note exists
    key = (character, pinyin)
    if key not in hanzi_map:
        return False, "no_matching_hanzi"

    hanzi_note_info = hanzi_map[key]
    phrase_note_id = phrase_note_info["noteId"]
    hanzi_note_id = hanzi_note_info["noteId"]

    # Get the meaning from phrase note
    phrase_meaning = get_field_value(phrase_note_info, "Meaning")

    if not phrase_meaning:
        return False, "no_meaning"

    # Only update Meaning 2 for TOCFL notes
    should_update_meaning = note_type == "TOCFL"

    # Skip the Meaning 2 update if it already matches, but still tag the phrase note
    meaning_already_matches = False
    if should_update_meaning:
        meaning_already_matches = get_field_value(hanzi_note_info, "Meaning 2") == phrase_meaning

    try:
        # Update Hanzi note's Meaning 2 field (only for TOCFL, and only if it differs)
        if should_update_meaning and not meaning_already_matches:
            update_note_fields(hanzi_note_id, {"Meaning 2": phrase_meaning})
            print(f"  ✓ Updated Hanzi note {hanzi_note_id} Meaning 2 with: {phrase_meaning[:50]}...")

        # Add tag to phrase note
        add_tags([phrase_note_id], "ready-for-deletion")
        print(f"  ✓ Tagged phrase note {phrase_note_id} as 'ready-for-deletion'")

        return True, None

    except Exception as e:
        raise RuntimeError(f"Error processing notes for character '{character}': {e}") from e


def main():
    """
    Main function to clean up single-character phrase notes
    """
    parse_no_arguments(__doc__)

    print("=== Starting phrase note cleanup ===")

    # Step 1: Extract all Hanzi notes
    hanzi_map = extract_hanzi_notes()

    if not hanzi_map:
        print("No Hanzi notes found. Exiting.")
        return

    # Step 2: Extract single-character phrase notes (TOCFL)
    note_types = ["TOCFL"]
    single_char_phrases = extract_single_char_phrase_notes(note_types)

    if not single_char_phrases:
        print("No single-character phrase notes found. Exiting.")
        return

    # Step 3: Process each phrase note
    print("\n=== Processing phrase notes ===")
    success_count = 0
    skip_reasons = defaultdict(int)

    for phrase_note_info, character, pinyin in single_char_phrases:
        phrase_note_id = phrase_note_info.get("noteId")
        note_type = phrase_note_info.get("modelName", "unknown")

        success, skip_reason = process_phrase_note(phrase_note_info, character, pinyin, hanzi_map, note_type)

        print(f"\nProcessing {note_type} note {phrase_note_id} - '{character}' ({pinyin})")

        if success:
            success_count += 1
        else:
            assert skip_reason is not None
            skip_reasons[skip_reason] += 1
            reason_msg = {"no_matching_hanzi": "No matching Hanzi note found", "no_meaning": "Phrase note has no meaning"}.get(
                skip_reason, skip_reason
            )
            print(f"  ⊘ Skipped: {reason_msg}")

    # Step 4: Print summary
    print("\n=== Summary ===")
    print(f"Total single-character phrase notes: {len(single_char_phrases)}")
    print(f"Successfully processed: {success_count}")
    print(f"Skipped: {len(single_char_phrases) - success_count}")
    if skip_reasons:
        print("\nSkip reasons:")
        for reason, count in skip_reasons.items():
            reason_msg = {"no_matching_hanzi": "No matching Hanzi note found", "no_meaning": "Phrase note has no meaning"}.get(
                reason, reason
            )
            print(f"  - {reason_msg}: {count}")
    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
