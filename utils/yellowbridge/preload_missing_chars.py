#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Preload missing character data from YellowBridge.

This script analyzes all JSON files in public/data/yellowbridge/info/ to find
characters that are referenced but don't have their own data files yet.
It then opens YellowBridge pages for these characters in the default browser
to trigger data collection.
"""

import json
import time
import webbrowser
from pathlib import Path
from typing import Set
from urllib.parse import quote
import requests
from collections import Counter
import subprocess
import sys

# Characters that cannot be loaded from YellowBridge
BLACKLISTED_CHARS = {
    '∋',  # Mathematical symbol, not a Chinese character
    '∈',  # Mathematical symbol, not a Chinese character
    '㇆',  # CJK stroke, not a full character
    'フ',  # Japanese Katakana, not a Chinese character
    '㇏',  # CJK stroke, not a full character
    '屮',
    '艹',
    '&amp;R_S7;',
    '&R_S7;',
    '◎',
    '𰻞', # biang :-(
    '㇚',
    '𬜯',
    '𭕆',
}


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


def find_all_notes_with_traditional(note_type, extra_filter):
    """
    Find all notes with Traditional field

    Args:
        note_type (str): The note type to search
        extra_filter (str): Additional filter criteria

    Returns:
        list: List of note IDs
    """
    search_query = f'note:{note_type} Traditional:_* ' + extra_filter

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


def extract_referenced_chars(json_data: dict) -> Set[str]:
    """Extract all characters referenced in a JSON data structure."""
    chars = set()

    # Extract from functional components
    if 'functionalComponents' in json_data:
        for comp_type in ['phonetic', 'semantic', 'primitive']:
            if comp_type in json_data['functionalComponents']:
                for comp in json_data['functionalComponents'][comp_type]:
                    if 'character' in comp:
                        chars.add(comp['character'])

    # Extract from radical
    if 'radical' in json_data and json_data['radical']:
        if 'character' in json_data['radical']:
            chars.add(json_data['radical']['character'])

    # Extract from all components
    if 'allComponents' in json_data:
        for comp in json_data['allComponents']:
            if 'character' in comp:
                chars.add(comp['character'])

    # Extract from formation methods
    if 'formationMethods' in json_data:
        for method in json_data['formationMethods']:
            if 'referencedCharacters' in method:
                for char in method['referencedCharacters']:
                    chars.add(char)

    # Extract from simplification
    if 'simplification' in json_data and json_data['simplification']:
        if 'simplifiedForm' in json_data['simplification']:
            chars.add(json_data['simplification']['simplifiedForm'])

    return chars


def is_punctuation(char: str) -> bool:
    """Check if a character is punctuation that should be skipped."""
    # Common Chinese and Western punctuation marks
    punctuation = {
        '，', '。', '！', '？', '；', '：', '、', '（', '）', '【', '】',
        '「', '」', '『', '』', '〈', '〉', '《', '》', '〔', '〕', '〖', '〗',
        '–', '—', '…', '·', '～', '＂', '＇', '‧', '･',
        ',', '.', '!', '?', ';', ':', '(', ')', '[', ']', '{', '}',
        '"', "'", '-', '_', '/', '\\', '|', '<', '>', '~', '`',
        '@', '#', '$', '%', '^', '&', '*', '+', '=',
    }
    return char in punctuation


def get_anki_characters(note_type="Hanzi", extra_filter=""):
    """
    Get all characters from Anki notes with Traditional field

    Args:
        note_type (str): The note type to search (default: "Hanzi")
        extra_filter (str): Additional filter criteria (default: "")

    Returns:
        tuple: (set of characters, Counter of character frequency)
    """
    anki_chars = set()
    char_frequency = Counter()
    BATCH_SIZE = 100  # Process 100 notes at a time

    print(f"\nFetching characters from Anki note type: {note_type}")
    print(f"Filter: {extra_filter}")

    note_ids = find_all_notes_with_traditional(note_type, extra_filter)

    if not note_ids:
        return anki_chars, char_frequency

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
                    # Filter out punctuation
                    chars = {char for char in chars if not is_punctuation(char)}
                    anki_chars.update(chars)
                    char_frequency.update(chars)
        except Exception as e:
            print(f"  Error processing batch starting at note {i}: {e}")

    print(f"Extracted {len(anki_chars)} unique characters from {len(note_ids)} Anki notes")
    return anki_chars, char_frequency


def get_dong_chars(dong_dir: Path) -> Set[str]:
    """Get all characters from Dong Chinese filenames."""
    all_chars = set()

    if not dong_dir.exists():
        print(f"\nWarning: Dong directory not found: {dong_dir}")
        return all_chars

    json_files = list(dong_dir.glob('*.json'))

    print(f"\nScanning {len(json_files)} files in {dong_dir}...")

    for file_path in json_files:
        # Extract character from filename (filename is the character itself)
        char = file_path.stem
        if char and not is_punctuation(char):
            all_chars.add(char)

    print(f"Found {len(all_chars)} unique characters from Dong Chinese filenames")
    return all_chars


def get_all_referenced_chars(info_dir: Path) -> Set[str]:
    """Get all characters referenced across all info files."""
    all_chars = set()
    existing_files = set()

    json_files = sorted(info_dir.glob('*.json'))

    print(f"\nScanning {len(json_files)} files in {info_dir}...")

    for file_path in json_files:
        # Track which characters already have files
        existing_files.add(file_path.stem)

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Extract all referenced characters
            referenced = extract_referenced_chars(data)
            # Filter out punctuation
            referenced = {char for char in referenced if not is_punctuation(char)}
            all_chars.update(referenced)

        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")

    print(f"Found {len(all_chars)} unique referenced characters in YellowBridge files")
    return all_chars, existing_files


def open_yellowbridge_url(char: str, delay: float = 2.0):
    """Open YellowBridge character dictionary page for the given character."""
    # URL encode the character
    encoded_char = quote(char)
    url = f"https://www.yellowbridge.com/chinese/character-dictionary.php?zi={encoded_char}"

    print(f"Opening browser for: {char} ({url})")
    webbrowser.open_new_tab(url)

    # Add delay to avoid overwhelming the browser/server
    time.sleep(delay)


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Preload missing YellowBridge character data'
    )
    parser.add_argument(
        '--info-dir',
        type=Path,
        default=Path('public/data/yellowbridge/info'),
        help='Directory containing processed character JSON files'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=0.2,
        help='Delay in seconds between opening browser tabs (default: 2.0)'
    )
    parser.add_argument(
        '--max-chars',
        type=int,
        help='Maximum number of characters to open (for testing)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be opened without actually opening browser'
    )
    parser.add_argument(
        '--note-type',
        type=str,
        default='Hanzi',
        help='Anki note type to search (default: Hanzi)'
    )
    parser.add_argument(
        '--anki-filter',
        type=str,
        default='',
        help='Additional Anki search filter (default: "")'
    )
    parser.add_argument(
        '--skip-anki',
        action='store_true',
        help='Skip fetching characters from Anki'
    )
    parser.add_argument(
        '--dong-dir',
        type=Path,
        default=Path('public/data/dong'),
        help='Directory containing Dong Chinese JSON files'
    )

    args = parser.parse_args()

    if not args.info_dir.exists():
        print(f"Error: Directory not found: {args.info_dir}")
        return 1

    # Get all referenced characters and existing files from YellowBridge JSON
    ref_chars, existing_files = get_all_referenced_chars(args.info_dir)

    # Get characters from Dong Chinese filenames
    dong_chars = get_dong_chars(args.dong_dir)

    # Get characters from Anki (unless skipped)
    anki_chars = set()
    char_frequency = Counter()

    if not args.skip_anki:
        try:
            anki_chars, char_frequency = get_anki_characters(args.note_type, args.anki_filter)
        except Exception as e:
            print(f"\nWarning: Could not fetch Anki characters: {e}")
            print("Continuing with only referenced characters from YellowBridge files...")
            print("(Make sure Anki is running with AnkiConnect addon installed)")

    # Merge all characters
    all_chars = ref_chars | anki_chars | dong_chars

    # Find missing characters (not in existing files)
    missing_anki_chars = anki_chars - existing_files
    missing_ref_chars = ref_chars - existing_files
    missing_dong_chars = dong_chars - existing_files
    missing_chars = all_chars - existing_files

    # Filter out blacklisted characters
    blacklisted_found = missing_chars & BLACKLISTED_CHARS
    missing_chars = missing_chars - BLACKLISTED_CHARS
    missing_anki_chars = missing_anki_chars - BLACKLISTED_CHARS
    missing_ref_chars = missing_ref_chars - BLACKLISTED_CHARS
    missing_dong_chars = missing_dong_chars - BLACKLISTED_CHARS

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency.get(c, 0), reverse=True)

    print(f"\n{'='*60}")
    print(f"Total unique characters from Anki: {len(anki_chars)}")
    print(f"Total referenced characters from YellowBridge: {len(ref_chars)}")
    print(f"Total unique characters from Dong Chinese: {len(dong_chars)}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"Existing files: {len(existing_files)}")

    if blacklisted_found:
        print(f"\nBlacklisted characters found (skipping): {len(blacklisted_found)}")
        print(f"  {' '.join(sorted(blacklisted_found))}")

    print(f"\nMissing from Anki: {len(missing_anki_chars)}")
    print(f"Missing from YellowBridge references: {len(missing_ref_chars)}")
    print(f"Missing from Dong Chinese: {len(missing_dong_chars)}")
    print(f"Total missing characters: {len(missing_chars)}")

    if not missing_chars:
        print("\nNo missing characters found! All characters have data files.")
        return 0

    # Show top missing characters with frequency info
    print(f"\n{'='*60}")
    print("Top 30 most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:30], 1):
        freq = char_frequency.get(char, 0)
        sources = []
        if char in missing_anki_chars:
            sources.append("Anki")
        if char in missing_ref_chars:
            sources.append("Referenced")
        if char in missing_dong_chars:
            sources.append("Dong")
        source_str = "+".join(sources)
        freq_str = f"appears {freq} times" if freq > 0 else "referenced"
        print(f"  {i}. {char} ({freq_str}) [{source_str}]")

    if len(missing_chars) > 100:
        print(f"\n... and {len(missing_chars) - 30} more")

    if args.dry_run:
        print("\n(Dry run - not opening browser)")
        print(f"\nAll missing characters: {' '.join(missing_sorted)}")
        return 0

    # Apply max-chars limit if specified
    chars_to_open = missing_sorted
    if args.max_chars:
        chars_to_open = missing_sorted[:args.max_chars]
        print(f"\nLimiting to {args.max_chars} characters")

    print(f"\n{'='*60}")
    print(f"Opening browser tabs for {len(chars_to_open)} characters...")
    print("(You may need to allow pop-ups in your browser)")

    # Confirm before opening many tabs
    if len(chars_to_open) > 300:
        response = input(f"\nAbout to open {len(chars_to_open)} browser tabs. Continue? [y/N] ")
        if response.lower() != 'y':
            print("Cancelled.")
            return 0

    # Open browser tabs
    for i, char in enumerate(chars_to_open, 1):
        print(f"[{i}/{len(chars_to_open)}] ", end='')
        open_yellowbridge_url(char, args.delay)

    print(f"\n{'='*60}")
    print(f"Opened {len(chars_to_open)} browser tabs")
    print("\nWaiting 2 seconds for data collection...")
    time.sleep(2)

    # Verify that raw JSON files were created
    raw_dir = Path('public/data/yellowbridge/raw')
    missing_files = []

    print(f"\n{'='*60}")
    print("Verifying raw JSON files...")

    for char in chars_to_open:
        json_file = raw_dir / f"{char}.json"
        if not json_file.exists():
            missing_files.append(char)

    if missing_files:
        print(f"\n❌ ERROR: {len(missing_files)} character(s) missing raw JSON files:")
        for char in missing_files:
            print(f"  - {char} (expected: {raw_dir / f'{char}.json'})")
        print("\nPossible reasons:")
        print("1. Pages are still loading (try waiting longer)")
        print("2. Browser extension for data collection is not installed/running")
        print("3. YellowBridge returned an error for these characters")
        return 1

    print(f"✅ All {len(chars_to_open)} raw JSON files verified successfully")

    # Run the convert.py script to process the new data
    print(f"\n{'='*60}")
    print("Running convert.py to process the new data...")
    print(f"{'='*60}\n")

    convert_script = Path(__file__).parent / "convert.py"

    try:
        # Run convert.py and stream output in real time
        result = subprocess.run(
            [sys.executable, str(convert_script)],
            cwd=Path.cwd(),
            check=True
        )

        print(f"\n{'='*60}")
        print("✅ Successfully processed all new character data")
        print(f"{'='*60}")

        return result.returncode

    except subprocess.CalledProcessError as e:
        print(f"\n{'='*60}")
        print(f"❌ ERROR: convert.py failed with exit code {e.returncode}")
        print(f"{'='*60}")
        return e.returncode
    except FileNotFoundError:
        print(f"\n❌ ERROR: Could not find convert.py at {convert_script}")
        print("\nPlease run the convert.py script manually to process the new data")
        return 1


if __name__ == '__main__':
    exit(main())
