#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Clean up single-character phrase notes by consolidating them into Hanzi notes.

This script finds phrase notes (TOCFL, Dangdai, MyWords) that contain only a single
character in their Traditional field, matches them with existing Hanzi notes by
character and pinyin, and then:
1. Copies the phrase note's "Meaning" field into the Hanzi note's "Meaning 2" field
2. Adds a "ready-for-deletion" tag to the phrase note

This helps consolidate learning materials and identify phrase notes that can be
safely deleted since their content is preserved in the Hanzi notes.
"""

import requests
import re
import json
from collections import defaultdict


def anki_connect_request(action, params=None):
    """
    Send a request to anki-connect

    Args:
        action (str): The action to perform
        params (dict): Parameters for the action

    Returns:
        dict: Response from anki-connect
    """
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    try:
        response = requests.post("http://localhost:8765", json=request_data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Error connecting to anki-connect: {e}")


def find_notes_by_type(note_type):
    """
    Find all notes of a specific type

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    response = anki_connect_request("findNotes", {"query": f"note:{note_type}"})

    if response and response.get("result"):
        note_ids = response["result"]
        print(f"Found {len(note_ids)} notes of type {note_type}")
        return note_ids

    print(f"No notes found of type {note_type}")
    return []


def get_notes_info(note_ids):
    """
    Get detailed information about multiple notes

    Args:
        note_ids (list): List of note IDs

    Returns:
        list: List of note information dictionaries
    """
    response = anki_connect_request("notesInfo", {"notes": note_ids})

    if response and response.get("result"):
        return response["result"]

    raise RuntimeError(f"No notes found for IDs {note_ids}")


def clean_pinyin(pinyin_text):
    """
    Clean and normalize pinyin text for comparison

    Args:
        pinyin_text (str): Raw pinyin text (may contain HTML tags)

    Returns:
        str: Cleaned and normalized pinyin
    """
    # Remove HTML tags
    pinyin = re.sub(r'<[^>]+>', '', pinyin_text)
    # Convert to lowercase
    pinyin = pinyin.lower()
    # Remove extra whitespace
    pinyin = pinyin.strip()
    return pinyin


def extract_hanzi_notes():
    """
    Extract all single-character Hanzi notes with their pinyin

    Returns:
        dict: Dictionary mapping (character, pinyin) -> note_info
    """
    print("\n=== Extracting Hanzi notes ===")
    hanzi_note_ids = find_notes_by_type("Hanzi")

    if not hanzi_note_ids:
        return {}

    hanzi_map = {}  # {(char, pinyin): note_info}
    batch_size = 100

    for i in range(0, len(hanzi_note_ids), batch_size):
        batch_ids = hanzi_note_ids[i:i + batch_size]
        notes_info = get_notes_info(batch_ids)

        for note_info in notes_info:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin_raw = note_info['fields'].get('Pinyin', {}).get('value', '').strip()

            # Only consider single character notes
            if len(traditional) == 1 and pinyin_raw:
                pinyin = clean_pinyin(pinyin_raw)
                key = (traditional, pinyin)
                hanzi_map[key] = note_info

    print(f"Found {len(hanzi_map)} single-character Hanzi notes")
    return hanzi_map


def extract_single_char_phrase_notes(note_types):
    """
    Extract phrase notes that have a single character in Traditional field

    Args:
        note_types (list): List of note types to process (e.g., ["TOCFL", "Dangdai", "MyWords"])

    Returns:
        list: List of (note_info, character, pinyin) tuples
    """
    print("\n=== Extracting single-character phrase notes ===")
    single_char_phrases = []

    for note_type in note_types:
        print(f"\nProcessing {note_type} notes...")
        note_ids = find_notes_by_type(note_type)

        if not note_ids:
            continue

        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i:i + batch_size]
            notes_info = get_notes_info(batch_ids)

            for note_info in notes_info:
                traditional_raw = note_info['fields'].get('Traditional', {}).get('value', '').strip()
                pinyin_raw = note_info['fields'].get('Pinyin', {}).get('value', '').strip()

                # Check if Traditional field has exactly one character
                if len(traditional_raw) == 1 and pinyin_raw:
                    pinyin = clean_pinyin(pinyin_raw)
                    single_char_phrases.append((note_info, traditional_raw, pinyin))

    print(f"Found {len(single_char_phrases)} single-character phrase notes")
    return single_char_phrases


def update_hanzi_meaning2(note_id, meaning):
    """
    Update the Meaning 2 field of a Hanzi note

    Args:
        note_id (int): The note ID
        meaning (str): The meaning to set

    Returns:
        bool: True if successful
    """
    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": {
                "Meaning 2": meaning
            }
        }
    })

    if response and response.get("error") is None:
        return True
    else:
        raise RuntimeError(f"Failed to update note {note_id}: {response}")


def add_tag_to_note(note_id, tag):
    """
    Add a tag to a note

    Args:
        note_id (int): The note ID
        tag (str): The tag to add

    Returns:
        bool: True if successful
    """
    response = anki_connect_request("addTags", {
        "notes": [note_id],
        "tags": tag
    })

    if response and response.get("error") is None:
        return True
    else:
        raise RuntimeError(f"Failed to add tag to note {note_id}: {response}")


def process_phrase_note(phrase_note_info, character, pinyin, hanzi_map, note_type):
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
    phrase_note_id = phrase_note_info.get('noteId')
    hanzi_note_id = hanzi_note_info.get('noteId')

    # Get the meaning from phrase note
    phrase_meaning = phrase_note_info['fields'].get('Meaning', {}).get('value', '').strip()

    if not phrase_meaning:
        return False, "no_meaning"

    # Only update Meaning 2 for TOCFL notes
    should_update_meaning = note_type == "TOCFL"

    if should_update_meaning:
        # Check if Hanzi note's Meaning 2 already matches the target
        hanzi_meaning2 = hanzi_note_info['fields'].get('Meaning 2', {}).get('value', '').strip()
        if hanzi_meaning2 == phrase_meaning:
            return True, "already_matches"

    try:
        # Update Hanzi note's Meaning 2 field (only for TOCFL)
        if should_update_meaning:
            update_hanzi_meaning2(hanzi_note_id, phrase_meaning)
            print(f"  ✓ Updated Hanzi note {hanzi_note_id} Meaning 2 with: {phrase_meaning[:50]}...")

        # Add tag to phrase note
        add_tag_to_note(phrase_note_id, "ready-for-deletion")
        print(f"  ✓ Tagged phrase note {phrase_note_id} as 'ready-for-deletion'")

        return True, None

    except Exception as e:
        raise RuntimeError(f"Error processing notes for character '{character}': {e}")


def main():
    """
    Main function to clean up single-character phrase notes
    """
    print("=== Starting phrase note cleanup ===")

    # Step 1: Extract all Hanzi notes
    hanzi_map = extract_hanzi_notes()

    if not hanzi_map:
        print("No Hanzi notes found. Exiting.")
        return

    # Step 2: Extract single-character phrase notes (TOCFL and Dangdai)
    note_types = ["TOCFL", "Dangdai"]
    single_char_phrases = extract_single_char_phrase_notes(note_types)

    if not single_char_phrases:
        print("No single-character phrase notes found. Exiting.")
        return

    # Step 3: Process each phrase note
    print("\n=== Processing phrase notes ===")
    success_count = 0
    skip_reasons = defaultdict(int)

    for phrase_note_info, character, pinyin in single_char_phrases:
        phrase_note_id = phrase_note_info.get('noteId')
        note_type = phrase_note_info.get('modelName', 'unknown')

        success, skip_reason = process_phrase_note(phrase_note_info, character, pinyin, hanzi_map, note_type)

        # Skip printing anything if values already match
        if skip_reason == "already_matches":
            success_count += 1
            continue

        print(f"\nProcessing {note_type} note {phrase_note_id} - '{character}' ({pinyin})")

        if success:
            success_count += 1
        else:
            skip_reasons[skip_reason] += 1
            reason_msg = {
                "no_matching_hanzi": "No matching Hanzi note found",
                "no_meaning": "Phrase note has no meaning"
            }.get(skip_reason, skip_reason)
            print(f"  ⊘ Skipped: {reason_msg}")

    # Step 4: Print summary
    print(f"\n=== Summary ===")
    print(f"Total single-character phrase notes: {len(single_char_phrases)}")
    print(f"Successfully processed: {success_count}")
    print(f"Skipped: {len(single_char_phrases) - success_count}")
    if skip_reasons:
        print("\nSkip reasons:")
        for reason, count in skip_reasons.items():
            reason_msg = {
                "no_matching_hanzi": "No matching Hanzi note found",
                "no_meaning": "Phrase note has no meaning"
            }.get(reason, reason)
            print(f"  - {reason_msg}: {count}")
    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
