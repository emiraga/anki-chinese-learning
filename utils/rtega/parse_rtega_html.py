#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
#   "requests",
# ]
# ///
"""
Parse RTEGA HTML files containing Chinese character mnemonics.
Extracts character data and generates JSON files for each character.
"""

import json
import re
import requests
import hashlib
import time
from pathlib import Path
from typing import Dict, List, Optional
from bs4 import BeautifulSoup, Tag


def extract_text_from_html(element: Tag) -> str:
    """Extract plain text from HTML element, removing all tags but preserving spacing."""
    if element is None:
        return ""
    # Use separator to preserve spaces between elements
    # get_text(' ') adds a space when transitioning from one element to another
    text = element.get_text(' ', strip=True)
    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)
    return text


def extract_html_content(element: Tag) -> str:
    """Extract HTML content as string, preserving structure."""
    if element is None:
        return ""
    # Get inner HTML
    return ''.join(str(child) for child in element.children)


# Global cache for SVG content (in-memory)
_svg_cache: Dict[str, str] = {}

# Cache configuration
CACHE_VERSION = "1"
CACHE_EXPIRY_DAYS = 30


def get_cache_dir() -> Path:
    """Get the cache directory path."""
    script_dir = Path(__file__).parent
    cache_dir = script_dir / '.cache' / 'svg'
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_cache_metadata_file() -> Path:
    """Get the cache metadata file path."""
    return get_cache_dir() / 'metadata.json'


def load_cache_metadata() -> Dict:
    """Load cache metadata from disk."""
    metadata_file = get_cache_metadata_file()
    if metadata_file.exists():
        try:
            with open(metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"  Warning: Failed to load cache metadata: {e}")
            return {'version': CACHE_VERSION, 'entries': {}}
    return {'version': CACHE_VERSION, 'entries': {}}


def save_cache_metadata(metadata: Dict):
    """Save cache metadata to disk."""
    metadata_file = get_cache_metadata_file()
    try:
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    except IOError as e:
        print(f"  Warning: Failed to save cache metadata: {e}")


def get_cache_file_path(svg_name: str) -> Path:
    """Get the cache file path for a given SVG name."""
    # Use hash to avoid filesystem issues with special characters
    name_hash = hashlib.md5(svg_name.encode('utf-8')).hexdigest()
    return get_cache_dir() / f"{name_hash}.svg"


def is_cache_valid(svg_name: str, metadata: Dict) -> bool:
    """Check if cached SVG is still valid."""
    if svg_name not in metadata.get('entries', {}):
        return False

    entry = metadata['entries'][svg_name]

    # Check cache version
    if entry.get('version') != CACHE_VERSION:
        return False

    # Check expiry
    cached_time = entry.get('timestamp', 0)
    current_time = time.time()
    age_days = (current_time - cached_time) / (60 * 60 * 24)

    if age_days > CACHE_EXPIRY_DAYS:
        return False

    # Check if file exists
    cache_file = get_cache_file_path(svg_name)
    return cache_file.exists()


def load_from_cache(svg_name: str, metadata: Dict) -> Optional[str]:
    """Load SVG content from disk cache."""
    if not is_cache_valid(svg_name, metadata):
        return None

    cache_file = get_cache_file_path(svg_name)
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            return f.read()
    except IOError as e:
        print(f"  Warning: Failed to read cached SVG {svg_name}: {e}")
        return None


def save_to_cache(svg_name: str, svg_content: str, metadata: Dict):
    """Save SVG content to disk cache."""
    cache_file = get_cache_file_path(svg_name)

    try:
        # Save SVG content
        with open(cache_file, 'w', encoding='utf-8') as f:
            f.write(svg_content)

        # Update metadata
        if 'entries' not in metadata:
            metadata['entries'] = {}

        metadata['entries'][svg_name] = {
            'version': CACHE_VERSION,
            'timestamp': time.time(),
            'file': cache_file.name
        }

        save_cache_metadata(metadata)
    except IOError as e:
        print(f"  Warning: Failed to cache SVG {svg_name}: {e}")


def fetch_svg_content(svg_name: str, cache_metadata: Optional[Dict] = None) -> Optional[str]:
    """Fetch SVG content from rtega.be server and cache it."""
    # Check in-memory cache first
    if svg_name in _svg_cache:
        return _svg_cache[svg_name]

    # Load cache metadata if not provided
    if cache_metadata is None:
        cache_metadata = load_cache_metadata()

    # Check disk cache
    svg_content = load_from_cache(svg_name, cache_metadata)
    if svg_content:
        _svg_cache[svg_name] = svg_content
        print(f"  Loaded from cache: {svg_name}")
        return svg_content

    # Fetch from network
    url = f"http://rtega.be/chmn/img/{svg_name}.svg"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        svg_content = response.text

        # Cache in memory
        _svg_cache[svg_name] = svg_content

        # Cache to disk
        save_to_cache(svg_name, svg_content, cache_metadata)

        print(f"  Fetched SVG: {svg_name}")
        return svg_content
    except requests.RequestException as e:
        print(f"  Warning: Failed to fetch SVG {svg_name}: {e}")
        return None


def extract_abbreviation_definitions(soup: BeautifulSoup) -> dict[str, str]:
    """Extract abbreviation/term definitions from the HTML."""
    definitions = {
        'triggeralo': 'allograph (different shape but same meaning)',
        'triggercon': 'connotation as a character part',
        'triggerabbr': 'abbreviated, abbreviation',
        'triggercontr': 'contracted, contraction',
        'triggerext': 'extended meaning',
        'triggergovt': 'government',
        'triggerk': 'kanji, ideograph, character',
        'triggerlit': 'literal translation from the Shuowen Jiezi',
        'triggermodf': 'modified, modification',
        'triggeropp': 'opposite meaning or situation',
        'triggerpt': 'when used as a character part',
        'triggerrs': 'explanation according to Richard Sears (http://hanziyuan.net/)',
        'triggerrad': 'one of the 214 radicals in the traditional character classification system',
        'triggersit': 'situation chosen for evoking this meaning',
        'triggerx': 'suffix for counting units of objects, etc.',
        'triggeruncl': 'Unclassified by Joseph De Roo.'
    }

    # Try to extract definitions from the HTML divs if they exist
    div_map = {
        'triggeralo': 'alo',
        'triggercon': 'conno',
        'triggerabbr': 'abbr',
        'triggercontr': 'contr',
        'triggerext': 'ext',
        'triggergovt': 'govt',
        'triggerk': 'kanji',
        'triggerlit': 'lit',
        'triggermodf': 'modf',
        'triggeropp': 'opp',
        'triggerpt': 'pt',
        'triggerrs': 'rs',
        'triggerrad': 'rad',
        'triggersit': 'sit',
        'triggerx': 'suff',
        'triggeruncl': 'uncl'
    }

    for trigger_id, div_id in div_map.items():
        div = soup.find('div', {'id': div_id})
        if div:
            text = div.get_text(strip=True)
            if text:
                definitions[trigger_id] = text

    return definitions


def inline_svg_images(html_content: str, abbreviation_definitions: dict[str, str]) -> str:
    """Replace <img svg="..."> tags with inlined SVG content, clean up style attributes, and inline abbreviations."""
    soup = BeautifulSoup(html_content, 'html.parser')

    # Inline abbreviation definitions
    for a_tag in soup.find_all('a', attrs={'id': True}):
        trigger_id = a_tag.get('id')
        if trigger_id in abbreviation_definitions:
            # Get the text content
            text = a_tag.get_text(strip=True)
            definition = abbreviation_definitions[trigger_id]
            # Replace with text + definition in parentheses
            a_tag.replace_with(f"{text} ({definition})")

    # Remove style attributes from remaining <a> tags
    for a_tag in soup.find_all('a', attrs={'style': True}):
        del a_tag['style']

    # Find all img tags with svg attribute
    img_tags = soup.find_all('img', attrs={'svg': True})

    for img_tag in img_tags:
        svg_name = img_tag.get('svg')
        if svg_name:
            # Fetch the SVG content
            svg_content = fetch_svg_content(svg_name)
            if svg_content:
                # Parse the SVG content
                svg_soup = BeautifulSoup(svg_content, 'xml')
                svg_element = svg_soup.find('svg')

                if svg_element:
                    # Add a class to identify these as inlined SVGs
                    if svg_element.get('class'):
                        svg_element['class'].append('inlined-svg')
                    else:
                        svg_element['class'] = ['inlined-svg']

                    # Add data attribute to track original svg name
                    svg_element['data-svg-name'] = svg_name

                    # Remove fixed width/height attributes, keep viewBox for proper scaling
                    if svg_element.get('width'):
                        del svg_element['width']
                    if svg_element.get('height'):
                        del svg_element['height']

                    # Ensure viewBox is present for proper scaling
                    # If no viewBox, try to create one from original width/height
                    if not svg_element.get('viewBox'):
                        # Try to extract from original dimensions in the fetched content
                        original_svg = BeautifulSoup(svg_content, 'xml').find('svg')
                        width = original_svg.get('width', '100')
                        height = original_svg.get('height', '100')
                        # Remove any units from width/height
                        width_val = re.sub(r'[^0-9.]', '', str(width))
                        height_val = re.sub(r'[^0-9.]', '', str(height))
                        if width_val and height_val:
                            svg_element['viewBox'] = f"0 0 {width_val} {height_val}"

                    # Replace img tag with SVG element
                    img_tag.replace_with(svg_element)
                else:
                    print(f"  Warning: No SVG element found in {svg_name}")
            else:
                # If fetch failed, add src attribute as fallback
                img_tag['src'] = f"http://rtega.be/chmn/img/{svg_name}.svg"

    return str(soup)


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


def parse_character_row(row: Tag, abbreviation_definitions: dict[str, str]) -> Optional[Dict]:
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

        # Use traditional as main character (prefer traditional over simplified)
        main_char = traditional_char if traditional_char else simplified_char

        if not main_char:
            return None

        # Extract meaning from third cell
        meaning_cell = cells[2]
        meaning = extract_text_from_html(meaning_cell)

        # Extract mnemonic from fourth cell
        mnemonic_cell = cells[3]
        mnemonic_html = inline_svg_images(extract_html_content(mnemonic_cell), abbreviation_definitions) if mnemonic_cell else ""
        mnemonic_text = extract_text_from_html(mnemonic_cell) if mnemonic_cell else ""

        # Extract related characters from second cell (cells[1])
        related_chars = []
        related_cell = cells[1]
        # Look for font tags with uid attributes
        related_fonts = related_cell.find_all('font', {'id': 'chanzilarge'})
        for font in related_fonts:
            char_text = font.get_text(strip=True)
            if char_text:
                related_chars.append(char_text)

        # Also check for links (backup method)
        if not related_chars:
            for link in related_cell.find_all('a'):
                href = link.get('href', '')
                match = re.search(r'\?c=([^&]+)', href)
                if match:
                    related_chars.append(match.group(1))

        # Extract additional related characters from last cell (if present)
        additional_related_chars = []
        if len(cells) >= 5:
            additional_cell = cells[4]
            additional_links = additional_cell.find_all('a')
            for link in additional_links:
                href = link.get('href', '')
                match = re.search(r'\?c=([^&]+)', href)
                if match:
                    additional_related_chars.append(match.group(1))

        # Extract referenced characters from mnemonic
        referenced_chars = extract_referenced_characters(mnemonic_html)

        # Build character data
        char_data = {
            'id': row_id,
            'character': main_char,
            'traditional': traditional_char,
            'simplified': simplified_char if simplified_char != main_char else None,
            'japanese': japanese_char if japanese_char != main_char else None,
            'uid': char_uid,
            'meaning': meaning,
            'mnemonic': {
                'text': mnemonic_text,
                'html': mnemonic_html
            },
            'referenced_characters': referenced_chars,
            'related_characters': related_chars,
            'additional_related_characters': additional_related_chars if additional_related_chars else None
        }

        return char_data

    except Exception as e:
        print(f"Error parsing row {row.get('id', 'unknown')}: {e}")
        return None


def parse_html_file(file_path: Path, file_num: int, total_files: int) -> List[Dict]:
    """Parse an HTML file and extract all character data."""
    progress_pct = (file_num / total_files) * 100
    print(f"[{progress_pct:5.1f}%] Parsing {file_path.name}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract abbreviation definitions from the page
    abbreviation_definitions = extract_abbreviation_definitions(soup)

    # Find the main table with class 'chmn'
    table = soup.find('table', {'class': 'chmn'})
    if not table:
        print(f"         No table found in {file_path.name}")
        return []

    # Parse all rows
    characters = []
    rows = table.find_all('tr')

    for row in rows:
        char_data = parse_character_row(row, abbreviation_definitions)
        if char_data:
            characters.append(char_data)

    print(f"         Found {len(characters)} characters")
    return characters


def get_marker_file(html_file: Path, output_dir: Path) -> Path:
    """Get the marker file path for an HTML file."""
    return output_dir / f".{html_file.stem}.processed"


def should_process_file(html_file: Path, output_dir: Path) -> bool:
    """Check if HTML file needs to be processed based on mtime comparison."""
    marker_file = get_marker_file(html_file, output_dir)

    # If marker file doesn't exist, we need to process
    if not marker_file.exists():
        return True

    # Compare modification times - process if HTML is newer than marker
    html_mtime = html_file.stat().st_mtime
    marker_mtime = marker_file.stat().st_mtime

    return html_mtime > marker_mtime


def update_marker_file(html_file: Path, output_dir: Path):
    """Touch marker file after processing to update its mtime."""
    marker_file = get_marker_file(html_file, output_dir)
    marker_file.touch()


def save_character_json(char_data: Dict, output_dir: Path):
    """Save character data to a JSON file."""
    char = char_data['character']

    # Create filename - use character as filename
    # For special characters, use the uid or id
    try:
        filepath = output_dir / f"{char}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(char_data, f, ensure_ascii=False, indent=2)
    except (OSError, ValueError) as e:
        # Fallback for problematic filename characters
        filepath = output_dir / f"char_{char_data['id']}.json"
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

    # Load cache metadata once
    cache_metadata = load_cache_metadata()
    print(f"Cache directory: {get_cache_dir()}")
    print(f"Cached SVGs: {len(cache_metadata.get('entries', {}))} entries")
    print()

    # Find all HTML files
    html_files = sorted(input_dir.glob('*.html'))

    if not html_files:
        raise FileNotFoundError(f"No HTML files found in {input_dir}")

    print(f"Found {len(html_files)} HTML files to process")
    print(f"Output directory: {output_dir}")
    print()

    # Process all files
    all_characters = []
    skipped_count = 0

    for i, html_file in enumerate(html_files, 1):
        # Check if file is empty
        if html_file.stat().st_size == 0:
            progress_pct = (i / len(html_files)) * 100
            print(f"[{progress_pct:5.1f}%] Deleting empty file: {html_file.name}")
            html_file.unlink()
            skipped_count += 1
            continue

        # Check if file needs processing
        if not should_process_file(html_file, output_dir):
            progress_pct = (i / len(html_files)) * 100
            skipped_count += 1
            continue

        characters = parse_html_file(html_file, i, len(html_files))
        all_characters.extend(characters)

        # Save individual JSON files for this HTML file
        for char_data in characters:
            save_character_json(char_data, output_dir)

        # Update marker file after successful processing
        update_marker_file(html_file, output_dir)

    print()
    print(f"Processed: {len(html_files) - skipped_count} files")
    print(f"Skipped: {skipped_count} files (already up to date)")
    print(f"Total characters extracted from processed files: {len(all_characters)}")
    if all_characters:
        print([char["character"] for char in all_characters])
    print()
    print("Done!")


if __name__ == '__main__':
    main()
