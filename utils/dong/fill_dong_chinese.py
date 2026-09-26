#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill the "Dongchinese Etymology" field from the Dong Chinese character data.

The note walking, field writing and command-line handling are shared with the
other fill scripts (see utils/shared/note_filler.py); what lives here is the
HTML this field holds.
"""

import sys
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.html_utils import escape_html
from shared.note_filler import build_arg_parser, fill_note_field
from shared.project_paths import DONG_DIR, load_char_json

FIELD_NAME = "Dongchinese Etymology"


def format_component_type(component_types: list[str]) -> str:
    """
    Format component type labels with colors

    Args:
        component_types (list): List of type strings

    Returns:
        str: HTML formatted type labels
    """
    type_colors = {
        "deleted": "#9ca3af",
        "sound": "#2563eb",
        "iconic": "#16a34a",
        "meaning": "#dc2626",
        "remnant": "#9333ea",
        "distinguishing": "#0891b2",
        "simplified": "#db2777",
        "unknown": "#4b5563",
    }

    type_labels = {
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
        label = type_labels.get(comp_type, comp_type.title())
        color = type_colors.get(comp_type, "#4b5563")
        labels.append(f'<span style="color: {color}; font-weight: 600;">{label}</span>')

    return " ".join(labels) + (" component" if "deleted" not in component_types else "")


def get_component_info(component_char: str, dong_data: dict[str, Any]) -> tuple[str | None, str | None]:
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


def generate_dong_etymology_html(dong_data: dict[str, Any]) -> str | None:
    """
    Generate HTML for Dongchinese Etymology field

    Args:
        dong_data (dict): Dong Chinese character data

    Returns:
        str: HTML string or None if no data available
    """
    if not dong_data:
        return None

    html_parts: list[str] = []

    if dong_data.get("gloss"):
        char_gloss = escape_html(dong_data["gloss"])
        html_parts.append(f"<p>Meaning: {char_gloss}</p>")

    # 1. Original Meaning (optional)
    if dong_data.get("originalMeaning"):
        original_meaning = escape_html(dong_data["originalMeaning"])
        html_parts.append(f"<p><strong>Original Meaning:</strong> {original_meaning}</p>")

    # 2. Etymology/Hint
    if dong_data.get("hint"):
        hint = escape_html(dong_data["hint"])
        html_parts.append(f"<p>{hint}</p>")

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
            comp_info_parts = [f"<strong>{comp_char}</strong>"]

            if pinyin:
                comp_info_parts.append(f"<em>{escape_html(pinyin)}</em>")

            comp_info_parts.append(type_label)

            if gloss:
                comp_info_parts.append(f'"{escape_html(gloss)}"')

            # Extract description from hint if available
            comp_hint = component.get("hint", "")
            if comp_hint:
                comp_hint = escape_html(comp_hint)
                html_parts.append(f"<li>{' '.join(comp_info_parts)}: {comp_hint}</li>")
            else:
                html_parts.append(f"<li>{' '.join(comp_info_parts)}</li>")

        html_parts.append("</ul>")

    if not html_parts:
        return None

    return "\n".join(html_parts)


def render_dong_etymology(character: str) -> str | None:
    """Build the field's content for one character, or None when Dong has no data for it."""
    dong_data = load_char_json(DONG_DIR, character)
    if not dong_data:
        return None
    return generate_dong_etymology_html(dong_data)


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
  %(prog)s --note-types TOCFL --dry-run        Preview TOCFL single-character notes

This script generates HTML content for the "Dongchinese Etymology" field including:
  1. Original Meaning (if available)
  2. Etymology/Hint explaining character formation
  3. Components with types (meaning/sound/iconic/etc.) and descriptions

Component types are color-coded: Meaning (red), Sound (blue), Iconic (green),
Remnant (purple), Distinguishing (cyan), Simplified (pink), Unknown (gray).

The etymology is looked up by the first character of the Traditional field, so
phrase notes get the etymology of the character they start with.

The script only updates empty fields and skips notes that already have content.
Requires Anki running with AnkiConnect addon installed.
        """,
    )
    args = parser.parse_args()

    fill_note_field(
        field_name=FIELD_NAME,
        render=render_dong_etymology,
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character,
        # Any non-empty Traditional field qualifies; its first character is used.
        single_char_only=False,
    )


if __name__ == "__main__":
    main()
