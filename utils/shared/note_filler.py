"""
Shared driver for the scripts that fill one Anki field per character.

Several scripts do the same thing with different source data: pick the notes of
a few note types, read each note's Traditional character, look that character up
in a data directory, and write the rendered result into a single field. They
differ only in the field they write and in the renderer that turns a character
into that field's value, so everything else lives here:

    ./utils/dong/fill_dong_chinese.py            Dongchinese Etymology
    ./utils/yellowbridge/fill_yellowbridge_chinese.py  Yellowbridge Etymology
    ./utils/hackchinese/fill_hackchinese_outlier.py    HackChineseOutlier Etymology
    ./utils/rtega/fill_rtega_mnemonics.py        Rtega Mnemonic
"""

import argparse
from collections.abc import Callable

from .anki_utils import AnkiNoteInfo, find_notes_by_query, get_field_value, iter_notes_info, update_note_fields

DEFAULT_NOTE_TYPES = ["Hanzi", "TOCFL"]

FieldRenderer = Callable[[str], str | None]
"""
Builds the field's value for one character.

Returns None when the character has no data to write - a missing data file, or a
file that holds nothing worth putting on the note.
"""

NoteFilter = Callable[[str, str], bool]
"""Decides whether a note is eligible, from its note type and Traditional value."""


def build_arg_parser(description: str, epilog: str) -> argparse.ArgumentParser:
    """
    Build the argument parser these scripts share.

    Args:
        description: The script's one-line description
        epilog: The script's long help text, printed verbatim

    Returns:
        A parser accepting --dry-run, --limit, --overwrite, --character and --note-types
    """
    parser = argparse.ArgumentParser(
        description=description,
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without actually updating notes")
    parser.add_argument("--limit", type=int, metavar="N", help="Limit number of notes to process (useful for testing)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing content in the field (default: skip filled fields)")
    parser.add_argument("--character", type=str, metavar="CHAR", help="Process only this specific character (e.g., 你)")
    parser.add_argument(
        "--note-types",
        nargs="+",
        default=DEFAULT_NOTE_TYPES,
        metavar="TYPE",
        help=f"Note types to process (default: {', '.join(DEFAULT_NOTE_TYPES)})",
    )
    return parser


def _find_notes_to_fill(
    note_types: list[str],
    field_name: str,
    character: str | None,
    single_char_only: bool,
    overwrite: bool,
) -> list[int]:
    """Collect the note ids to consider, across all requested note types."""
    all_note_ids: list[int] = []
    char_info = f" for character '{character}'" if character else ""

    for note_type in note_types:
        query = f"note:{note_type}"
        if character:
            query += f" Traditional:{character}"
        else:
            # "Traditional:_" matches a single character, "Traditional:_*" any
            # non-empty value.
            query += " Traditional:_" if single_char_only else " Traditional:_*"

        if not overwrite:
            # Leave notes that already have something in the field alone.
            query += f' -"{field_name}:_*"'

        note_ids = find_notes_by_query(query)
        if note_ids:
            print(f"Found {len(note_ids)} {note_type} notes{char_info}")
            all_note_ids.extend(note_ids)
        else:
            print(f"No {note_type} notes found{char_info}")

    return all_note_ids


def fill_note_field(
    *,
    field_name: str,
    render: FieldRenderer,
    note_types: list[str],
    dry_run: bool = False,
    limit: int | None = None,
    overwrite: bool = False,
    character: str | None = None,
    single_char_only: bool = True,
    first_char_only: bool = True,
    note_filter: NoteFilter | None = None,
) -> None:
    """
    Fill one field on every note whose character the renderer has data for.

    Args:
        field_name: The Anki field to write (e.g. "Rtega Mnemonic")
        render: Builds the field's value for a character, or None to skip it
        note_types: Note types to process (e.g. ["Hanzi", "TOCFL"])
        dry_run: Print what would be written without touching Anki
        limit: Process at most this many notes (ignored with `character`)
        overwrite: Also process notes whose field already has content
        character: Process only the notes holding this character
        single_char_only: Only consider notes whose Traditional field is one
            character long; when False, any non-empty Traditional qualifies
        first_char_only: Render the first character of Traditional rather than
            its whole value
        note_filter: Extra eligibility check, given the note type and the
            Traditional value

    Raises:
        Exception: If AnkiConnect fails, or the renderer does
    """
    note_ids = _find_notes_to_fill(note_types, field_name, character, single_char_only, overwrite)

    if not note_ids:
        print("No notes found to process")
        return

    print(f"\nTotal notes across all types: {len(note_ids)}")

    if limit and not character:
        note_ids = note_ids[:limit]
        print(f"Processing limited to {limit} notes")

    print(f"\nFetching information for {len(note_ids)} note(s)...")
    notes: list[AnkiNoteInfo] = list(iter_notes_info(note_ids))

    updated_count = 0
    skipped_count = 0

    for i, note in enumerate(notes, 1):
        note_id = note["noteId"]
        note_type = note.get("modelName", "Unknown")
        progress = f"[{i}/{len(notes)}]"

        traditional = get_field_value(note, "Traditional")
        if first_char_only:
            traditional = traditional[:1]

        if not traditional:
            print(f"{progress} Note {note_id} ({note_type}): No Traditional field, skipping")
            skipped_count += 1
            continue

        if note_filter is not None and not note_filter(note_type, traditional):
            skipped_count += 1
            continue

        value = render(traditional)
        if not value:
            skipped_count += 1
            continue

        if dry_run:
            print(f"{progress} Note {note_id} ({note_type}, {traditional}): Would set {field_name}")
            print(f"  {field_name}:\n{value}")
        else:
            update_note_fields(note_id, {field_name: value})
            print(f"{progress} Note {note_id} ({note_type}, {traditional}): Updated successfully")
        updated_count += 1

    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Total notes: {len(notes)}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("=" * 60)
