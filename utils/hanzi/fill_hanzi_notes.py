#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
#   "hanziconv",
# ]
# ///

import requests
import dragonmapper.transcriptions
import hanziconv
from collections import Counter


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
        print(f"Error connecting to anki-connect: {e}")
        raise


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

    raise Exception(f"No notes found for IDs {note_ids}")


def traditional_to_simplified(traditional_char):
    """
    Convert traditional Chinese character to simplified using hanziconv

    Args:
        traditional_char (str): Traditional Chinese character

    Returns:
        str: Simplified Chinese character
    """
    try:
        simplified = hanziconv.HanziConv.toSimplified(traditional_char)
        return simplified
    except Exception as e:
        print(f"Warning: Could not convert '{traditional_char}' to simplified: {e}")
        raise


def extract_existing_hanzi_characters():
    """
    Extract all single characters from existing Hanzi notes

    Returns:
        set: Set of characters that already exist in Hanzi notes
    """
    print("\n=== Extracting existing Hanzi characters ===")
    hanzi_note_ids = find_notes_by_type("Hanzi")

    if not hanzi_note_ids:
        return set()

    existing_chars = set()
    batch_size = 100

    for i in range(0, len(hanzi_note_ids), batch_size):
        batch_ids = hanzi_note_ids[i:i + batch_size]
        notes_info = get_notes_info(batch_ids)

        for note_info in notes_info:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            # Only consider single character notes
            if len(traditional) == 1:
                existing_chars.add(traditional)

    print(f"Found {len(existing_chars)} existing single-character Hanzi notes")
    return existing_chars


def extract_characters_from_phrases(note_types):
    """
    Extract all unique characters from TOCFL and Dangdai notes with their pinyin and meanings

    Args:
        note_types (list): List of note types to process (e.g., ["TOCFL", "Dangdai"])

    Returns:
        dict: Dictionary mapping characters to their occurrences with pinyin and meanings
    """
    print("\n=== Extracting characters from phrases ===")
    char_data = {}  # {char: [(pinyin_syllable, phrase, meaning), ...]}

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
                traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
                pinyin_raw = note_info['fields'].get('Pinyin', {}).get('value', '').strip()
                meaning = note_info['fields'].get('Meaning', {}).get('value', '').strip()

                # Clean HTML tags from pinyin
                pinyin = pinyin_raw.replace('<div>', '').replace('</div>', '').strip()

                if not traditional or not pinyin:
                    print("Warning: missing traditional or pinyin", note_info)
                    continue

                # Extract pinyin syllables
                try:
                    pinyin_syllables = extract_pinyin_syllables(pinyin, len(traditional))
                except Exception as e:
                    print(f"Error extracting pinyin for '{traditional}': {e}")
                    continue

                # Map each character to its pinyin syllable
                if len(pinyin_syllables) == len(traditional):
                    for char, syllable in zip(traditional, pinyin_syllables):
                        if char not in char_data:
                            char_data[char] = []
                        char_data[char].append((syllable, traditional, meaning))

    print(f"Extracted data for {len(char_data)} unique characters")
    return char_data


def extract_pinyin_syllables(pinyin_text, expected_count):
    """
    Extract individual pinyin syllables from a pinyin string using zhuyin conversion

    Args:
        pinyin_text (str): Pinyin text (e.g., "nǐ hǎo" or "nǐhǎo")
        expected_count (int): Expected number of syllables

    Returns:
        list: List of pinyin syllables
    """
    try:
        # Convert pinyin to zhuyin (which automatically adds spaces between syllables)
        zhuyin = dragonmapper.transcriptions.pinyin_to_zhuyin(pinyin_text)

        # Split zhuyin by spaces
        zhuyin_syllables = zhuyin.split()

        # Convert each zhuyin syllable back to pinyin
        pinyin_syllables = [
            dragonmapper.transcriptions.zhuyin_to_pinyin(z)
            for z in zhuyin_syllables
        ]

        # Verify we got the expected count
        if len(pinyin_syllables) != expected_count:
            raise ValueError(
                f"Syllable count mismatch: got {len(pinyin_syllables)} syllables "
                f"but expected {expected_count} for '{pinyin_text}'"
            )

        return pinyin_syllables

    except Exception as e:
        raise ValueError(f"Cannot segment pinyin '{pinyin_text}' into {expected_count} syllables: {e}")


def infer_most_common_pinyin(char_occurrences):
    """
    Find the most common pinyin for a character based on its occurrences

    Args:
        char_occurrences (list): List of (pinyin_syllable, phrase, meaning) tuples

    Returns:
        str: Most common pinyin syllable
    """
    pinyin_counter = Counter([occ[0] for occ in char_occurrences])
    most_common_pinyin = pinyin_counter.most_common(1)[0][0]
    return most_common_pinyin


def extract_meaning_for_char(char, char_occurrences):
    """
    Extract a meaning for a character from phrases containing it

    Args:
        char (str): The character
        char_occurrences (list): List of (pinyin_syllable, phrase, meaning) tuples

    Returns:
        str: Extracted meaning or empty string
    """
    # Look for single-character phrases first
    for pinyin, phrase, meaning in char_occurrences:
        if phrase == char and meaning:
            return meaning

    # If no single-char phrase found, return empty
    # (We could try to extract from multi-char phrases, but that's complex)
    return ""


def create_hanzi_note(char, pinyin, simplified, meaning=""):
    """
    Create a new Hanzi note and suspend it

    Args:
        char (str): Traditional Chinese character
        pinyin (str): Pinyin pronunciation
        simplified (str): Simplified Chinese character
        meaning (str): Meaning (can be empty)

    Returns:
        bool: True if successful, False otherwise
    """
    # Create the note
    response = anki_connect_request("addNote", {
        "note": {
            "deckName": "Chinese",  # Adjust deck name as needed
            "modelName": "Hanzi",
            "fields": {
                "Traditional": char,
                "Pinyin": pinyin,
                "Hanzi": simplified,
                "Meaning": meaning,
                # Leave other fields empty
                "Props": "",
                "Mnemonic pegs": "",
                "Audio": "",
                "Zhuyin": ""
            },
            "tags": ["auto-generated"]
        }
    })

    if response and response.get("result"):
        note_id = response["result"]
        print(f"Created note {note_id} for character '{char}' with pinyin '{pinyin}'")

        # Suspend the note
        suspend_response = anki_connect_request("suspend", {
            "cards": anki_connect_request("findCards", {
                "query": f"nid:{note_id}"
            })["result"]
        })

        if suspend_response and suspend_response.get("error") is None:
            print(f"Suspended note {note_id}")
            return True
        else:
            print(f"Failed to suspend note {note_id}")
            return False
    else:
        print(f"Failed to create note for character '{char}': {response}")
        return False


def main():
    """
    Main function to discover missing characters and create Hanzi notes
    """
    print("=== Starting Hanzi note generation ===")

    # Step 1: Get existing Hanzi characters
    existing_chars = extract_existing_hanzi_characters()

    # Step 2: Extract characters from TOCFL and Dangdai
    note_types = ["TOCFL", "Dangdai"]
    char_data = extract_characters_from_phrases(note_types)

    # Step 3: Find missing characters
    all_chars = set(char_data.keys())
    missing_chars = all_chars - existing_chars
    print(f"\n=== Found {len(missing_chars)} missing characters ===")

    # Step 4: Create notes for missing characters
    created_count = 0
    failed_count = 0

    for char in sorted(missing_chars):
        char_occurrences = char_data[char]

        # Infer pinyin
        pinyin = infer_most_common_pinyin(char_occurrences)

        # Extract meaning
        meaning = extract_meaning_for_char(char, char_occurrences)

        # Get simplified form
        simplified = traditional_to_simplified(char)

        print(f"\nProcessing character '{char}':")
        print(f"  Pinyin: {pinyin} (from {len(char_occurrences)} occurrences)")
        print(f"  Meaning: {meaning if meaning else '(none)'}")
        print(f"  Simplified: {simplified}")

        # Create the note
        if create_hanzi_note(char, pinyin, simplified, meaning):
            created_count += 1
        else:
            failed_count += 1

    print(f"\n=== Summary ===")
    print(f"Total missing characters: {len(missing_chars)}")
    print(f"Successfully created: {created_count}")
    print(f"Failed: {failed_count}")
    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
