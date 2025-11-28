#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

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


def load_hackchinese_outlier_data(character):
    """
    Load the HackChinese Outlier data for a given character

    Args:
        character (str): The Chinese character

    Returns:
        dict: Character data or None if not found
    """
    outlier_dir = Path(__file__).parent.parent.parent / "public" / "data" / "hackchinese" / "outlier"
    json_file = outlier_dir / f"{character}.json"

    if not json_file.exists():
        return None

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading HackChinese Outlier data for {character}: {e}")
        return None


def process_explanation_text(text):
    """
    Process explanation text: convert %% to paragraphs and remove excess newlines

    Args:
        text (str): Raw explanation text

    Returns:
        str: Processed HTML text
    """
    if not text:
        return None

    # Replace %% with paragraph breaks
    parts = text.split("%%")

    # Process each part: strip whitespace and wrap in <p> tags
    paragraphs = []
    for part in parts:
        part = part.strip()
        if part:
            paragraphs.append(f"<p>{part}</p>")

    return "\n".join(paragraphs)


def generate_hackchinese_outlier_html(outlier_data):
    """
    Generate HTML for HackChineseOutlier Etymology field

    Args:
        outlier_data (dict): HackChinese Outlier character data

    Returns:
        str: HTML string or None if no data available
    """
    if not outlier_data:
        return None

    # Use form_explanation_trad, fallback to form_explanation_simp
    explanation = outlier_data.get("form_explanation_trad")
    if not explanation:
        explanation = outlier_data.get("form_explanation_simp")

    if not explanation:
        return None

    return process_explanation_text(explanation)


def update_hackchinese_outlier_for_note_types(note_types, dry_run=False, limit=None, overwrite=False, character=None):
    """
    Update notes with HackChineseOutlier Etymology for specified note types

    Args:
        note_types (list): List of note type names to process (e.g., ["Hanzi", "TOCFL"])
        dry_run (bool): If True, only print what would be updated without making changes
        limit (int): If specified, only process this many notes total
        overwrite (bool): If True, overwrite existing content in the field
        character (str): If specified, only process this specific character
    """
    all_note_ids = []

    # Collect notes from all specified note types
    for note_type in note_types:
        # Build search query
        search_query = f'note:{note_type}'
        if character:
            search_query += f' Traditional:{character}'
        else:
            search_query += f' Traditional:_'

        if not overwrite:
            # Exclude notes that already have content in the HackChineseOutlier Etymology field
            search_query += ' -"HackChineseOutlier Etymology:_*"'

        response = anki_connect_request("findNotes", {"query": search_query})
        if response and response.get("result"):
            note_ids = response["result"]
            char_info = f" for character '{character}'" if character else ""
            print(f"Found {len(note_ids)} {note_type} notes{char_info}")
            all_note_ids.extend(note_ids)
        else:
            char_info = f" for character '{character}'" if character else ""
            print(f"No {note_type} notes found{char_info}")

    if not all_note_ids:
        print("No notes found to process")
        return

    print(f"\nTotal notes across all types: {len(all_note_ids)}")

    if limit and not character:
        all_note_ids = all_note_ids[:limit]
        print(f"Processing limited to {limit} notes")

    updated_count = 0
    skipped_count = 0
    error_count = 0
    no_outlier_data = set()

    for i, note_id in enumerate(all_note_ids, 1):
        try:
            note_info = get_note_info(note_id)
            note_type = note_info.get('modelName', 'Unknown')

            # Get the Traditional field (which contains the hanzi character)
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            traditional = traditional[0:1]

            if not traditional:
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}): No Traditional field, skipping")
                skipped_count += 1
                continue

            # Load the HackChinese Outlier data from JSON file
            outlier_data = load_hackchinese_outlier_data(traditional)

            if not outlier_data:
                no_outlier_data.add(traditional)
                skipped_count += 1
                continue

            # Generate the etymology HTML
            etymology_html = generate_hackchinese_outlier_html(outlier_data)

            if not etymology_html:
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): No etymology data to generate, skipping")
                skipped_count += 1
                continue

            if dry_run:
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): Would update with etymology")
                print(f"  Etymology HTML:\n{etymology_html}")
                updated_count += 1
            else:
                # Update the note
                update_note_field(note_id, "HackChineseOutlier Etymology", etymology_html)
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): Updated successfully")
                updated_count += 1

        except Exception as e:
            print(f"[{i}/{len(all_note_ids)}] Error processing note {note_id}: {e}")
            error_count += 1
            raise

    print("\n" + "="*60)
    print(f"Summary:")
    print(f"  Total notes: {len(all_note_ids)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    print(no_outlier_data)
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Fill HackChineseOutlier Etymology field for notes in Anki',
        epilog='''
Examples:
  %(prog)s --dry-run                           Preview changes without updating
  %(prog)s --dry-run --limit 5                 Preview first 5 notes only
  %(prog)s                                     Update all Hanzi notes
  %(prog)s --note-types Hanzi TOCFL            Update both Hanzi and TOCFL notes
  %(prog)s --limit 100                         Update first 100 notes only
  %(prog)s --character `                      Update specific character only
  %(prog)s --character ` --overwrite          Rebuild specific character

This script generates content for the "HackChineseOutlier Etymology" field from
HackChinese Outlier dictionary data. It uses form_explanation_trad and falls back
to form_explanation_simp if not available.

The script only updates empty fields and skips notes that already have content.
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
                       help='Process only this specific character (e.g., `)')
    parser.add_argument('--note-types', nargs='+', default=['Hanzi', 'TOCFL'], metavar='TYPE',
                       help='Note types to process (default: Hanzi, TOCFL). Examples: Hanzi, TOCFL')
    args = parser.parse_args()

    update_hackchinese_outlier_for_note_types(
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character
    )


if __name__ == "__main__":
    main()
