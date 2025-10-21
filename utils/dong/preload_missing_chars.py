#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import os
import requests
import webbrowser
import time
from pathlib import Path
import urllib.parse
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


def get_notes_info_batch(note_ids):
    """
    Get detailed information about multiple notes in a batch

    Args:
        note_ids (list): List of note IDs

    Returns:
        list: List of note information dictionaries
    """
    if not note_ids:
        return []

    response = anki_connect_request("notesInfo", {"notes": note_ids})

    if response and response.get("result"):
        return response["result"]

    raise Exception("Failed to fetch notes")


def find_all_notes_with_traditional(note_type):
    """
    Find all notes with Traditional field

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    search_query = f'note:{note_type} Traditional:_*' #  -is:suspended

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) in {note_type}")
            return note_ids

    print(f"No notes found in {note_type}")
    return []


def extract_all_characters(text):
    """
    Extract all Chinese characters from a text string

    Args:
        text (str): Text containing Chinese characters

    Returns:
        set: Set of individual Chinese characters
    """
    chars = set()
    for char in text:
        # Check if character is in CJK Unified Ideographs ranges
        code_point = ord(char)
        if (0x4E00 <= code_point <= 0x9FFF or  # CJK Unified Ideographs
            0x3400 <= code_point <= 0x4DBF or  # CJK Unified Ideographs Extension A
            0x20000 <= code_point <= 0x2A6DF or  # CJK Unified Ideographs Extension B
            0x2A700 <= code_point <= 0x2B73F or  # CJK Unified Ideographs Extension C
            0x2B740 <= code_point <= 0x2B81F or  # CJK Unified Ideographs Extension D
            0x2B820 <= code_point <= 0x2CEAF or  # CJK Unified Ideographs Extension E
            0x2CEB0 <= code_point <= 0x2EBEF or  # CJK Unified Ideographs Extension F
            0xF900 <= code_point <= 0xFAFF or    # CJK Compatibility Ideographs
            0x2F800 <= code_point <= 0x2FA1F):   # CJK Compatibility Ideographs Supplement
            chars.add(char)
    return chars


def get_existing_dong_chars(dong_data_dir):
    """
    Get set of characters that already have dong data files

    Args:
        dong_data_dir (Path): Path to the dong data directory

    Returns:
        set: Set of characters with existing data files
    """
    existing_chars = set()

    if not dong_data_dir.exists():
        print(f"Warning: Dong data directory does not exist: {dong_data_dir}")
        return existing_chars

    for json_file in dong_data_dir.glob("*.json"):
        # The filename is the character plus .json extension
        char = json_file.stem
        existing_chars.add(char)

    print(f"Found {len(existing_chars)} existing dong character files")
    return existing_chars


def main():
    # Get the project root directory (two levels up from this script)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    dong_data_dir = project_root / "public" / "data" / "dong"

    print(f"Project root: {project_root}")
    print(f"Dong data directory: {dong_data_dir}")

    # Get all existing dong character files
    existing_chars = get_existing_dong_chars(dong_data_dir)

    # Collect all characters from Anki
    all_chars = set()
    char_frequency = Counter()

    note_types = ["TOCFL", "MyWords", "Hanzi", "Dangdai"]
    BATCH_SIZE = 100  # Process 100 notes at a time

    for note_type in note_types:
        print(f"\nProcessing note type: {note_type}")
        note_ids = find_all_notes_with_traditional(note_type)

        # Process notes in batches
        for i in range(0, len(note_ids), BATCH_SIZE):
            batch = note_ids[i:i + BATCH_SIZE]
            print(f"  Processing batch {i // BATCH_SIZE + 1}/{(len(note_ids) + BATCH_SIZE - 1) // BATCH_SIZE} ({i + len(batch)}/{len(note_ids)} notes)...")

            try:
                notes_info = get_notes_info_batch(batch)

                for note_info in notes_info:
                    traditional = note_info['fields'].get('Traditional', {}).get('value', '')

                    if traditional:
                        # Extract individual characters
                        chars = extract_all_characters(traditional)
                        all_chars.update(chars)
                        char_frequency.update(chars)
            except Exception as e:
                print(f"  Error processing batch starting at note {i}: {e}")

    print(f"\n{'='*60}")
    print(f"Total unique characters in Anki: {len(all_chars)}")
    print(f"Characters with dong data: {len(existing_chars)}")

    # Find missing characters
    missing_chars = all_chars - existing_chars
    print(f"Missing characters: {len(missing_chars)}")

    if not missing_chars:
        print("\nAll characters have dong data! Nothing to do.")
        return

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency[c], reverse=True)

    print(f"\n{'='*60}")
    print("Top 20 most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:20], 1):
        print(f"  {i}. {char} (appears {char_frequency[char]} times)")

    # Ask user if they want to open browser tabs
    print(f"\n{'='*60}")
    response = input(f"Open browser tabs for {len(missing_chars)} missing characters? (y/N): ")

    if response.lower() != 'y':
        print("Cancelled. Here are all missing characters:")
        print("".join(missing_sorted))
        return

    # Confirm if there are many characters
    if len(missing_chars) > 50:
        response = input(f"WARNING: This will open {len(missing_chars)} browser tabs. Continue? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return

    # Open browser tabs for missing characters
    print(f"\nOpening browser tabs for missing characters...")
    for i, char in enumerate(missing_sorted, 1):
        encoded_char = urllib.parse.quote(char)
        url = f"https://www.dong-chinese.com/dictionary/search/{encoded_char}"

        print(f"{i}/{len(missing_chars)}: Opening {char} - {url}")
        webbrowser.open_new_tab(url)

        # Add a small delay to avoid overwhelming the browser
        if i % 10 == 0:
            print(f"  Opened {i} tabs, pausing for longer...")
            time.sleep(10)
        else:
            time.sleep(2)

    print(f"\n{'='*60}")
    print("Done! All browser tabs opened.")
    print(f"Please download the data for these {len(missing_chars)} characters.")
    print(f"Data should be saved to: {dong_data_dir}/")


if __name__ == "__main__":
    main()
