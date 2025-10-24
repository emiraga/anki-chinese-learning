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
            return data.get("mnemonic", {}).get("html")
    except Exception as e:
        print(f"Error loading mnemonic for {character}: {e}")
        return None


def update_hanzi_mnemonics(dry_run=False, limit=None):
    """
    Update all Hanzi notes with Rtega mnemonics

    Args:
        dry_run (bool): If True, only print what would be updated without making changes
        limit (int): If specified, only process this many notes
    """
    note_ids = find_hanzi_notes()

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

            # Check if field already has content
            current_mnemonic = note_info['fields'].get('Rtega Mnemonic', {}).get('value', '').strip()

            if current_mnemonic:
                print(f"[{i}/{len(note_ids)}] Note {note_id} ({traditional}): Already has mnemonic, skipping")
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
    parser = argparse.ArgumentParser(description='Fill Rtega Mnemonic field for Hanzi notes')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually updating notes')
    parser.add_argument('--limit', type=int,
                       help='Limit number of notes to process (useful for testing)')
    args = parser.parse_args()

    update_hanzi_mnemonics(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
