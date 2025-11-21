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
from typing import Set, Tuple
from urllib.parse import quote
from collections import Counter
import subprocess
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.character_discovery import discover_all_characters, extract_all_characters

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
    '（',
    '，',
    '）',
    '。',
    '𮎷',
    '𫝀',
    '𪺍',
}


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


def get_all_referenced_chars(info_dir: Path) -> Tuple[Set[str], Counter]:
    """Get all characters referenced across all info files."""
    all_chars = set()
    char_frequency = Counter()

    if not info_dir.exists():
        print(f"Warning: YellowBridge info directory does not exist: {info_dir}")
        return all_chars, char_frequency

    json_files = sorted(info_dir.glob('*.json'))

    print(f"\nScanning {len(json_files)} files in {info_dir}...")

    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Extract all referenced characters
            referenced = extract_referenced_chars(data)
            all_chars.update(referenced)
            char_frequency.update(referenced)

        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")

    print(f"Found {len(all_chars)} unique referenced characters in YellowBridge files")
    return all_chars, char_frequency


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
        '--skip-anki',
        action='store_true',
        help='Skip fetching characters from Anki'
    )

    args = parser.parse_args()

    if not args.info_dir.exists():
        print(f"Error: Directory not found: {args.info_dir}")
        return 1

    # Get the project root
    project_root = Path.cwd()

    # Use shared utility to discover all characters from Anki and data directories
    all_chars, char_frequency = discover_all_characters(
        project_root,
        include_anki=not args.skip_anki,
        normalize=False
    )

    # Get referenced characters from YellowBridge JSON files (script-specific)
    ref_chars, ref_frequency = get_all_referenced_chars(args.info_dir)
    all_chars.update(ref_chars)
    char_frequency.update(ref_frequency)

    # Get existing yellowbridge info files to find what's missing
    existing_files = set()
    if args.info_dir.exists():
        for json_file in args.info_dir.glob("*.json"):
            existing_files.add(json_file.stem)

    print(f"\n{'='*60}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"Existing files: {len(existing_files)}")
    print(f"Referenced characters from YellowBridge: {len(ref_chars)}")

    # Find missing characters
    missing_chars = all_chars - existing_files

    # Filter out blacklisted characters
    blacklisted_found = missing_chars & BLACKLISTED_CHARS
    if blacklisted_found:
        print(f"\nBlacklisted characters found (skipping): {len(blacklisted_found)}")
        print(f"  {' '.join(sorted(blacklisted_found))}")
    missing_chars -= BLACKLISTED_CHARS

    print(f"Total missing characters: {len(missing_chars)}")

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency.get(c, 0), reverse=True)

    if not missing_chars:
        print("\nNo missing characters found! All characters have data files.")
        return 0

    # Show top missing characters with frequency info
    print(f"\n{'='*60}")
    print("Top 30 most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:30], 1):
        freq = char_frequency.get(char, 0)
        freq_str = f"appears {freq} times" if freq > 0 else "referenced"
        print(f"  {i}. {char} ({freq_str})")

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
