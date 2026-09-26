#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill the "HackChineseOutlier Etymology" field from HackChinese's Outlier data.

The note walking, field writing and command-line handling are shared with the
other fill scripts (see utils/shared/note_filler.py); what lives here is the
content this field holds.
"""

import sys
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.note_filler import build_arg_parser, fill_note_field
from shared.project_paths import HACKCHINESE_OUTLIER_DIR, load_char_json

FIELD_NAME = "HackChineseOutlier Etymology"


def process_explanation_text(text: str) -> str | None:
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


def generate_hackchinese_outlier_html(outlier_data: dict[str, Any]) -> str | None:
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


def render_hackchinese_outlier(character: str) -> str | None:
    """Build the field's content for one character, or None when HackChinese has no data for it."""
    outlier_data = load_char_json(HACKCHINESE_OUTLIER_DIR, character)
    if not outlier_data:
        return None
    return generate_hackchinese_outlier_html(outlier_data)


def main() -> None:
    parser = build_arg_parser(
        description=f"Fill {FIELD_NAME} field for notes in Anki",
        epilog="""
Examples:
  %(prog)s --dry-run                           Preview changes without updating
  %(prog)s --dry-run --limit 5                 Preview first 5 notes only
  %(prog)s                                     Update all Hanzi notes
  %(prog)s --note-types Hanzi TOCFL            Update both Hanzi and TOCFL notes
  %(prog)s --limit 100                         Update first 100 notes only
  %(prog)s --character 你                      Update specific character only
  %(prog)s --character 你 --overwrite          Rebuild specific character

This script generates content for the "HackChineseOutlier Etymology" field from
HackChinese Outlier dictionary data. It uses form_explanation_trad and falls back
to form_explanation_simp if not available.

Only single-character notes are processed.

The script only updates empty fields and skips notes that already have content.
Requires Anki running with AnkiConnect addon installed.
        """,
    )
    args = parser.parse_args()

    fill_note_field(
        field_name=FIELD_NAME,
        render=render_hackchinese_outlier,
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character,
    )


if __name__ == "__main__":
    main()
