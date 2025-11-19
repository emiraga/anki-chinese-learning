#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Preload missing character data from HanziYuan.
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

# Characters that cannot be loaded
BLACKLISTED_CHARS = {
    '㥁',
    '乗',
    '敻',
    '𤸰',
    '𠕋',
    '夀',
    '舺',
    '艶',
    '閲',
    '鋭',
    '搧',
    '衞',
    '凃',
    '藴',
    '緖',
}

def open_hanziyuan_url(char: str, delay: float = 2.0):
    """Open character dictionary page for the given character."""
    # URL encode the character
    encoded_char = quote(char)
    url = f"https://hanziyuan.net/#{encoded_char}"

    print(f"Opening browser for: {char} ({url})")
    webbrowser.open_new_tab(url)

    # Add delay to avoid overwhelming the browser/server
    time.sleep(delay)


def extract_components_from_json(json_file: Path) -> Set[str]:
    """Extract all component characters from a converted JSON file."""
    components = set()

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Extract components from characterDecomposition
        char_decomp = data.get('characterDecomposition', {})
        comp_list = char_decomp.get('components', [])

        for comp in comp_list:
            component = comp.get('component', '')
            if component:
                # Extract only CJK characters from the component field
                # (component may contain English descriptions or pinyin)
                # Normalize to handle compatibility variants
                chars = extract_all_characters(component, normalize=True)
                components.update(chars)

    except (json.JSONDecodeError, KeyError, FileNotFoundError) as e:
        print(f"Warning: Error reading {json_file}: {e}")

    return components


def get_all_components_from_converted(converted_dir: Path) -> Set[str]:
    """Get all component characters from all converted JSON files."""
    all_components = set()

    if not converted_dir.exists():
        return all_components

    json_files = list(converted_dir.glob("*.json"))

    for json_file in json_files:
        components = extract_components_from_json(json_file)
        all_components.update(components)

    return all_components


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Preload missing HanziYuan character data'
    )
    parser.add_argument(
        '--info-dir',
        type=Path,
        default=Path('public/data/hanziyuan/converted'),
        help='Directory containing processed character JSON files'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=0.5,
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
    parser.add_argument(
        '--skip-folders',
        action='store_true',
        help='Skip loading characters from data directories'
    )

    args = parser.parse_args()

    if not args.info_dir.exists():
        print(f"Error: Directory not found: {args.info_dir}")
        return 1

    # Get the project root
    project_root = Path.cwd()

    # Use shared utility to discover all characters from Anki and data directories
    # IMPORTANT: Use normalize=True to convert compatibility variants (like U+FA17)
    # to their canonical forms (like U+76CA)
    all_chars, char_frequency = discover_all_characters(
        project_root,
        include_anki=not args.skip_anki,
        include_folders=not args.skip_folders,
        normalize=True
    )

    # Extract components from existing converted JSON files
    component_chars = get_all_components_from_converted(args.info_dir)

    # Combine all characters with components
    all_chars = all_chars | component_chars

    # Get existing info files to find what's missing
    existing_files = set()
    if args.info_dir.exists():
        for json_file in args.info_dir.glob("*.json"):
            existing_files.add(json_file.stem)

    print(f"\n{'='*60}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"  - Component characters from converted files: {len(component_chars)}")
    print(f"Existing files: {len(existing_files)}")
    # print(f"Referenced characters from YellowBridge: {len(ref_chars)}")

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
        open_hanziyuan_url(char, args.delay)

    print(f"\n{'='*60}")
    print(f"Opened {len(chars_to_open)} browser tabs")
    print("\nWaiting 10 seconds for data collection...")
    time.sleep(10)

    # Verify that raw JSON files were created
    raw_dir = Path('public/data/hanziyuan/raw')
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
        print("3. HanziYuan returned an error for these characters")
        return 1

    print(f"✅ All {len(chars_to_open)} raw JSON files verified successfully")

    # Run the convert.py script to process the new data
    print(f"\n{'='*60}")
    # print("Running convert.py to process the new data...")
    # print(f"{'='*60}\n")

    # convert_script = Path(__file__).parent / "convert.py"

    # try:
    #     # Run convert.py and stream output in real time
    #     result = subprocess.run(
    #         [sys.executable, str(convert_script)],
    #         cwd=Path.cwd(),
    #         check=True
    #     )

    #     print(f"\n{'='*60}")
    #     print("✅ Successfully processed all new character data")
    #     print(f"{'='*60}")

    #     return result.returncode

    # except subprocess.CalledProcessError as e:
    #     print(f"\n{'='*60}")
    #     print(f"❌ ERROR: convert.py failed with exit code {e.returncode}")
    #     print(f"{'='*60}")
    #     return e.returncode
    # except FileNotFoundError:
    #     print(f"\n❌ ERROR: Could not find convert.py at {convert_script}")
    #     print("\nPlease run the convert.py script manually to process the new data")
    #     return 1


if __name__ == '__main__':
    exit(main())
