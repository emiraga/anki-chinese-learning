#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
# ]
# ///
"""
Convert Hanziyuan JSON files by extracting characterInfo and etymologyCharacters into structured dictionaries.

This script processes JSON files in public/data/hanziyuan/raw/ and converts:
1. "characterInfo" - from an array of HTML strings to a dictionary mapping labels to content
2. "etymologyCharacters" - from HTML to a structured dictionary with oracle, bronze, seal,
   and liushutong character IDs organized by type
3. "etymologyStyles" - extracts base64-encoded SVG images from inline CSS, saves them to
   public/data/hanziyuan/images/etymology/, and creates a mapping of etymology IDs to image paths
"""

import base64
import json
import re
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


def parse_etymology_section(soup: BeautifulSoup, header_text: str, image_map: Dict[str, str]) -> Dict[str, Any]:
    """
    Parse a single etymology section (oracle, bronze, seal, or liushutong).

    Args:
        soup: BeautifulSoup object of the HTML
        header_text: English text to search for in h3 headers (e.g., "Oracle characters")
        image_map: Dictionary mapping etymology IDs to image paths

    Returns:
        Dictionary with chinese name, count, and list of items with id and image
    """
    # Find the h3 header containing the section title
    for h3 in soup.find_all('h3'):
        header_full = h3.get_text()
        if header_text in header_full:
            # Extract count from header like "Oracle characters 甲骨文 (13)"
            count_match = re.search(r'\((\d+)\)', header_full)
            count = int(count_match.group(1)) if count_match else 0

            # Extract Chinese name
            chinese_match = re.search(r'[\u4e00-\u9fff]+', header_full)
            chinese_name = chinese_match.group(0) if chinese_match else ""

            # Find all etymology IDs in the div elements
            items = []
            # Get the next sibling elements until we hit <hr>
            current = h3.next_sibling
            while current and current.name != 'hr':
                if hasattr(current, 'find_all'):
                    # Look for div elements with id starting with "etymology"
                    for div in current.find_all('div', id=True):
                        if div['id'].startswith('etymology'):
                            # Extract the ID (everything after "etymology")
                            etymology_id = div['id'].replace('etymology', '')
                            items.append({
                                "id": etymology_id,
                                "image": image_map.get(etymology_id, "")
                            })
                current = current.next_sibling

            return {
                "chinese": chinese_name,
                "count": count,
                "items": items
            }

    # Return empty structure if section not found
    return {
        "chinese": "",
        "count": 0,
        "items": []
    }


def convert_etymology_characters(etymology_html: str, image_map: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
    """
    Convert etymologyCharacters HTML into a structured dictionary.

    Args:
        etymology_html: HTML string containing etymology character sections
        image_map: Dictionary mapping etymology IDs to image paths

    Returns:
        Dictionary with sections for oracle, bronze, seal, and liushutong characters,
        each containing items with id and image path

    Raises:
        ValueError: If an unexpected character type is found
    """
    soup = BeautifulSoup(etymology_html, 'lxml')

    # Define known character types
    character_types = {
        "oracle": "Oracle characters",
        "bronze": "Bronze characters",
        "seal": "Seal characters",
        "liushutong": "Liushutong characters"
    }

    # Check for unexpected character types
    known_type_names = set(character_types.values())
    for h3 in soup.find_all('h3'):
        header_text = h3.get_text()
        # Check if this h3 matches any known type
        if not any(known_type in header_text for known_type in known_type_names):
            raise ValueError(
                f"Unexpected etymology character type found in HTML: '{header_text.strip()}'. "
                f"Known types are: {', '.join(sorted(known_type_names))}"
            )

    # Parse each section using the defined types
    return {
        key: parse_etymology_section(soup, header_text, image_map)
        for key, header_text in character_types.items()
    }


def extract_etymology_images(etymology_styles: str, character: str, images_dir: Path) -> Dict[str, str]:
    """
    Extract base64-encoded images from etymologyStyles CSS and save them to files.

    Args:
        etymology_styles: CSS string with base64-encoded background images
        character: The Chinese character (used for unique filenames)
        images_dir: Directory to save image files

    Returns:
        Dictionary mapping etymology IDs to image paths (relative to public/)
    """
    if not etymology_styles:
        return {}

    # Create images directory if it doesn't exist
    images_dir.mkdir(parents=True, exist_ok=True)

    # Pattern to match: #etymologyID { background-image: url('data:image/svg+xml;base64,DATA') }
    pattern = r'#etymology(\w+)\s*\{\s*background-image:\s*url\([\'"]data:image/svg\+xml;base64,([^\'"]+)[\'"]\)\s*\}'

    result = {}
    for match in re.finditer(pattern, etymology_styles):
        etymology_id = match.group(1)  # e.g., "J29285"
        base64_data = match.group(2)   # The base64-encoded SVG

        # Create unique filename using character and etymology ID
        filename = f"{character}_{etymology_id}.svg"
        file_path = images_dir / filename

        try:
            # Decode base64 and write to file
            svg_data = base64.b64decode(base64_data)
            with open(file_path, 'wb') as f:
                f.write(svg_data)

            # Store the path relative to public/
            relative_path = f"data/hanziyuan/images/etymology/{filename}"
            result[etymology_id] = relative_path

        except Exception as e:
            print(f"Warning: Failed to decode image for {etymology_id}: {e}", file=sys.stderr)

    return result


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


def process_file(input_path: Path, output_path: Path, images_dir: Path) -> None:
    """
    Process a single JSON file.

    Args:
        input_path: Path to input JSON file
        output_path: Path to output JSON file
        images_dir: Directory to save extracted images
    """
    try:
        # Read the file
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Extract and convert characterInfo
        if 'characterInfo' not in data:
            print(f"Warning: No 'characterInfo' field in {input_path.name}", file=sys.stderr)
            return

        # Get the character name from filename (e.g., "車.json" -> "車")
        character = input_path.stem

        character_info = data['characterInfo']
        converted = convert_character_info(character_info)

        # Extract and save etymology images first (to get the image map)
        etymology_styles = data.get('etymologyStyles', '')
        etymology_images = extract_etymology_images(etymology_styles, character, images_dir)

        # Convert etymologyCharacters with image paths
        etymology_chars = data.get('etymologyCharacters', '')
        converted_etymology = convert_etymology_characters(etymology_chars, etymology_images) if etymology_chars else {}

        # Create output structure
        output_data = {
            'characterInfo': converted,
            'etymologyCharacters': converted_etymology
        }

        # Write output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        print(f"✓ Converted {input_path.name} ({len(etymology_images)} images)")

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
    images_dir = project_root / "public" / "data" / "hanziyuan" / "images" / "etymology"

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
    total_images = 0
    for json_file in json_files:
        output_file = output_dir / json_file.name
        try:
            process_file(json_file, output_file, images_dir)
        except Exception:
            errors += 1

    print(f"\nProcessed {len(json_files)} files")
    if errors:
        print(f"Errors: {errors}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Output directory: {output_dir}")
        print(f"Images directory: {images_dir}")


if __name__ == "__main__":
    main()
