#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
# ]
# ///
"""
Parse RTEGA HTML files containing Chinese character mnemonics.
Extracts character data and generates JSON files for each character.
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional
from bs4 import BeautifulSoup, NavigableString, Tag


def extract_text_from_html(element: Tag) -> str:
    """Extract plain text from HTML element, removing all tags."""
    if element is None:
        return ""
    return element.get_text(strip=True)


def extract_html_content(element: Tag) -> str:
    """Extract HTML content as string, preserving structure."""
    if element is None:
        return ""
    # Get inner HTML
    return ''.join(str(child) for child in element.children)


def extract_referenced_characters(html_content: str) -> List[str]:
    """Extract all referenced Chinese characters from mnemonic HTML."""
    # Find all links with character references
    soup = BeautifulSoup(html_content, 'html.parser')
    chars = []

    for link in soup.find_all('a'):
        # Check for href with ?c= parameter
        href = link.get('href', '')
        match = re.search(r'\?c=([^&]+)', href)
        if match:
            char = match.group(1)
            chars.append(char)

    return chars


def parse_character_row(row: Tag) -> Optional[Dict]:
    """Parse a single table row containing character data."""
    try:
        # Get row ID
        row_id = row.get('id')
        if not row_id:
            return None

        cells = row.find_all('td')
        if len(cells) < 4:
            return None

        # Extract character(s) from first cell
        char_cell = cells[0]

        # Find traditional and simplified characters
        traditional_char = None
        simplified_char = None
        japanese_char = None
        char_uid = None

        # Look for the main character (chanzilarge)
        trad_font = char_cell.find('font', {'id': 'chanzilarge'})
        if trad_font:
            traditional_char = trad_font.get_text(strip=True)
            char_uid = trad_font.get('uid')

        # Look for Japanese variant
        jp_font = char_cell.find('font', {'id': 'jhanzilarge'})
        if jp_font:
            japanese_char = jp_font.get_text(strip=True)

        # Check for simplified variant (after <hr> tag)
        hr_tag = char_cell.find('hr')
        if hr_tag:
            # Get fonts after hr tag
            for sibling in hr_tag.find_next_siblings():
                if sibling.name == 'font':
                    # Try to determine if this is simplified
                    # Simplified chars don't have specific ID in the example
                    text = sibling.get_text(strip=True)
                    if text and text != traditional_char:
                        simplified_char = text
                        break

        # Use traditional as main character if no simplified
        main_char = simplified_char if simplified_char else traditional_char

        if not main_char:
            return None

        # Extract meaning from third cell
        meaning_cell = cells[2]
        meaning = extract_text_from_html(meaning_cell)

        # Extract mnemonic from fourth cell
        mnemonic_cell = cells[3]

        # Get both HTML and text versions of mnemonic
        mnemonic_html = ""
        mnemonic_text = ""
        mnemonic_items = []

        if mnemonic_cell:
            # Find all list items
            list_items = mnemonic_cell.find_all('li')
            for li in list_items:
                # Get HTML version
                item_html = extract_html_content(li)
                mnemonic_items.append({
                    'html': item_html,
                    'text': extract_text_from_html(li),
                    'author': li.get('data-toggle') and li.get('title', '')
                })

            mnemonic_html = extract_html_content(mnemonic_cell)
            mnemonic_text = extract_text_from_html(mnemonic_cell)

        # Extract related characters from last cell
        related_chars = []
        if len(cells) >= 5:
            related_cell = cells[4]
            related_links = related_cell.find_all('a')
            for link in related_links:
                href = link.get('href', '')
                match = re.search(r'\?c=([^&]+)', href)
                if match:
                    related_chars.append(match.group(1))

        # Extract referenced characters from mnemonic
        referenced_chars = extract_referenced_characters(mnemonic_html)

        # Build character data
        char_data = {
            'id': row_id,
            'character': main_char,
            'traditional': traditional_char if traditional_char != main_char else None,
            'simplified': simplified_char,
            'japanese': japanese_char if japanese_char != main_char else None,
            'uid': char_uid,
            'meaning': meaning,
            'mnemonic': {
                'text': mnemonic_text,
                'html': mnemonic_html,
                'items': mnemonic_items
            },
            'referenced_characters': referenced_chars,
            'related_characters': related_chars
        }

        return char_data

    except Exception as e:
        print(f"Error parsing row {row.get('id', 'unknown')}: {e}")
        return None


def parse_html_file(file_path: Path) -> List[Dict]:
    """Parse an HTML file and extract all character data."""
    print(f"Parsing {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Find the main table with class 'chmn'
    table = soup.find('table', {'class': 'chmn'})
    if not table:
        print(f"  No table found in {file_path.name}")
        return []

    # Parse all rows
    characters = []
    rows = table.find_all('tr')

    for row in rows:
        char_data = parse_character_row(row)
        if char_data:
            characters.append(char_data)

    print(f"  Found {len(characters)} characters")
    return characters


def save_character_json(char_data: Dict, output_dir: Path):
    """Save character data to a JSON file."""
    char = char_data['character']

    # Create filename - use character as filename
    # For special characters, use the uid or id
    filename = f"{char}.json"

    # If character has problematic filename chars, use uid
    try:
        filepath = output_dir / filename
    except:
        filename = f"char_{char_data['id']}.json"
        filepath = output_dir / filename

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(char_data, f, ensure_ascii=False, indent=2)


def main():
    """Main function to process all HTML files."""
    # Get project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent

    # Input and output directories
    input_dir = project_root / 'data' / 'rtega'
    output_dir = project_root / 'public' / 'data' / 'rtega'

    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all HTML files
    html_files = sorted(input_dir.glob('*.html'))

    if not html_files:
        raise FileNotFoundError(f"No HTML files found in {input_dir}")

    print(f"Found {len(html_files)} HTML files to process")
    print(f"Output directory: {output_dir}")
    print()

    # Process all files
    all_characters = []

    for html_file in html_files:
        characters = parse_html_file(html_file)
        all_characters.extend(characters)

    print()
    print(f"Total characters extracted: {len(all_characters)}")
    print()

    # Save individual JSON files
    print("Saving JSON files...")
    for char_data in all_characters:
        save_character_json(char_data, output_dir)

    # Also save a combined index file
    index_file = output_dir / 'index.json'
    index_data = {
        'total_characters': len(all_characters),
        'characters': [
            {
                'id': char['id'],
                'character': char['character'],
                'meaning': char['meaning']
            }
            for char in all_characters
        ]
    }

    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(all_characters)} character JSON files")
    print(f"Saved index file: {index_file}")
    print()
    print("Done!")


if __name__ == '__main__':
    main()
