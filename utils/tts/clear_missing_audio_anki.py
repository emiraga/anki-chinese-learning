#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Clear Audio / Sentence Audio fields whose [sound:...] file is missing from Anki's media folder.

A cleared field is empty again, so the next run of fill_audio_anki.py regenerates it.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import anki_connect_request, find_notes_by_query, iter_notes_info, update_note_fields

# The note types and audio fields that fill_audio_anki.py fills
_AUDIO_FIELDS_BY_NOTE_TYPE = {
    "TOCFL": ("Audio", "Sentence Audio"),
    "Hanzi": ("Audio",),
}

_SOUND_TAG = re.compile(r"\[sound:([^\]]+)\]")


def get_media_dir() -> Path:
    """Return the path of Anki's collection.media folder."""
    media_dir = Path(anki_connect_request("getMediaDirPath")["result"])
    if not media_dir.is_dir():
        raise FileNotFoundError(f"Anki media folder does not exist: {media_dir}")
    return media_dir


def list_media_files(media_dir: Path) -> set[str]:
    """
    Return the exact names of the files in media_dir.

    Compare against these rather than with Path.is_file(): macOS ignores case, so
    is_file() finds a file referenced in the wrong case, which AnkiDroid does not.
    """
    return {path.name for path in media_dir.iterdir() if path.is_file()}


def missing_sound_files(field_value: str, media_files: set[str]) -> list[str]:
    """Return the files referenced by [sound:...] tags in field_value that are not in media_files, matching case."""
    filenames = [html.unescape(name) for name in _SOUND_TAG.findall(field_value)]
    return [name for name in filenames if name not in media_files]


def clear_missing_audio(note_type: str, field_name: str, media_files: set[str], dry_run: bool) -> int:
    """
    Empty field_name on every note_type note that references a missing audio file.

    Returns:
        int: How many notes had the field cleared (or would have, with dry_run).
    """
    note_ids = find_notes_by_query(f'note:{note_type} "{field_name}:_*"')
    print(f"Checking {len(note_ids)} {note_type} note(s) with a non-empty {field_name} field")

    cleared = 0
    for note in iter_notes_info(note_ids):
        field = note["fields"].get(field_name)
        if field is None:
            continue
        missing = missing_sound_files(field["value"], media_files)
        if not missing:
            continue
        print(f"{'Would clear' if dry_run else 'Clearing'} {field_name} of note {note['noteId']}, missing: {', '.join(missing)}")
        if not dry_run:
            update_note_fields(note["noteId"], {field_name: ""})
        cleared += 1
    return cleared


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Only report the fields that would be cleared")
    args = parser.parse_args()

    media_dir = get_media_dir()
    print(f"Anki media folder: {media_dir}")
    media_files = list_media_files(media_dir)

    total = 0
    for note_type, field_names in _AUDIO_FIELDS_BY_NOTE_TYPE.items():
        for field_name in field_names:
            total += clear_missing_audio(note_type, field_name, media_files, args.dry_run)

    print(f"\n{'Would clear' if args.dry_run else 'Cleared'} {total} field(s) in total")


if __name__ == "__main__":
    main()
