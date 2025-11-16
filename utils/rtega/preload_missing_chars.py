#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import os
import subprocess
import time
import json
from pathlib import Path
import urllib.parse
from collections import Counter
import argparse
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.character_discovery import discover_all_characters, extract_all_characters, normalize_cjk_char


def get_component_chars_from_rtega_files(rtega_data_dir):
    """
    Extract all referenced and related characters from existing rtega JSON files

    Args:
        rtega_data_dir (Path): Path to the rtega HTML data directory (data/rtega)
                               JSON files are in public/data/rtega

    Returns:
        tuple: (set of component characters, Counter of component frequency)
    """
    component_chars = set()
    component_frequency = Counter()

    # JSON files are in public/data/rtega, not data/rtega
    json_dir = rtega_data_dir.parent.parent / "public" / "data" / "rtega"

    if not json_dir.exists():
        print(f"Warning: RTEGA JSON directory does not exist: {json_dir}")
        return component_chars, component_frequency

    json_files = list(json_dir.glob("*.json"))
    print(f"\nScanning {len(json_files)} rtega JSON files for referenced/related characters...")

    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

                # Extract referenced_characters array
                referenced = data.get('referenced_characters', [])
                for char in referenced:
                    if char:
                        # Extract individual characters
                        chars = extract_all_characters(char)
                        # Normalize each character
                        normalized_chars = {normalize_cjk_char(c) for c in chars}
                        component_chars.update(normalized_chars)
                        component_frequency.update(normalized_chars)

                # Extract related_characters array
                related = data.get('related_characters', [])
                for char in related:
                    if char:
                        # Extract individual characters
                        chars = extract_all_characters(char)
                        # Normalize each character
                        normalized_chars = {normalize_cjk_char(c) for c in chars}
                        component_chars.update(normalized_chars)
                        component_frequency.update(normalized_chars)

                # Extract additional_related_characters if present
                additional = data.get('additional_related_characters', [])
                if additional:
                    for char in additional:
                        if char:
                            # Extract individual characters
                            chars = extract_all_characters(char)
                            # Normalize each character
                            normalized_chars = {normalize_cjk_char(c) for c in chars}
                            component_chars.update(normalized_chars)
                            component_frequency.update(normalized_chars)
        except Exception as e:
            print(f"  Warning: Error reading {json_file.name}: {e}")

    print(f"Found {len(component_chars)} unique referenced/related characters in rtega files")
    return component_chars, component_frequency


def download_rtega_data(char, rtega_data_dir):
    """
    Download RTEGA HTML data for a character using wget

    Args:
        char (str): The character to download data for
        rtega_data_dir (Path): Path to the rtega data directory

    Returns:
        bool: True if download successful, False otherwise
    """
    # URL encode the character
    encoded_char = urllib.parse.quote(char)
    url = f"http://rtega.be/chmn/?c={encoded_char}"

    # Output file path
    output_file = rtega_data_dir / f"{char}.html"

    try:
        # Use wget to download the file
        result = subprocess.run(
            ["wget", url, "-O", str(output_file), "-q"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0 and output_file.exists():
            # Check if file meets minimum size requirement
            file_size = output_file.stat().st_size
            if file_size < 9500:
                output_file.unlink()  # Remove undersized file
                raise Exception(f"Downloaded file for '{char}' is too small ({file_size} bytes, minimum 9500 bytes required). This likely indicates an error page or missing data.")
            return True
        else:
            print(f"  Error: wget failed with return code {result.returncode}")
            if result.stderr:
                print(f"  stderr: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  Error: wget timed out after 30 seconds")
        return False
    except FileNotFoundError:
        raise Exception("wget command not found. Please install wget: brew install wget")
    except Exception as e:
        print(f"  Error: {e}")
        return False


def download_char_with_progress(char, rtega_data_dir, index=None, total=None):
    """
    Download a single character with progress reporting

    Args:
        char (str): The character to download
        rtega_data_dir (Path): Path to the rtega data directory
        index (int, optional): Current index in batch (1-based)
        total (int, optional): Total number of characters to download

    Returns:
        bool: True if download successful, False otherwise
    """
    encoded_char = urllib.parse.quote(char)
    url = f"http://rtega.be/chmn/?c={encoded_char}"

    if index is not None and total is not None:
        print(f"{index}/{total}: Downloading {char} - {url}")
    else:
        print(f"Downloading {char} - {url}")

    success = download_rtega_data(char, rtega_data_dir)

    if success:
        # Show file size after successful download
        output_file = rtega_data_dir / f"{char}.html"
        file_size = output_file.stat().st_size
        # Format size in KB for readability
        size_kb = file_size / 1024
        print(f"  ✓ Downloaded {file_size:,} bytes ({size_kb:.1f} KB)")
    else:
        print(f"  Failed to download data for {char}")

    return success


def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Preload missing RTEGA character data")
    parser.add_argument(
        "--char", "-c",
        type=str,
        help="Download data for a single character instead of scanning for missing ones"
    )
    args = parser.parse_args()

    # Get the project root directory (two levels up from this script)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    rtega_data_dir = project_root / "data" / "rtega"

    print(f"Project root: {project_root}")
    print(f"RTEGA data directory: {rtega_data_dir}")

    # Create rtega data directory if it doesn't exist
    rtega_data_dir.mkdir(parents=True, exist_ok=True)

    # If single character mode, download just that character
    if args.char:
        char = normalize_cjk_char(args.char)
        print(f"\nSingle character mode: '{char}'")

        # Check if file already exists
        output_file = rtega_data_dir / f"{char}.html"
        if output_file.exists():
            print(f"Warning: Data file already exists: {output_file}")
            response = input("Overwrite existing file? (y/N): ")
            if response.lower() != 'y':
                print("Cancelled.")
                return

        if download_char_with_progress(char, rtega_data_dir):
            print(f"✓ Successfully downloaded data for '{char}'")
            print(f"Data saved to: {output_file}")
        else:
            print(f"✗ Failed to download data for '{char}'")
        return

    # Use shared utility to discover all characters from Anki and data directories
    all_chars, char_frequency = discover_all_characters(
        project_root,
        include_anki=True,
        normalize=True
    )

    # Get component characters from existing rtega files (script-specific)
    component_chars, component_frequency = get_component_chars_from_rtega_files(rtega_data_dir)
    all_chars.update(component_chars)
    char_frequency.update(component_frequency)

    # Get existing rtega characters to find what's missing
    existing_chars = set()
    if rtega_data_dir.exists():
        for html_file in rtega_data_dir.glob("*.html"):
            char = normalize_cjk_char(html_file.stem)
            existing_chars.add(char)

    print(f"\n{'='*60}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"Characters with rtega data: {len(existing_chars)}")
    print(f"Referenced/related characters in rtega files: {len(component_chars)}")

    # Find missing characters
    missing_chars = all_chars - existing_chars
    print(f"Total missing characters: {len(missing_chars)}")

    if not missing_chars:
        print("\nAll characters have rtega data! Nothing to do.")
        return

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency[c], reverse=True)

    print(f"\n{'='*60}")
    print("Top 20 most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:20], 1):
        print(f"  {i}. {char} (appears {char_frequency[char]} times)")

    # Ask user if they want to download the data
    print(f"\n{'='*60}")
    response = input(f"Download RTEGA data for {len(missing_chars)} missing characters? (y/N): ")

    if response.lower() != 'y':
        print("Cancelled. Here are all missing characters:")
        print("".join(missing_sorted))
        return

    # Confirm if there are many characters
    if len(missing_chars) > 50:
        response = input(f"WARNING: This will download {len(missing_chars)} files. Continue? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return

    # Download data for missing characters
    print(f"\nDownloading RTEGA data for missing characters...")
    success_count = 0
    failure_count = 0

    for i, char in enumerate(missing_sorted, 1):
        if download_char_with_progress(char, rtega_data_dir, i, len(missing_chars)):
            success_count += 1
        else:
            failure_count += 1

        # Add a small delay to avoid overwhelming the server
        if i % 10 == 0:
            print(f"  Downloaded {i} files, pausing for longer...")
            time.sleep(1)

    print(f"\n{'='*60}")
    print("Done!")
    print(f"Successfully downloaded: {success_count}")
    print(f"Failed: {failure_count}")
    print(f"Data saved to: {rtega_data_dir}/")

    # Run parse script if any files were successfully downloaded
    if success_count > 0:
        print(f"\n{'='*60}")
        print("Running parse_rtega_html.py to process downloaded files...")
        print(f"{'='*60}\n")

        parse_script = script_dir / "parse_rtega_html.py"

        try:
            # Run the parse script with real-time output
            result = subprocess.run(
                [str(parse_script)],
                cwd=project_root,
                text=True
            )

            print(f"\n{'='*60}")
            if result.returncode == 0:
                print("✓ Parse script completed successfully")
            else:
                print(f"✗ Parse script exited with code {result.returncode}")
            print(f"{'='*60}")

        except FileNotFoundError:
            print(f"Error: Parse script not found at {parse_script}")
        except Exception as e:
            print(f"Error running parse script: {e}")


if __name__ == "__main__":
    main()
