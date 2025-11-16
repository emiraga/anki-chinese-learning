#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
# ]
# ///
"""
Convert Hanziyuan JSON files by extracting characterInfo into a structured dictionary.

This script processes JSON files in public/data/hanziyuan/raw/ and extracts the
"characterInfo" field, converting it from an array of HTML-formatted strings into
a clean dictionary mapping headers to their content.
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict
from bs4 import BeautifulSoup


def html_to_text(html_string: str) -> str:
    """
    Convert HTML string to plain text, preserving line breaks.

    Args:
        html_string: HTML-formatted string

    Returns:
        Plain text with HTML tags removed and line breaks preserved
    """
    soup = BeautifulSoup(html_string, 'lxml')

    # Replace <br> tags with newlines before extracting text
    for br in soup.find_all('br'):
        br.replace_with('\n')

    # Get text with newlines preserved
    text = soup.get_text()

    # Clean up: remove leading/trailing whitespace from each line
    # but preserve the line breaks
    lines = text.split('\n')
    cleaned_lines = [line.strip() for line in lines]

    # Remove empty lines at the start and end, but keep internal empty lines
    while cleaned_lines and not cleaned_lines[0]:
        cleaned_lines.pop(0)
    while cleaned_lines and not cleaned_lines[-1]:
        cleaned_lines.pop()

    return '\n'.join(cleaned_lines)


def extract_label_and_content(html_string: str) -> tuple[str, str] | None:
    """
    Extract the label (bold text) and content from an HTML string.

    Args:
        html_string: HTML-formatted string like "<b>Label:</b> content"

    Returns:
        Tuple of (label, content) as plain text, or None if no label found
    """
    soup = BeautifulSoup(html_string, 'lxml')

    # Find the first <b> tag
    bold_tag = soup.find('b')
    if not bold_tag:
        return None

    # Get the label text (should end with ':')
    label_text = bold_tag.get_text().strip()
    if not label_text.endswith(':'):
        return None

    # Remove the trailing colon
    label = label_text[:-1].strip()

    # Remove " [?]" suffix if present
    if label.endswith(' [?]'):
        label = label[:-4].strip()

    # Get the content after the bold tag
    # Extract all text from the original string after the </b> tag
    bold_string = str(bold_tag)
    content_start = html_string.find(bold_string) + len(bold_string)
    content_html = html_string[content_start:].strip()

    # Convert HTML content to plain text
    if content_html:
        content = html_to_text(content_html)
    else:
        content = ""

    return (label, content)


def convert_character_info(character_info: list[str]) -> Dict[str, str]:
    """
    Convert characterInfo array into a dictionary with plain text values.

    Args:
        character_info: Array of HTML-formatted strings

    Returns:
        Dictionary mapping labels to plain text content
    """
    result: Dict[str, Any] = {}

    for i, item in enumerate(character_info):
        extracted = extract_label_and_content(item)

        if extracted:
            label, content = extracted
            result[label] = content
        else:
            # If no label found, convert to plain text and store under numbered key
            text = html_to_text(item)
            if text:  # Only add non-empty items
                result[f"_unlabeled_{i}"] = text

    return result


def process_file(input_path: Path, output_path: Path) -> None:
    """
    Process a single JSON file.

    Args:
        input_path: Path to input JSON file
        output_path: Path to output JSON file
    """
    try:
        # Read the file
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Extract and convert characterInfo
        if 'characterInfo' not in data:
            print(f"Warning: No 'characterInfo' field in {input_path.name}", file=sys.stderr)
            return

        character_info = data['characterInfo']
        converted = convert_character_info(character_info)

        # Create output structure - preserve other fields
        output_data = {
            'characterInfo': converted,
            'etymologyCharacters': data.get('etymologyCharacters', []),
            'etymologyStyles': data.get('etymologyStyles', [])
        }

        # Write output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        print(f"✓ Converted {input_path.name}")

    except Exception as e:
        print(f"Error processing {input_path.name}: {e}", file=sys.stderr)
        raise


def main():
    """Main function to process all JSON files in the raw directory."""
    # Set up paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    raw_dir = project_root / "public" / "data" / "hanziyuan" / "raw"
    output_dir = project_root / "public" / "data" / "hanziyuan" / "converted"

    if not raw_dir.exists():
        print(f"Error: Raw directory not found: {raw_dir}", file=sys.stderr)
        sys.exit(1)

    # Get all JSON files
    json_files = sorted(raw_dir.glob("*.json"))

    if not json_files:
        print(f"No JSON files found in {raw_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(json_files)} JSON files to process\n")

    # Process each file
    errors = 0
    for json_file in json_files:
        output_file = output_dir / json_file.name
        try:
            process_file(json_file, output_file)
        except Exception:
            errors += 1

    print(f"\nProcessed {len(json_files)} files")
    if errors:
        print(f"Errors: {errors}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Output directory: {output_dir}")


if __name__ == "__main__":
    main()
