#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Find most frequent characters that appear in phrase notes (TOCFL, Dangdai, MyWords)
but are suspended in the Hanzi table.

This helps prioritize which characters to learn next based on how frequently
they appear in the phrases you're studying.
"""

import requests
from collections import Counter
import argparse
import re
import csv
from pathlib import Path


def load_frequency_data(csv_path):
    """
    Load frequency data from CSV file

    Args:
        csv_path (str): Path to the frequency CSV file

    Returns:
        dict: Mapping of character to frequency data (written_frequency, spoken_frequency)
    """
    frequency_data = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            traditional = row['traditional']
            # Handle alternative characters separated by / or ／
            # Take only the first character
            if '/' in traditional:
                traditional = traditional.split('/')[0]
            elif '／' in traditional:
                traditional = traditional.split('／')[0]

            # Only consider single characters
            if len(traditional) == 1:
                frequency_data[traditional] = {
                    'written': int(row['written_frequency']),
                    'spoken': int(row['spoken_frequency']),
                    'rank': int(row['no']),
                    'grade': row['grade'],
                    'level': row['level'],
                }
    return frequency_data


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

    response = requests.post("http://localhost:8765", json=request_data)
    response.raise_for_status()
    result = response.json()

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    return result


def get_suspended_hanzi_characters():
    """
    Get all single characters from suspended Hanzi notes

    Returns:
        set: Set of characters that are suspended in Hanzi notes
    """
    print("=== Finding suspended Hanzi characters ===")

    # Find suspended Hanzi notes
    response = anki_connect_request("findNotes", {
        "query": "note:Hanzi is:suspended"
    })

    note_ids = response.get("result", [])
    print(f"Found {len(note_ids)} suspended Hanzi notes")

    if not note_ids:
        return set()

    # Get note info in batches
    suspended_chars = set()
    batch_size = 100

    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i:i + batch_size]
        notes_response = anki_connect_request("notesInfo", {"notes": batch_ids})
        notes_info = notes_response.get("result", [])

        for note_info in notes_info:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            # Only consider single character notes
            if len(traditional) == 1:
                suspended_chars.add(traditional)

    print(f"Found {len(suspended_chars)} suspended single-character Hanzi notes")
    return suspended_chars


def get_active_hanzi_characters():
    """
    Get all single characters from active (non-suspended) Hanzi notes

    Returns:
        set: Set of characters that are active in Hanzi notes
    """
    print("\n=== Finding active Hanzi characters ===")

    # Find non-suspended Hanzi notes
    response = anki_connect_request("findNotes", {
        "query": "note:Hanzi -is:suspended"
    })

    note_ids = response.get("result", [])
    print(f"Found {len(note_ids)} active Hanzi notes")

    if not note_ids:
        return set()

    # Get note info in batches
    active_chars = set()
    batch_size = 100

    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i:i + batch_size]
        notes_response = anki_connect_request("notesInfo", {"notes": batch_ids})
        notes_info = notes_response.get("result", [])

        for note_info in notes_info:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            # Only consider single character notes
            if len(traditional) == 1:
                active_chars.add(traditional)

    print(f"Found {len(active_chars)} active single-character Hanzi notes")
    return active_chars


def count_characters_in_phrases(note_types, target_chars):
    """
    Count frequency of target characters in phrase notes

    Args:
        note_types (list): List of note types to process
        target_chars (set): Set of characters to count

    Returns:
        Counter: Character frequency counts
    """
    print("\n=== Counting characters in phrases ===")
    char_counter = Counter()

    for note_type in note_types:
        print(f"\nProcessing {note_type} notes...")

        response = anki_connect_request("findNotes", {
            "query": f"note:{note_type}"
        })

        note_ids = response.get("result", [])
        print(f"  Found {len(note_ids)} notes")

        if not note_ids:
            continue

        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i:i + batch_size]
            notes_response = anki_connect_request("notesInfo", {"notes": batch_ids})
            notes_info = notes_response.get("result", [])

            for note_info in notes_info:
                traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()

                if not traditional:
                    continue

                # Clean the traditional text
                # Remove HTML tags
                traditional = re.sub(r'<[^>]+>', '', traditional)
                # Remove punctuation and non-Chinese characters
                traditional = re.sub(r'[^\u4e00-\u9fff]', '', traditional)

                # Count each character that's in our target set
                for char in traditional:
                    if char in target_chars:
                        char_counter[char] += 1

    return char_counter


def main():
    """
    Main function to find most frequent suspended characters in phrases
    """
    parser = argparse.ArgumentParser(
        description="Find most frequent suspended Hanzi characters in phrase notes"
    )
    parser.add_argument(
        "-n", "--top",
        type=int,
        default=50,
        help="Number of top characters to display (default: 50)"
    )
    parser.add_argument(
        "--note-types",
        nargs="+",
        default=["TOCFL"],
        help="Note types to search in (default: TOCFL Dangdai MyWords)"
    )
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument(
        "--csv-written",
        action="store_true",
        help="Use written frequency from data/frequency.csv instead of phrase counts"
    )
    source_group.add_argument(
        "--csv-spoken",
        action="store_true",
        help="Use spoken frequency from data/frequency.csv instead of phrase counts"
    )
    args = parser.parse_args()

    # Determine source mode
    if args.csv_written:
        source_mode = "written"
        freq_label = "Written"
    elif args.csv_spoken:
        source_mode = "spoken"
        freq_label = "Spoken"
    else:
        source_mode = "phrases"
        freq_label = "Count"

    print("=" * 60)
    print(f"Finding most frequent suspended characters ({source_mode})")
    print("=" * 60)

    # Step 1: Get suspended Hanzi characters
    suspended_chars = get_suspended_hanzi_characters()

    if not suspended_chars:
        print("\nNo suspended Hanzi characters found. Nothing to do.")
        return

    # Step 2: Get active Hanzi characters (for summary)
    active_chars = get_active_hanzi_characters()

    # Step 3: Get character frequencies based on source mode
    if source_mode == "phrases":
        char_counts = count_characters_in_phrases(args.note_types, suspended_chars)
        if not char_counts:
            print("\nNo suspended characters found in phrase notes.")
            return
        sorted_chars = char_counts.most_common(args.top)
    else:
        # Load frequency data from CSV
        script_dir = Path(__file__).parent
        csv_path = script_dir.parent.parent / "data" / "frequency.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"Frequency CSV not found at {csv_path}")

        print(f"\nLoading frequency data from {csv_path}")
        frequency_data = load_frequency_data(csv_path)
        print(f"Loaded frequency data for {len(frequency_data)} characters")

        # Filter to only suspended characters and sort by frequency
        char_counts = Counter()
        for char in suspended_chars:
            if char in frequency_data:
                char_counts[char] = frequency_data[char][source_mode]

        if not char_counts:
            print(f"\nNo suspended characters found in frequency data.")
            return
        sorted_chars = char_counts.most_common(args.top)

    # Step 4: Display results
    print("\n" + "=" * 60)
    print(f"Top {args.top} most frequent suspended characters ({source_mode})")
    print("=" * 60)
    print(f"{'Rank':<6}{'Char':<6}{freq_label:<10}")
    print("-" * 22)

    for rank, (char, count) in enumerate(sorted_chars, 1):
        print(f"{rank:<6}{char:<6}{count:<10}")

    # Summary statistics
    total_chars = len(char_counts)
    total_occurrences = sum(char_counts.values())
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total suspended characters found in phrases: {total_chars}")
    print(f"Total occurrences: {total_occurrences}")
    print(f"Suspended Hanzi characters: {len(suspended_chars)}")
    print(f"Active Hanzi characters: {len(active_chars)}")


if __name__ == "__main__":
    main()
