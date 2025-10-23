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


def anki_connect_request(action, params=None):
    """
    Send a request to anki-connect

    Args:
        action (str): The action to perform
        params (dict): Parameters for the action

    Returns:
        dict: Response from anki-connect
    """
    import requests

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
    search_query = f'note:{note_type} Traditional:_* -is:suspended'

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


def get_existing_rtega_chars(rtega_data_dir):
    """
    Get set of characters that already have rtega data files

    Args:
        rtega_data_dir (Path): Path to the rtega data directory

    Returns:
        set: Set of characters with existing data files
    """
    existing_chars = set()

    if not rtega_data_dir.exists():
        print(f"Warning: RTEGA data directory does not exist: {rtega_data_dir}")
        return existing_chars

    for html_file in rtega_data_dir.glob("*.html"):
        # The filename is the character plus .html extension
        char = html_file.stem
        existing_chars.add(char)

    print(f"Found {len(existing_chars)} existing rtega character files")
    return existing_chars


def get_component_chars_from_rtega_files(rtega_data_dir):
    """
    Extract all referenced and related characters from existing rtega JSON files

    Args:
        rtega_data_dir (Path): Path to the rtega data directory

    Returns:
        tuple: (set of component characters, Counter of component frequency)
    """
    component_chars = set()
    component_frequency = Counter()

    if not rtega_data_dir.exists():
        print(f"Warning: RTEGA data directory does not exist: {rtega_data_dir}")
        return component_chars, component_frequency

    json_files = list(rtega_data_dir.glob("*.json"))
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
                        component_chars.update(chars)
                        component_frequency.update(chars)

                # Extract related_characters array
                related = data.get('related_characters', [])
                for char in related:
                    if char:
                        # Extract individual characters
                        chars = extract_all_characters(char)
                        component_chars.update(chars)
                        component_frequency.update(chars)

                # Extract additional_related_characters if present
                additional = data.get('additional_related_characters', [])
                if additional:
                    for char in additional:
                        if char:
                            # Extract individual characters
                            chars = extract_all_characters(char)
                            component_chars.update(chars)
                            component_frequency.update(chars)
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
            # Check if file has content
            if output_file.stat().st_size > 0:
                return True
            else:
                print(f"  Warning: Downloaded file is empty")
                output_file.unlink()  # Remove empty file
                return False
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


def main():
    # Get the project root directory (two levels up from this script)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    rtega_data_dir = project_root / "data" / "rtega"

    print(f"Project root: {project_root}")
    print(f"RTEGA data directory: {rtega_data_dir}")

    # Create rtega data directory if it doesn't exist
    rtega_data_dir.mkdir(parents=True, exist_ok=True)

    # Get all existing rtega character files
    existing_chars = get_existing_rtega_chars(rtega_data_dir)

    # Collect all characters from Anki
    anki_chars = set()
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
                        anki_chars.update(chars)
                        char_frequency.update(chars)
            except Exception as e:
                print(f"  Error processing batch starting at note {i}: {e}")

    # Get component characters from existing rtega files
    component_chars, component_frequency = get_component_chars_from_rtega_files(rtega_data_dir)

    # Merge all characters and frequencies
    all_chars = anki_chars | component_chars
    char_frequency.update(component_frequency)

    print(f"\n{'='*60}")
    print(f"Total unique characters in Anki: {len(anki_chars)}")
    print(f"Referenced/related characters in rtega files: {len(component_chars)}")
    print(f"Total unique characters (combined): {len(all_chars)}")
    print(f"Characters with rtega data: {len(existing_chars)}")

    # Find missing characters
    missing_anki_chars = anki_chars - existing_chars
    missing_component_chars = component_chars - existing_chars
    missing_chars = all_chars - existing_chars

    print(f"\nMissing from Anki: {len(missing_anki_chars)}")
    print(f"Missing from referenced/related: {len(missing_component_chars)}")
    print(f"Total missing characters: {len(missing_chars)}")

    if not missing_chars:
        print("\nAll characters have rtega data! Nothing to do.")
        return

    # Sort missing characters by frequency (most common first)
    missing_sorted = sorted(missing_chars, key=lambda c: char_frequency[c], reverse=True)

    print(f"\n{'='*60}")
    print("Top 20 most frequent missing characters:")
    for i, char in enumerate(missing_sorted[:20], 1):
        sources = []
        if char in missing_anki_chars:
            sources.append("Anki")
        if char in missing_component_chars:
            sources.append("Referenced/Related")
        source_str = "+".join(sources)
        print(f"  {i}. {char} (appears {char_frequency[char]} times) [{source_str}]")

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
        encoded_char = urllib.parse.quote(char)
        url = f"http://rtega.be/chmn/?c={encoded_char}"

        print(f"{i}/{len(missing_chars)}: Downloading {char} - {url}")

        if download_rtega_data(char, rtega_data_dir):
            success_count += 1
        else:
            failure_count += 1
            print(f"  Failed to download data for {char}")

        # Add a small delay to avoid overwhelming the server
        if i % 10 == 0:
            print(f"  Downloaded {i} files, pausing for longer...")
            time.sleep(5)
        else:
            time.sleep(1)

    print(f"\n{'='*60}")
    print("Done!")
    print(f"Successfully downloaded: {success_count}")
    print(f"Failed: {failure_count}")
    print(f"Data saved to: {rtega_data_dir}/")


if __name__ == "__main__":
    main()
