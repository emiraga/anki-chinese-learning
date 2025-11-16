#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import os
import webbrowser
import time
import json
from pathlib import Path
import urllib.parse
from collections import Counter
import argparse
import subprocess
import sys
import glob

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.character_discovery import discover_all_characters, extract_all_characters


def get_component_chars_from_dong_files(dong_data_dir, top_words_share_threshold=0.02):
    """
    Extract all component characters referenced in existing dong JSON files

    Args:
        dong_data_dir (Path): Path to the dong data directory
        top_words_share_threshold (float): Minimum share value for topWords to include (default: 0.4)

    Returns:
        tuple: (set of component characters, Counter of component frequency)
    """
    component_chars = set()
    component_frequency = Counter()
    description_chars = set()
    description_frequency = Counter()
    top_words_chars = set()
    top_words_frequency = Counter()

    if not dong_data_dir.exists():
        print(f"Warning: Dong data directory does not exist: {dong_data_dir}")
        return component_chars, component_frequency

    json_files = list(dong_data_dir.glob("*.json"))
    print(f"\nScanning {len(json_files)} dong JSON files for component, description, and topWords characters...")

    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

                # Extract components array
                components = data.get('components', [])
                for component in components:
                    char = component.get('character', '')
                    if char:
                        # Extract individual characters from the component
                        chars = extract_all_characters(char)
                        component_chars.update(chars)
                        component_frequency.update(chars)

                # Extract characters from hint/description field
                hint = data.get('hint', '')
                if hint:
                    chars = extract_all_characters(hint)
                    description_chars.update(chars)
                    description_frequency.update(chars)

                # Extract characters from topWords with share > threshold (from 'trad' field only)
                statistics = data.get('statistics', {})
                top_words = statistics.get('topWords', [])
                for word_entry in top_words:
                    share = word_entry.get('share', 0)
                    if share > top_words_share_threshold:
                        trad = word_entry.get('trad', '')
                        chars = extract_all_characters(trad)
                        top_words_chars.update(chars)
                        top_words_frequency.update(chars)

        except Exception as e:
            print(f"  Warning: Error reading {json_file.name}: {e}")

    print(f"Found {len(component_chars)} unique component characters in dong files")
    print(f"Found {len(description_chars)} unique description characters in dong files")
    print(f"Found {len(top_words_chars)} unique characters from topWords (share > {top_words_share_threshold})")

    all_ref_chars = component_chars | description_chars | top_words_chars
    all_ref_frequency = component_frequency + description_frequency + top_words_frequency

    return all_ref_chars, all_ref_frequency


def main():
    # Blacklist of characters to skip (e.g., special radicals, punctuation)
    BLACKLIST_CHARS = {'⺁', '⺀', '〢'}

    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description='Find and preload missing Chinese characters for dong-chinese data'
    )
    parser.add_argument(
        '--no-anki',
        action='store_true',
        help='Disable scanning Anki for characters'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit the number of characters to preload (processes most frequent first)'
    )
    args = parser.parse_args()

    # Get the project root directory (two levels up from this script)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    dong_data_dir = project_root / "public" / "data" / "dong"

    print(f"Project root: {project_root}")
    print(f"Dong data directory: {dong_data_dir}")

    # Use shared utility to discover all characters from Anki and data directories
    all_chars, char_frequency = discover_all_characters(
        project_root,
        include_anki=not args.no_anki,
        normalize=False
    )

    # Get component and description characters from existing dong files (script-specific)
    ref_chars, ref_frequency = get_component_chars_from_dong_files(dong_data_dir)
    all_chars.update(ref_chars)
    char_frequency.update(ref_frequency)

    # Get existing dong characters to find what's missing
    existing_chars = set()
    if dong_data_dir.exists():
        for json_file in dong_data_dir.glob("*.json"):
            existing_chars.add(json_file.stem)

    print(f"\n{'='*60}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"Characters with dong data: {len(existing_chars)}")
    print(f"Referenced characters in dong files (components + descriptions): {len(ref_chars)}")

    # Find missing characters
    missing_chars = all_chars - existing_chars

    # Filter out blacklisted characters
    blacklisted_found = missing_chars & BLACKLIST_CHARS
    if blacklisted_found:
        print(f"\nFiltering out {len(blacklisted_found)} blacklisted characters: {''.join(sorted(blacklisted_found))}")
        missing_chars -= BLACKLIST_CHARS

    print(f"Total missing characters: {len(missing_chars)}")

    if not missing_chars:
        print("\nAll characters have dong data! Nothing to do.")
        return

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency[c], reverse=True)

    # Apply limit if specified
    if args.limit is not None and args.limit > 0:
        missing_sorted = missing_sorted[:args.limit]
        print(f"\nLimiting to top {args.limit} most frequent characters")

    print(f"\n{'='*60}")
    print(f"Top {min(20, len(missing_sorted))} most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:20], 1):
        print(f"  {i}. {char} (appears {char_frequency[char]} times)")

    # Ask user if they want to open browser tabs
    print(f"\n{'='*60}")
    response = input(f"Open browser tabs for {len(missing_sorted)} missing characters? (y/N): ")

    if response.lower() != 'y':
        print("Cancelled. Here are all missing characters:")
        print("".join(missing_sorted))
        return

    # Confirm if there are many characters
    if len(missing_sorted) > 50:
        response = input(f"WARNING: This will open {len(missing_sorted)} browser tabs. Continue? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return

    # Open browser tabs for missing characters
    print(f"\nOpening browser tabs for missing characters...")
    for i, char in enumerate(missing_sorted, 1):
        encoded_char = urllib.parse.quote(char)
        url = f"https://www.dong-chinese.com/dictionary/search/{encoded_char}"

        print(f"{i}/{len(missing_sorted)}: Opening {char} - {url}")
        webbrowser.open_new_tab(url)

        # Add a small delay to avoid overwhelming the browser
        if i % 10 == 0:
            print(f"  Opened {i} tabs, pausing for longer...")
            time.sleep(2)
        else:
            time.sleep(0.4)

    print(f"\n{'='*60}")
    print("Done! All browser tabs opened.")
    print(f"\n{'='*60}")
    print("NEXT STEPS - Download the database:")
    print("1. In your browser, press Cmd+Shift+J (Mac) or Ctrl+Shift+J (Windows/Linux) to open Developer Console")
    print("2. Go to the 'Application' tab (or 'Storage' tab in Firefox)")
    print("3. In the left sidebar, expand 'IndexedDB'")
    print("4. Find and expand the database (likely named 'keyvaluepairs' or similar)")
    print("5. Right-click on the database and select 'Export' or 'Save'")
    print("6. Save the file to your ~/Downloads/ folder")
    print(f"\nThe populate script will look for: ~/Downloads/keyvaluepairs-*")
    print(f"Data will be saved to: {dong_data_dir}/")

    print(f"\n{'='*60}")
    response = input("Have you downloaded the database file to ~/Downloads/? (y/N): ")

    if response.lower() != 'y':
        print("\nNo problem! When you're ready, you can manually run:")
        print(f"  ./utils/dong/populate_dong_chars.py ~/Downloads/keyvaluepairs-* && rm -f ~/Downloads/keyvaluepairs-*")
        return

    # Run the populate script
    print(f"\n{'='*60}")
    print("Running populate script...")
    print(f"{'='*60}\n")

    populate_script = script_dir / "populate_dong_chars.py"
    downloads_pattern = str(Path.home() / "Downloads" / "keyvaluepairs-*")

    # Expand the wildcard pattern to find actual files
    matching_files = glob.glob(downloads_pattern)

    if not matching_files:
        print(f"ERROR: No files found matching pattern: {downloads_pattern}")
        print("Please ensure the database file is downloaded to ~/Downloads/")
        print("Then run manually:")
        print(f"  ./utils/dong/populate_dong_chars.py ~/Downloads/keyvaluepairs-* && rm -f ~/Downloads/keyvaluepairs-*")
        return

    if len(matching_files) > 1:
        print(f"WARNING: Found {len(matching_files)} matching files:")
        for f in matching_files:
            print(f"  - {f}")
        print("Using the first file...")

    input_file = matching_files[0]
    print(f"Using input file: {input_file}\n")

    try:
        # Run the populate script and stream output in real-time
        process = subprocess.Popen(
            [str(populate_script), input_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        # Stream output line by line
        if process.stdout:
            for line in process.stdout:
                print(line, end='')

        # Wait for process to complete
        return_code = process.wait()

        if return_code == 0:
            print(f"\n{'='*60}")
            print("SUCCESS! Cleaning up downloaded files...")
            # Remove all matching downloaded files
            for file_path in matching_files:
                try:
                    os.remove(file_path)
                    print(f"Removed: {file_path}")
                except Exception as e:
                    print(f"Warning: Could not remove {file_path}: {e}")
            print("Download files cleanup complete.")
            print(f"{'='*60}")
        else:
            print(f"\n{'='*60}")
            print(f"ERROR: Populate script failed with return code {return_code}")
            print("Downloaded files were NOT removed.")
            print(f"{'='*60}")

    except FileNotFoundError:
        print(f"ERROR: Could not find populate script at: {populate_script}")
        print("Please run manually:")
        print(f"  ./utils/dong/populate_dong_chars.py {input_file} && rm -f {input_file}")
    except Exception as e:
        print(f"ERROR: Failed to run populate script: {e}")
        print("Please run manually:")
        print(f"  ./utils/dong/populate_dong_chars.py {input_file} && rm -f {input_file}")


if __name__ == "__main__":
    main()
