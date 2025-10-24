#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import os
import json
import requests
import argparse
import re
from pathlib import Path


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


def find_hanzi_notes():
    """
    Find all notes with note type "Hanzi"

    Returns:
        list: List of note IDs
    """
    search_query = 'note:Hanzi'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        print(f"Found {len(note_ids)} Hanzi notes")
        return note_ids

    print("No Hanzi notes found")
    return []


def get_note_info(note_id):
    """
    Get detailed information about a note

    Args:
        note_id (int): The note ID

    Returns:
        dict: Note information
    """
    response = anki_connect_request("notesInfo", {"notes": [note_id]})

    if response and response.get("result"):
        return response["result"][0]

    raise Exception(f"No note found for ID {note_id}")


def update_note_field(note_id, field_name, field_value):
    """
    Update a specific field of a note

    Args:
        note_id (int): The note ID
        field_name (str): Name of the field to update
        field_value (str): Value to set

    Returns:
        bool: True if successful, False otherwise
    """
    fields = {field_name: field_value}

    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": fields
        }
    })

    if response and response.get("error") is None:
        return True
    else:
        raise Exception(f"Failed to update field '{field_name}' for note {note_id}: {response.get('error')}")


def replace_hrefs_with_pleco_urls(html):
    """
    Replace href="?c=CHARACTER" with href="plecoapi://x-callback-url/df?hw=CHARACTER"

    Args:
        html (str): HTML content with character links

    Returns:
        str: HTML with Pleco API URLs
    """
    # Pattern matches: href="?c=CHARACTER"
    pattern = r'href="\?c=([^"]+)"'
    replacement = r'href="plecoapi://x-callback-url/df?hw=\1"'
    return re.sub(pattern, replacement, html)


def load_rtega_mnemonic(character):
    """
    Load the Rtega mnemonic HTML for a given character

    Args:
        character (str): The Chinese character

    Returns:
        str: HTML mnemonic or None if not found
    """
    # Construct the path to the JSON file
    rtega_dir = Path(__file__).parent.parent.parent / "public" / "data" / "rtega"
    json_file = rtega_dir / f"{character}.json"

    if not json_file.exists():
        return None

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            html = data.get("mnemonic", {}).get("html")
            if html:
                # Replace character links with Pleco API URLs
                html = replace_hrefs_with_pleco_urls(html)
            return html
    except Exception as e:
        print(f"Error loading mnemonic for {character}: {e}")
        return None


def update_hanzi_mnemonics(dry_run=False, limit=None, overwrite=False, character=None):
    """
    Update all Hanzi notes with Rtega mnemonics

    Args:
        dry_run (bool): If True, only print what would be updated without making changes
        limit (int): If specified, only process this many notes
        overwrite (bool): If True, overwrite existing content in the field
        character (str): If specified, only process notes with this character
    """
    # Build search query
    search_query = 'note:Hanzi Traditional:_'
    if character:
        search_query += f' Traditional:{character}'
    else:
        search_query += f' Traditional:_'

    if not overwrite:
        # Exclude notes that already have content in the Rtega Mnemonic field
        search_query += ' -"Rtega Mnemonic:_*"'

    response = anki_connect_request("findNotes", {"query": search_query})
    if response and response.get("result"):
        note_ids = response["result"]
        char_info = f" for character '{character}'" if character else ""
        print(f"Found {len(note_ids)} Hanzi notes{char_info}")
    else:
        char_info = f" for character '{character}'" if character else ""
        print(f"No Hanzi notes found{char_info}")
        return

    if limit:
        note_ids = note_ids[:limit]
        print(f"Processing limited to {limit} notes")

    updated_count = 0
    skipped_count = 0
    error_count = 0

    for i, note_id in enumerate(note_ids, 1):
        try:
            note_info = get_note_info(note_id)

            # Get the Traditional field (which contains the hanzi character)
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()

            if not traditional:
                print(f"[{i}/{len(note_ids)}] Note {note_id}: No Traditional field, skipping")
                skipped_count += 1
                continue

            # Load the mnemonic from JSON file
            mnemonic_html = load_rtega_mnemonic(traditional)

            if not mnemonic_html:
                print(f"[{i}/{len(note_ids)}] Note {note_id} ({traditional}): No mnemonic found, skipping")
                skipped_count += 1
                continue

            if dry_run:
                print(f"[{i}/{len(note_ids)}] Note {note_id} ({traditional}): Would update with mnemonic")
                print(f"  Mnemonic: {mnemonic_html}")
                updated_count += 1
            else:
                # Update the note
                update_note_field(note_id, "Rtega Mnemonic", mnemonic_html)
                print(f"[{i}/{len(note_ids)}] Note {note_id} ({traditional}): Updated successfully")
                updated_count += 1

        except Exception as e:
            print(f"[{i}/{len(note_ids)}] Error processing note {note_id}: {e}")
            error_count += 1

    print("\n" + "="*60)
    print(f"Summary:")
    print(f"  Total notes: {len(note_ids)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Fill Rtega Mnemonic field for Hanzi notes in Anki',
        epilog='''
Examples:
  %(prog)s --dry-run                    Preview changes without updating
  %(prog)s --dry-run --limit 5          Preview first 5 notes only
  %(prog)s --character 㒼                Update only the specific character
  %(prog)s                              Update all Hanzi notes
  %(prog)s --limit 100                  Update first 100 notes only
  %(prog)s --overwrite                  Overwrite existing mnemonics

This script loads Rtega mnemonic HTML from JSON files and fills the
"Rtega Mnemonic" field in Anki Hanzi notes.

The script only updates empty fields by default. Use --overwrite to update
fields that already have content.
Requires Anki running with AnkiConnect addon installed.
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually updating notes')
    parser.add_argument('--limit', type=int, metavar='N',
                       help='Limit number of notes to process (useful for testing)')
    parser.add_argument('--overwrite', action='store_true',
                       help='Overwrite existing content in the field (default: skip filled fields)')
    parser.add_argument('--character', type=str, metavar='CHAR',
                       help='Process only notes with this specific character')
    args = parser.parse_args()

    update_hanzi_mnemonics(dry_run=args.dry_run, limit=args.limit, overwrite=args.overwrite, character=args.character)


if __name__ == "__main__":
    main()
