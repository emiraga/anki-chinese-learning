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


def load_yellowbridge_character(character):
    """
    Load the YellowBridge character data for a given character

    Args:
        character (str): The Chinese character

    Returns:
        dict: Character data or None if not found
    """
    # Construct the path to the JSON file
    yellowbridge_dir = Path(__file__).parent.parent.parent / "public" / "data" / "yellowbridge" / "info"
    json_file = yellowbridge_dir / f"{character}.json"

    if not json_file.exists():
        return None

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading YellowBridge data for {character}: {e}")
        return None


def escape_html(text):
    """
    Escape HTML special characters

    Args:
        text (str): Text to escape

    Returns:
        str: Escaped text
    """
    if not text:
        return text
    return (text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;"))


def format_component_info(component):
    """
    Format a component with pinyin and description

    Args:
        component (dict): Component information

    Returns:
        str: HTML formatted component
    """
    parts = [f'<strong>{escape_html(component["character"])}</strong>']

    if component.get("pinyin") and len(component["pinyin"]) > 0:
        pinyin_str = ", ".join(component["pinyin"])
        parts.append(f'<em>{escape_html(pinyin_str)}</em>')

    if component.get("description"):
        parts.append(f'"{escape_html(component["description"])}"')

    if component.get("isAltered"):
        parts.append('<span style="font-size: 0.75em; background-color: #fef3c7; color: #92400e; padding: 0.125rem 0.375rem; border-radius: 0.25rem;">altered</span>')

    return " ".join(parts)


def generate_yellowbridge_etymology_html(yb_data):
    """
    Generate HTML for Yellowbridge Ethymology field

    Args:
        yb_data (dict): YellowBridge character data

    Returns:
        str: HTML string or None if no data available
    """
    if not yb_data:
        return None

    html_parts = []

    # 1. Definition
    if yb_data.get("definition"):
        definition = escape_html(yb_data["definition"])
        html_parts.append(f'<p><strong>Definition:</strong> {definition}</p>')

    # 2. Character Formation
    if yb_data.get("formationMethods") and len(yb_data["formationMethods"]) > 0:
        # html_parts.append('<p><strong>Character Formation:</strong></p>')
        html_parts.append('<ul>')

        for method in yb_data["formationMethods"]:
            type_english = escape_html(method.get("typeEnglish", ""))
            type_chinese = escape_html(method.get("typeChinese", ""))
            description = escape_html(method.get("description", ""))

            method_html = f'<li><strong>{type_english}</strong> ({type_chinese}): {description}'

            if method.get("referencedCharacters") and len(method["referencedCharacters"]) > 0:
                ref_chars = ", ".join([escape_html(c) for c in method["referencedCharacters"]])
                method_html += f' [{ref_chars}]'

            method_html += '</li>'
            html_parts.append(method_html)

        html_parts.append('</ul>')

    # 3. Functional Components (Phonetic and Semantic)
    functional_comps = yb_data.get("functionalComponents", {})
    has_phonetic = functional_comps.get("phonetic") and len(functional_comps["phonetic"]) > 0
    has_semantic = functional_comps.get("semantic") and len(functional_comps["semantic"]) > 0

    if has_phonetic or has_semantic:
        # html_parts.append('<p><strong>Functional Components:</strong></p>')
        html_parts.append('<ul>')

        if has_phonetic:
            html_parts.append('<li><strong style="color: #2563eb;">Phonetic (Sound):</strong>')
            html_parts.append('<ul>')
            for comp in functional_comps["phonetic"]:
                html_parts.append(f'<li>{format_component_info(comp)}</li>')
            html_parts.append('</ul>')
            html_parts.append('</li>')

        if has_semantic:
            html_parts.append('<li><strong style="color: #16a34a;">Semantic (Meaning):</strong>')
            html_parts.append('<ul>')
            for comp in functional_comps["semantic"]:
                html_parts.append(f'<li>{format_component_info(comp)}</li>')
            html_parts.append('</ul>')
            html_parts.append('</li>')

        html_parts.append('</ul>')

    # 4. Primitive Components
    has_primitive = functional_comps.get("primitive") and len(functional_comps["primitive"]) > 0

    if has_primitive:
        # html_parts.append('<p><strong>Primitive Components:</strong></p>')
        html_parts.append('<ul>')
        for comp in functional_comps["primitive"]:
            html_parts.append(f'<li>{format_component_info(comp)}</li>')
        html_parts.append('</ul>')

    if not html_parts:
        return None

    return "\n".join(html_parts)


def should_process_note(note_type, traditional):
    """
    Determine if a note should be processed based on note type and traditional field

    Args:
        note_type (str): The note type (e.g., "Hanzi", "TOCFL")
        traditional (str): The Traditional field content

    Returns:
        bool: True if note should be processed, False otherwise
    """
    return True


def update_yellowbridge_etymology_for_note_types(note_types, dry_run=False, limit=None, overwrite=False, character=None):
    """
    Update notes with Yellowbridge Ethymology for specified note types

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
            # Exclude notes that already have content in the Yellowbridge Ethymology field
            search_query += ' -"Yellowbridge Ethymology:_*"'

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

            # Check if this note should be processed based on note type rules
            if not should_process_note(note_type, traditional):
                # print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): Skipping (multi-character for TOCFL)")
                skipped_count += 1
                continue

            # Load the YellowBridge data from JSON file
            yb_data = load_yellowbridge_character(traditional)

            if not yb_data:
                # print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): No YellowBridge data found, skipping")
                skipped_count += 1
                continue

            # Generate the etymology HTML
            etymology_html = generate_yellowbridge_etymology_html(yb_data)

            if not etymology_html:
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): No etymology data to generate, skipping")
                skipped_count += 1
                continue

            if dry_run:
                print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): Would update with etymology")
                print(f"  Ethymology HTML:\n{etymology_html}")
                updated_count += 1
            else:
                # Update the note
                update_note_field(note_id, "Yellowbridge Ethymology", etymology_html)
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
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Fill Yellowbridge Ethymology field for notes in Anki',
        epilog='''
Examples:
  %(prog)s --dry-run                           Preview changes without updating
  %(prog)s --dry-run --limit 5                 Preview first 5 notes only
  %(prog)s                                     Update all Hanzi notes
  %(prog)s --note-types Hanzi TOCFL            Update both Hanzi and TOCFL notes
  %(prog)s --limit 100                         Update first 100 notes only
  %(prog)s --character 你                      Update specific character only
  %(prog)s --character 你 --overwrite          Rebuild specific character
  %(prog)s --note-types TOCFL --dry-run        Preview TOCFL single-character notes

This script generates HTML content for the "Yellowbridge Ethymology" field including:
  1. Definition
  2. Character Formation methods (with types and descriptions)
  3. Functional Components (Phonetic and Semantic)
  4. Primitive Components

Note: TOCFL notes are only processed if the Traditional field contains a single character.

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
                       help='Process only this specific character (e.g., 你)')
    parser.add_argument('--note-types', nargs='+', default=['Hanzi', 'TOCFL'], metavar='TYPE',
                       help='Note types to process (default: Hanzi, TOCFL). Examples: Hanzi, TOCFL')
    args = parser.parse_args()

    update_yellowbridge_etymology_for_note_types(
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character
    )


if __name__ == "__main__":
    main()
