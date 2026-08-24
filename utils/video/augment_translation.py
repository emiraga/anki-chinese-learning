#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "google-cloud-translate>=3.15.0",
#   "requests",
# ]
# ///

"""
Fill empty Translation2 fields on LocalMediaClips notes with Google translations.

This script finds every LocalMediaClips note whose Translation2 field is empty
while its Traditional field has content, translates the Traditional text with
the Google Cloud Translation API, and saves the result into Translation2.

Usage:
    ./augment_translation.py
    ./augment_translation.py --dry-run
    ./augment_translation.py --limit 10
    ./augment_translation.py --credentials /path/to/credentials.json
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_notes_info, update_note_fields
from shared.translation_utils import cache_translation, get_translation_cache, translate_text_with_google

NOTE_TYPE = "LocalMediaClips"
SOURCE_FIELD = "Traditional"
DEST_FIELD = "Translation2"


def find_notes_with_empty_translation2() -> list[int]:
    """
    Find LocalMediaClips notes with a non-empty Traditional field and an empty
    Translation2 field.

    Returns:
        List of note IDs
    """
    # Anki search: a field name followed by a bare ":" matches an empty field.
    search_query = f"note:{NOTE_TYPE} {SOURCE_FIELD}:_* {DEST_FIELD}:"

    note_ids = find_notes_by_query(search_query)
    if note_ids:
        print(f"Found {len(note_ids)} note(s) with empty {DEST_FIELD} field in {NOTE_TYPE}")
    else:
        print(f"No notes found with empty {DEST_FIELD} field in {NOTE_TYPE}")
    return note_ids


def get_field_value(note: dict[str, Any], field_name: str) -> str:
    """Return the stripped value of a field from a note dictionary."""
    return note.get("fields", {}).get(field_name, {}).get("value", "").strip()


def augment_translation_for_note(note_id: int, dry_run: bool = False) -> bool:
    """
    Translate the Traditional field of a note into its Translation2 field.

    Args:
        note_id: The note ID to process
        dry_run: If True, only print what would be done without updating Anki

    Returns:
        True if the note was (or would be) updated, False if it was skipped
    """
    note = get_notes_info([note_id])[0]

    traditional = get_field_value(note, SOURCE_FIELD)
    current_translation2 = get_field_value(note, DEST_FIELD)

    if not traditional:
        print(f"Note {note_id}: no {SOURCE_FIELD} content, skipping")
        return False

    if current_translation2:
        # Not expected for notes matched by the search, but cache it in case
        # another note with the same Traditional text still needs translating.
        cache_translation(traditional, current_translation2)
        print(f"Note {note_id}: {DEST_FIELD} already has content, skipping")
        return False

    print(f"Note {note_id}: translating {SOURCE_FIELD}...")
    translation = translate_text_with_google(traditional)
    print(f"  {SOURCE_FIELD}: {traditional[:80]}{'...' if len(traditional) > 80 else ''}")
    print(f"  {DEST_FIELD}: {translation[:80]}{'...' if len(translation) > 80 else ''}")

    if not dry_run:
        update_note_fields(note_id, {DEST_FIELD: translation})
        print(f"  Updated note {note_id}")
    else:
        print(f"  [DRY RUN] Would update note {note_id}")

    return True


def main() -> None:
    """Find LocalMediaClips notes with empty Translation2 and fill them."""
    parser = argparse.ArgumentParser(
        description=f"Fill empty {DEST_FIELD} fields on {NOTE_TYPE} notes using Google Cloud Translation API"
    )
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without updating Anki")
    parser.add_argument(
        "--credentials",
        type=str,
        help="Path to Google Cloud credentials JSON file (default: utils/tts/gcloud_account.json)",
    )
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N matching notes")

    args = parser.parse_args()

    # Get the project root directory
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent

    # Set up credentials
    credentials_path = Path(args.credentials) if args.credentials else project_root / "utils" / "tts" / "gcloud_account.json"

    if not credentials_path.exists():
        print(f"Error: Credentials file not found: {credentials_path}")
        sys.exit(1)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(credentials_path)

    if args.dry_run:
        print("Running in DRY RUN mode - no notes will be modified\n")

    note_ids = find_notes_with_empty_translation2()
    if not note_ids:
        sys.exit(0)

    if args.limit is not None:
        note_ids = note_ids[: args.limit]
        print(f"Limiting to the first {len(note_ids)} note(s)")

    updated_count = 0
    skipped_count = 0
    failed_count = 0

    for note_id in note_ids:
        try:
            if augment_translation_for_note(note_id, dry_run=args.dry_run):
                updated_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            failed_count += 1
            print(f"Error processing note {note_id}: {e}")

    print(f"\n{'Would update' if args.dry_run else 'Updated'} {updated_count} note(s)")
    print(f"Skipped {skipped_count} note(s)")
    if failed_count:
        print(f"Failed {failed_count} note(s)")
    print(f"Translation cache: {len(get_translation_cache())} unique texts cached")


if __name__ == "__main__":
    main()
