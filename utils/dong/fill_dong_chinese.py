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


def load_dong_character(character):
    """
    Load the Dong Chinese character data for a given character

    Args:
        character (str): The Chinese character

    Returns:
        dict: Character data or None if not found
    """
    # Construct the path to the JSON file
    dong_dir = Path(__file__).parent.parent.parent / "public" / "data" / "dong"
    json_file = dong_dir / f"{character}.json"

    if not json_file.exists():
        return None

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading Dong Chinese data for {character}: {e}")
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


def format_component_type(component_types):
    """
    Format component type labels with colors

    Args:
        component_types (list): List of type strings

    Returns:
        str: HTML formatted type labels
    """
    TYPE_COLORS = {
        "deleted": "#9ca3af",
        "sound": "#2563eb",
        "iconic": "#16a34a",
        "meaning": "#dc2626",
        "remnant": "#9333ea",
        "distinguishing": "#0891b2",
        "simplified": "#db2777",
        "unknown": "#4b5563",
    }

    TYPE_LABELS = {
        "deleted": "Deleted",
        "sound": "Sound",
        "iconic": "Iconic",
        "meaning": "Meaning",
        "remnant": "Remnant",
        "distinguishing": "Distinguishing",
        "simplified": "Simplified",
        "unknown": "Unknown",
    }

    labels = []
    for comp_type in component_types:
        label = TYPE_LABELS.get(comp_type, comp_type.title())
        color = TYPE_COLORS.get(comp_type, "#4b5563")
        labels.append(f'<span style="color: {color}; font-weight: 600;">{label}</span>')

    return " ".join(labels) + (" component" if "deleted" not in component_types else "")


def get_component_info(component_char, dong_data):
    """
    Get pronunciation and meaning for a component character

    Args:
        component_char (str): The component character
        dong_data (dict): Dong Chinese character data

    Returns:
        tuple: (pinyin, gloss) or (None, None)
    """
    pinyin = None
    gloss = None

    # Look for the component in the chars array
    if dong_data.get("chars"):
        for char_data in dong_data["chars"]:
            if char_data.get("char") == component_char:
                if char_data.get("pinyinFrequencies") and len(char_data["pinyinFrequencies"]) > 0:
                    pinyin = char_data["pinyinFrequencies"][0].get("pinyin")
                if not pinyin and char_data.get("oldPronunciations") and len(char_data.get("oldPronunciations", [])) > 0:
                    pinyin = char_data["oldPronunciations"][0].get("pinyin")
                gloss = char_data.get("gloss")
                break

    # If we didn't find pinyin in chars, check words array
    if not pinyin and dong_data.get("words"):
        for word in dong_data["words"]:
            if word.get("simp") == component_char or word.get("trad") == component_char:
                items = word.get("items", [])
                if items and len(items) > 0:
                    pinyin = items[0].get("pinyin")
                    # Only use words gloss if we don't have one from chars
                    if not gloss:
                        gloss = word.get("gloss")
                    break

    return pinyin, gloss


def generate_dong_etymology_html(dong_data):
    """
    Generate HTML for Dongchinese Etymology field

    Args:
        dong_data (dict): Dong Chinese character data

    Returns:
        str: HTML string or None if no data available
    """
    if not dong_data:
        return None

    html_parts = []

    if dong_data.get("gloss"):
        char_gloss = escape_html(dong_data["gloss"])
        html_parts.append(f'<p>Meaning: {char_gloss}</p>')

    # 1. Original Meaning (optional)
    if dong_data.get("originalMeaning"):
        original_meaning = escape_html(dong_data["originalMeaning"])
        html_parts.append(f'<p><strong>Original Meaning:</strong> {original_meaning}</p>')

    # 2. Etymology/Hint
    if dong_data.get("hint"):
        hint = escape_html(dong_data["hint"])
        html_parts.append(f'<p>{hint}</p>')

    # 3. Components
    if dong_data.get("components") and len(dong_data["components"]) > 0:
        html_parts.append("<ul>")

        for component in dong_data["components"]:
            comp_char = escape_html(component.get("character", ""))
            comp_types = component.get("type", [])
            type_label = format_component_type(comp_types)

            # Get pronunciation and meaning for the component
            pinyin, gloss = get_component_info(component.get("character", ""), dong_data)

            # Build component info line
            comp_info_parts = [f'<strong>{comp_char}</strong>']

            if pinyin:
                comp_info_parts.append(f'<em>{escape_html(pinyin)}</em>')

            comp_info_parts.append(type_label)

            if gloss:
                comp_info_parts.append(f'"{escape_html(gloss)}"')

            # Extract description from hint if available
            comp_hint = component.get("hint", "")
            if comp_hint:
                comp_hint = escape_html(comp_hint)
                html_parts.append(
                    f'<li>{" ".join(comp_info_parts)}: {comp_hint}</li>'
                )
            else:
                html_parts.append(
                    f'<li>{" ".join(comp_info_parts)}</li>'
                )

        html_parts.append("</ul>")

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


def update_dong_etymology_for_note_types(note_types, dry_run=False, limit=None, overwrite=False, character=None):
    """
    Update notes with Dongchinese Etymology for specified note types

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
            # Exclude notes that already have content in the Dongchinese Etymology field
            search_query += ' -"Dongchinese Etymology:_*"'

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

            # Load the Dong Chinese data from JSON file
            dong_data = load_dong_character(traditional)

            if not dong_data:
                # print(f"[{i}/{len(all_note_ids)}] Note {note_id} ({note_type}, {traditional}): No Dong Chinese data found, skipping")
                skipped_count += 1
                continue

            # Generate the etymology HTML
            etymology_html = generate_dong_etymology_html(dong_data)

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
                update_note_field(note_id, "Dongchinese Etymology", etymology_html)
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
        description='Fill Dongchinese Etymology field for notes in Anki',
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

This script generates HTML content for the "Dongchinese Etymology" field including:
  1. Original Meaning (if available)
  2. Etymology/Hint explaining character formation
  3. Components with types (meaning/sound/iconic/etc.) and descriptions

Component types are color-coded: Meaning (red), Sound (blue), Iconic (green),
Remnant (purple), Distinguishing (cyan), Simplified (pink), Unknown (gray).

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

    update_dong_etymology_for_note_types(
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character
    )


if __name__ == "__main__":
    main()
