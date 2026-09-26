#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill the "Yellowbridge Etymology" field from the YellowBridge character data.

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
from shared.project_paths import YELLOWBRIDGE_INFO_DIR, load_char_json

FIELD_NAME = "Yellowbridge Etymology"


def format_component_info(component: dict[str, Any]) -> str:
    """
    Format a component with pinyin and description

    Args:
        component (dict): Component information

    Returns:
        str: HTML formatted component
    """
    parts = [f"<strong>{escape_html(component['character'])}</strong>"]

    if component.get("pinyin") and len(component["pinyin"]) > 0:
        pinyin_str = ", ".join(component["pinyin"])
        parts.append(f"<em>{escape_html(pinyin_str)}</em>")

    if component.get("description"):
        parts.append(f'"{escape_html(component["description"])}"')

    if component.get("isAltered"):
        parts.append(
            '<span style="font-size: 0.75em; background-color: #fef3c7; color: #92400e;'
            ' padding: 0.125rem 0.375rem; border-radius: 0.25rem;">altered</span>'
        )

    return " ".join(parts)


def generate_yellowbridge_etymology_html(yb_data: dict[str, Any]) -> str | None:
    """
    Generate HTML for Yellowbridge Etymology field

    Args:
        yb_data (dict): YellowBridge character data

    Returns:
        str: HTML string or None if no data available
    """
    if not yb_data:
        return None

    html_parts: list[str] = []

    # 1. Definition
    if yb_data.get("definition"):
        definition = escape_html(yb_data["definition"])
        html_parts.append(f"<p><strong>Definition:</strong> {definition}</p>")

    # 2. Character Formation
    if yb_data.get("formationMethods") and len(yb_data["formationMethods"]) > 0:
        html_parts.append("<ul>")

        for method in yb_data["formationMethods"]:
            type_english = escape_html(method.get("typeEnglish", ""))
            type_chinese = escape_html(method.get("typeChinese", ""))
            description = escape_html(method.get("description", ""))

            method_html = f"<li><strong>{type_english}</strong> ({type_chinese}): {description}"

            if method.get("referencedCharacters") and len(method["referencedCharacters"]) > 0:
                ref_chars = ", ".join([escape_html(c) for c in method["referencedCharacters"]])
                method_html += f" [{ref_chars}]"

            method_html += "</li>"
            html_parts.append(method_html)

        html_parts.append("</ul>")

    # 3. Functional Components (Phonetic and Semantic)
    functional_comps = yb_data.get("functionalComponents", {})
    has_phonetic = functional_comps.get("phonetic") and len(functional_comps["phonetic"]) > 0
    has_semantic = functional_comps.get("semantic") and len(functional_comps["semantic"]) > 0

    if has_phonetic or has_semantic:
        html_parts.append("<ul>")

        if has_phonetic:
            html_parts.append('<li><strong style="color: #2563eb;">Phonetic (Sound):</strong>')
            html_parts.append("<ul>")
            html_parts.extend(f"<li>{format_component_info(comp)}</li>" for comp in functional_comps["phonetic"])
            html_parts.append("</ul>")
            html_parts.append("</li>")

        if has_semantic:
            html_parts.append('<li><strong style="color: #16a34a;">Semantic (Meaning):</strong>')
            html_parts.append("<ul>")
            html_parts.extend(f"<li>{format_component_info(comp)}</li>" for comp in functional_comps["semantic"])
            html_parts.append("</ul>")
            html_parts.append("</li>")

        html_parts.append("</ul>")

    # 4. Primitive Components
    has_primitive = functional_comps.get("primitive") and len(functional_comps["primitive"]) > 0

    if has_primitive:
        html_parts.append("<ul>")
        html_parts.extend(f"<li>{format_component_info(comp)}</li>" for comp in functional_comps["primitive"])
        html_parts.append("</ul>")

    if not html_parts:
        return None

    return "\n".join(html_parts)


def render_yellowbridge_etymology(character: str) -> str | None:
    """Build the field's content for one character, or None when YellowBridge has no data for it."""
    yb_data = load_char_json(YELLOWBRIDGE_INFO_DIR, character)
    if not yb_data:
        return None
    return generate_yellowbridge_etymology_html(yb_data)


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

This script generates HTML content for the "Yellowbridge Etymology" field including:
  1. Definition
  2. Character Formation methods (with types and descriptions)
  3. Functional Components (Phonetic and Semantic)
  4. Primitive Components

Only single-character notes are processed.

The script only updates empty fields and skips notes that already have content.
Requires Anki running with AnkiConnect addon installed.
        """,
    )
    args = parser.parse_args()

    fill_note_field(
        field_name=FIELD_NAME,
        render=render_yellowbridge_etymology,
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        overwrite=args.overwrite,
        character=args.character,
    )


if __name__ == "__main__":
    main()
