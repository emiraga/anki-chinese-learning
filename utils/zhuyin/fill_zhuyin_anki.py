#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.1"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Fill the Zhuyin field of notes that have a Pinyin field but no Zhuyin yet.
"""

import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import AnkiNoteInfo, find_notes_by_query, get_field_value, iter_notes_info, update_note_fields
from shared.pinyin_utils import pinyin_to_zhuyin

NOTE_TYPES = ["TOCFL", "Hanzi"]


def find_notes_with_empty_zhuyin(note_type: str) -> list[int]:
    """
    Find notes with empty Zhuyin field but non-empty Traditional field

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    # Search for notes with non-empty Traditional but empty Zhuyin field
    note_ids = find_notes_by_query(f"note:{note_type} Traditional:_* Zhuyin:")

    if note_ids:
        print(f"Found {len(note_ids)} note(s) with empty Zhuyin field in {note_type}")
    else:
        print(f"No notes found with empty Zhuyin field in {note_type}")
    return note_ids


def update_zhuyin_for_note(note_info: AnkiNoteInfo) -> None:
    """
    Update the Zhuyin field of a single note based on its Pinyin field

    Args:
        note_info: The note to update
    """
    note_id = note_info["noteId"]

    # Anki wraps a multi-line Pinyin field in divs; they are not part of the pinyin.
    current_pinyin = get_field_value(note_info, "Pinyin").replace("<div>", "").replace("</div>", "").strip()
    current_zhuyin = get_field_value(note_info, "Zhuyin")

    # Only update if Zhuyin is empty and there is pinyin to convert
    if current_zhuyin:
        print(f"Skipping note {note_id}: Zhuyin field already has content: '{current_zhuyin}'")
        return

    if not current_pinyin:
        print(f"Skipping note {note_id}: No pinyin content found")
        return

    print(f"Processing note {note_id}: Pinyin='{current_pinyin}'")

    zhuyin_text = pinyin_to_zhuyin(current_pinyin)

    if not zhuyin_text:
        raise ValueError(f"Could not convert pinyin '{current_pinyin}' of note {note_id} to zhuyin")

    update_note_fields(note_id, {"Zhuyin": zhuyin_text})
    print(f"Successfully updated note {note_id} with Zhuyin: {zhuyin_text}")


def main() -> None:
    """
    Main function to process all note types and update Zhuyin fields
    """
    for note_type in NOTE_TYPES:
        print(f"\n=== Processing {note_type} ===")
        note_ids = find_notes_with_empty_zhuyin(note_type)

        for note_info in iter_notes_info(note_ids):
            update_zhuyin_for_note(note_info)

        print(f"Completed processing {note_type}")

    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
