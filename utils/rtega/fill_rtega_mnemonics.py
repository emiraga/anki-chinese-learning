#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill the "Rtega Mnemonic" field from the mnemonics parsed out of Rtega's pages.

The note walking, field writing and command-line handling are shared with the
other fill scripts (see utils/shared/note_filler.py); what lives here is the
mnemonic HTML this field holds.
"""

import re
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.note_filler import build_arg_parser, fill_note_field
from shared.project_paths import RTEGA_DIR, load_char_json

FIELD_NAME = "Rtega Mnemonic"


def replace_hrefs_with_pleco_urls(html: str) -> str:
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


def render_rtega_mnemonic(character: str) -> str | None:
    """
    Build the mnemonic HTML for one character, or None when Rtega has no mnemonic for it.

    Args:
        character (str): The Chinese character

    Returns:
        str: Mnemonic HTML with its character links pointing at Pleco, or None
    """
    data = load_char_json(RTEGA_DIR, character)
    if not data:
        return None

    html = data.get("mnemonic", {}).get("html")
    if not html:
        return None

    # Replace character links with Pleco API URLs
    return replace_hrefs_with_pleco_urls(html)


def is_eligible_note(note_type: str, traditional: str) -> bool:
    """
    Decide whether a note should get a mnemonic.

    Args:
        note_type (str): The note type (e.g., "Hanzi", "TOCFL")
        traditional (str): The Traditional field content

    Returns:
        bool: True if the note should be processed
    """
    if note_type == "TOCFL":
        # For TOCFL, only process single character notes
        return len(traditional) == 1
    return True


def main() -> None:
    parser = build_arg_parser(
        description=f"Fill {FIELD_NAME} field for notes in Anki",
        epilog="""
Examples:
  %(prog)s --dry-run                           Preview changes without updating
  %(prog)s --dry-run --limit 5                 Preview first 5 notes only
  %(prog)s --character 㒼                       Update only the specific character
  %(prog)s                                     Update all Hanzi and TOCFL notes (default)
  %(prog)s --note-types Hanzi                  Update only Hanzi notes
  %(prog)s --limit 100                         Update first 100 notes only
  %(prog)s --overwrite                         Overwrite existing mnemonics
  %(prog)s --note-types TOCFL --dry-run        Preview TOCFL single-character notes

This script loads Rtega mnemonic HTML from JSON files and fills the
"Rtega Mnemonic" field in Anki notes.

Note: TOCFL notes are only processed if the Traditional field contains a single character.

The script only updates empty fields by default. Use --overwrite to update
fields that already have content.
Requires Anki running with AnkiConnect addon installed.
        """,
    )
    args = parser.parse_args()

    fill_note_field(
        field_name=FIELD_NAME,
        render=render_rtega_mnemonic,
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character,
        # The mnemonic is looked up by the note's whole Traditional value, so a
        # multi-character note has no mnemonic rather than its first character's.
        first_char_only=False,
        note_filter=is_eligible_note,
    )


if __name__ == "__main__":
    main()
