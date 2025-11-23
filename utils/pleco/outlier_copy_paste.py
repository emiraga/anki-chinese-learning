#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "beautifulsoup4>=4.12.0",
#     "lxml>=5.0.0",
# ]
# ///
"""
Rich text paste handler for macOS
Accepts paste from clipboard and displays text with formatting details
"""

import subprocess
import sys
import re
import json
import argparse
from pathlib import Path
from typing import TypedDict, List, Optional
try:
    from bs4 import BeautifulSoup, NavigableString, Tag
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False


# Type definitions for Outlier dictionary data
class Character(TypedDict, total=False):
    """A character entry in a series"""
    traditional: str
    simplified: Optional[str]
    pinyin: List[str]
    meaning: str
    explanation: str


class Series(TypedDict, total=False):
    """A sound or semantic series"""
    explanation: str
    characters: List[Character]


class OutlierData(TypedDict, total=False):
    """Complete Outlier dictionary entry structure"""
    traditional: str
    simplified: Optional[str]
    sound_series: Optional[Series]
    semantic_series: Optional[Series]
    empty_component: Optional[str]
    radical: Optional[str]
    raw_html: Optional[str]


def get_clipboard_formats():
    """Get all available clipboard formats"""
    try:
        result = subprocess.run(
            ['osascript', '-e', 'clipboard info'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error getting clipboard formats: {e}", file=sys.stderr)
        return None


def get_clipboard_rtf():
    """Get RTF content from clipboard"""
    try:
        result = subprocess.run(
            ['osascript', '-e', 'the clipboard as «class RTF »'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def get_clipboard_html():
    """Get HTML content from clipboard"""
    try:
        result = subprocess.run(
            ['osascript', '-e', 'the clipboard as «class HTML»'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def get_clipboard_plain_text():
    """Get plain text from clipboard"""
    try:
        result = subprocess.run(
            ['pbpaste'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error getting plain text: {e}", file=sys.stderr)
        return None


def parse_hex_data(data_str, data_type="DATA"):
    """Parse hex data from AppleScript format"""
    if not data_str or data_str == 'missing value':
        return None

    # Data from AppleScript comes as hex, try to decode it
    try:
        # Remove «data TYPE  and » markers if present
        if '«data ' in data_str:
            # Extract hex part after the type identifier
            # Format is like: «data HTML3C686561643E...»
            # The type name (like HTML) is followed immediately by hex digits
            match = re.search(r'«data\s+[A-Z]+([0-9A-Fa-f]+)»', data_str)
            if match:
                hex_data = match.group(1)
                bytes_data = bytes.fromhex(hex_data)
                return bytes_data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"Could not parse {data_type} hex data: {e}", file=sys.stderr)
        # Try alternate approach - just extract all hex after data TYPE
        try:
            if '«data ' in data_str:
                # Get everything between «data TYPE and »
                inner = data_str.split('«data ')[ 1].split('»')[0]
                # Remove non-hex characters from the beginning
                hex_start = 0
                for i, c in enumerate(inner):
                    if c in '0123456789ABCDEFabcdef':
                        hex_start = i
                        break
                hex_data = inner[hex_start:]
                bytes_data = bytes.fromhex(hex_data)
                return bytes_data.decode('utf-8', errors='replace')
        except Exception as e2:
            print(f"Alternate parse also failed: {e2}", file=sys.stderr)

    return data_str


def format_html_readable(html_str):
    """Format HTML for readable display"""
    if not html_str:
        return None

    if BS4_AVAILABLE:
        soup = BeautifulSoup(html_str, 'html.parser')
        return soup.prettify()
    else:
        # Basic formatting without BeautifulSoup
        formatted = html_str
        formatted = formatted.replace('><', '>\n<')
        return formatted


def validate_pinyin(pinyin: str) -> bool:
    """
    Validate that a string looks like valid pinyin.

    Valid pinyin consists of:
    - Latin letters (a-z, A-Z)
    - Pinyin tone marks (ā, á, ǎ, à, ē, é, ě, è, etc.)
    - Should be 1-6 characters long
    - Should not contain numbers, spaces, or special characters (except tone marks)
    - Must have at least one tone mark OR be a known toneless syllable
    """
    if not pinyin or len(pinyin) > 6:
        return False

    # Check each character is either Latin letter or pinyin tone mark
    valid_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
    tone_marks = set('āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ')

    for char in pinyin:
        if char not in valid_chars and char not in tone_marks:
            return False

    # Must contain at least one vowel
    vowels = set('aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ')
    if not any(c in vowels for c in pinyin.lower()):
        return False

    # Must have at least one tone mark (accented character)
    # This prevents random English words from being accepted
    has_tone_mark = any(c in tone_marks for c in pinyin)

    # Single character pinyin must have a tone mark
    if len(pinyin) == 1 and not has_tone_mark:
        return False

    # Multi-character should either have tone mark or be all lowercase
    # (all lowercase is suspicious unless it's in our exception list)
    if len(pinyin) > 1 and not has_tone_mark:
        # Only accept if it looks phonetically valid
        # Common English words that aren't pinyin: "is", "This", "some", etc.
        # Real pinyin syllables always start with valid pinyin initials
        valid_initials = set('bpmfdtnlgkhjqxzhchshrzcsyw')
        first_char = pinyin[0].lower()

        # If doesn't start with valid pinyin initial, reject
        if first_char not in valid_initials and first_char not in vowels:
            return False

    return has_tone_mark


def extract_pinyin_from_text(text: str) -> List[str]:
    """Extract pinyin syllables from text"""
    # Match pinyin with tone marks (including single-character pinyin like ā, ē)
    pinyin_pattern = r'\b[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]+\b'
    matches = re.findall(pinyin_pattern, text)
    # Keep syllables that are either:
    # 1. More than 1 character, OR
    # 2. Single character with a tone mark (non-ASCII)
    candidates = [m for m in matches if m and (len(m) > 1 or ord(m[0]) > 127)]

    # Filter to valid pinyin (permissive - just skip invalid ones)
    valid_pinyin = [c for c in candidates if validate_pinyin(c)]

    return valid_pinyin


def validate_character_pinyin(char: Character, char_hanzi: str):
    """
    Validate the pinyin field in a Character object.
    Throws exception if pinyin is present but invalid.
    """
    if 'pinyin' not in char:
        return  # No pinyin to validate

    pinyin_list = char.get('pinyin', [])
    if not pinyin_list:
        return  # Empty list is okay

    invalid = []
    for pinyin in pinyin_list:
        if not validate_pinyin(pinyin):
            invalid.append(pinyin)

    if invalid:
        raise ValueError(
            f"Invalid pinyin in character '{char_hanzi}': {invalid}. "
            f"Full character data: {char}"
        )


def parse_character_from_li(li_element) -> Optional[Character]:
    """Parse a character entry from a list item"""
    if not li_element:
        return None

    char: Character = {}

    # Get the complete text from li element
    li_text = li_element.get_text()

    # Get text from red tags (this is the explanation)
    red_elements = li_element.find_all('red')
    red_text = ""
    for red in red_elements:
        red_text += red.get_text() + " "
    red_text = red_text.strip()

    # Parse the structure: "榊 shén: explanation; meaning"
    # or "阿 ā (ē): meaning"
    # First, get character and pinyin
    match = re.match(r'^([^\s]+)\s+([^:]+):\s*(.*)$', li_text)

    if match:
        char['traditional'] = match.group(1)

        # Extract pinyin from the second group (handles "shén" or "ā (ē)")
        pinyin_text = match.group(2).strip()
        pinyin = extract_pinyin_from_text(pinyin_text)

        # Also check if red text contains pinyin that we should use
        if red_text:
            red_pinyin = extract_pinyin_from_text(red_text)
            if red_pinyin:
                # If we already have pinyin, combine them
                if pinyin:
                    # Add any new pinyin from red text that's not already in the list
                    for rp in red_pinyin:
                        if rp not in pinyin:
                            pinyin.append(rp)
                else:
                    pinyin = red_pinyin

        if pinyin:
            char['pinyin'] = pinyin

        # Everything after colon
        after_colon = match.group(3).strip()

        # Split on semicolon to separate explanation from meaning
        if ';' in after_colon:
            parts = after_colon.split(';', 1)
            explanation_part = parts[0].strip()
            meaning_part = parts[1].strip()

            # Check if explanation part matches red text
            if red_text:
                # Remove "(orig.)" markers
                clean_red = red_text.replace("(orig.)", "").strip()
                # Remove trailing colon from red text if present
                clean_red = clean_red.rstrip(':')

                # Check if red text is just pinyin
                is_just_pinyin = clean_red in (pinyin or [])

                # Only set explanation if it's not just the pinyin
                if clean_red and not is_just_pinyin:
                    char['explanation'] = clean_red
                # Meaning is everything after the semicolon
                char['meaning'] = meaning_part
            else:
                # No red text, so first part is meaning
                char['meaning'] = after_colon
        else:
            # No semicolon - check if we have red text
            if red_text:
                clean_red = red_text.replace("(orig.)", "").strip().rstrip(':')

                # Check if red text is just pinyin
                is_just_pinyin = clean_red in (pinyin or [])

                # Only set explanation if it's not just the pinyin
                if clean_red and not is_just_pinyin:
                    char['explanation'] = clean_red
                # The non-red part is the meaning
                meaning = after_colon.replace(red_text, '').strip()
                if meaning:
                    char['meaning'] = meaning
            else:
                # Everything is the meaning
                char['meaning'] = after_colon

    # Validate pinyin before returning
    if char.get('traditional'):
        validate_character_pinyin(char, char['traditional'])

    return char if char.get('traditional') else None


def parse_outlier_html(html_str: str) -> OutlierData:
    """Parse Outlier dictionary HTML into structured data"""
    if not html_str or not BS4_AVAILABLE:
        return {}

    soup = BeautifulSoup(html_str, 'html.parser')
    data: OutlierData = {}

    # Get main character from h1
    h1 = soup.find('h1')
    if h1:
        h1_text = h1.get_text(strip=True)
        # Extract character from "System level info for component 神"
        match = re.search(r'component\s+(.)', h1_text)
        if match:
            data['traditional'] = match.group(1)

    # Process each h2 section
    current_h2 = None
    pending_text = []

    for element in soup.find_all(['h2', 'p', 'ul', 'span']):
        if element.name == 'h2':
            current_h2 = element.get_text(strip=True).lower()
            pending_text = []

        elif element.name in ['p', 'span'] and current_h2:
            p_text = element.get_text(strip=True)
            if p_text:
                pending_text.append(p_text)

        elif element.name == 'ul' and current_h2:
            # Parse list items as characters
            characters = []
            for li in element.find_all('li', recursive=False):
                char = parse_character_from_li(li)
                if char:
                    characters.append(char)

            explanation = ' '.join(pending_text).strip()

            if 'sound series' in current_h2:
                if 'sound_series' not in data:
                    data['sound_series'] = {}
                if characters:
                    data['sound_series']['characters'] = characters
                if explanation:
                    data['sound_series']['explanation'] = explanation

            elif 'semantic series' in current_h2:
                if 'semantic_series' not in data:
                    data['semantic_series'] = {}
                if characters:
                    data['semantic_series']['characters'] = characters
                if explanation:
                    data['semantic_series']['explanation'] = explanation

            pending_text = []

    # Handle sections without lists
    for element in soup.find_all(['h2', 'p']):
        if element.name == 'h2':
            current_h2 = element.get_text(strip=True).lower()
        elif element.name == 'p' and current_h2:
            p_text = element.get_text(strip=True)
            if 'empty component' in current_h2 and p_text:
                data['empty_component'] = p_text
            elif 'radical' in current_h2 and p_text:
                data['radical'] = p_text

    return data


def rebuild_from_html_files():
    """Rebuild JSON files from saved HTML files"""
    script_dir = Path(__file__).parent.parent.parent
    html_dir = script_dir / 'data' / 'pleco' / 'outlier_series'
    json_dir = script_dir / 'public' / 'data' / 'pleco' / 'outlier_series'

    if not html_dir.exists():
        print(f"Directory not found: {html_dir}", file=sys.stderr)
        return

    html_files = list(html_dir.glob('*.html'))

    if not html_files:
        print(f"No HTML files found in {html_dir}", file=sys.stderr)
        return

    # Ensure JSON output directory exists
    json_dir.mkdir(parents=True, exist_ok=True)

    print(f"Found {len(html_files)} HTML files to rebuild")
    print("=" * 80)

    for html_file in sorted(html_files):
        print(f"\nProcessing: {html_file.name}")

        try:
            with open(html_file, 'r', encoding='utf-8') as f:
                html_content = f.read()

            outlier_data = parse_outlier_html(html_content)

            if outlier_data.get('traditional'):
                char = outlier_data['traditional']
                json_file = json_dir / f'{char}.json'

                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(outlier_data, f, ensure_ascii=False, indent=2)

                print(f"  ✓ Saved: {json_file}")
            else:
                print(f"  ✗ No character found in HTML", file=sys.stderr)

        except Exception as e:
            print(f"  ✗ Error processing {html_file.name}: {e}", file=sys.stderr)

    print("\n" + "=" * 80)
    print("Rebuild complete!")


def main():
    parser = argparse.ArgumentParser(description='Extract Outlier dictionary data from clipboard')
    parser.add_argument('--rebuild', action='store_true',
                       help='Rebuild JSON files from saved HTML files')
    args = parser.parse_args()

    if args.rebuild:
        rebuild_from_html_files()
        return

    print("=" * 80)
    print("CLIPBOARD CONTENT ANALYSIS")
    print("=" * 80)
    print()

    # Show available formats
    print("Available clipboard formats:")
    print("-" * 80)
    formats = get_clipboard_formats()
    if formats:
        print(formats)
    print()

    # Get plain text
    print("PLAIN TEXT:")
    print("-" * 80)
    plain_text = get_clipboard_plain_text()
    if plain_text:
        print(plain_text)
        print(f"\nLength: {len(plain_text)} characters")
        print(f"Lines: {len(plain_text.splitlines())}")
    else:
        print("No plain text available")
    print()

    # Get RTF
    print("RTF CONTENT:")
    print("-" * 80)
    rtf_data = get_clipboard_rtf()
    if rtf_data and rtf_data != 'missing value':
        parsed_rtf = parse_hex_data(rtf_data, "RTF")
        if parsed_rtf:
            print(parsed_rtf)
        else:
            print("RTF data (raw):")
            print(rtf_data[:500])  # Show first 500 chars
            if len(rtf_data) > 500:
                print(f"... (truncated, total length: {len(rtf_data)})")
    else:
        print("No RTF content available")
    print()

    # Get HTML
    print("HTML CONTENT (DECODED):")
    print("-" * 80)
    html_data = get_clipboard_html()
    if html_data and html_data != 'missing value':
        parsed_html = parse_hex_data(html_data, "HTML")
        if parsed_html:
            formatted = format_html_readable(parsed_html)
            print(formatted if formatted else parsed_html)

            # Extract text structure
            print("\n" + "=" * 80)
            print("STRUCTURED TEXT EXTRACTION FROM HTML:")
            print("-" * 80)
            if BS4_AVAILABLE:
                soup = BeautifulSoup(parsed_html, 'html.parser')

                # Find all headings
                for heading in soup.find_all(['h1', 'h2', 'h3']):
                    print(f"\n{heading.name.upper()}: {heading.get_text(strip=True)}")

                # Find all lists
                for ul in soup.find_all('ul'):
                    for li in ul.find_all('li'):
                        # Get text, preserving special formatting
                        text = ""
                        for element in li.descendants:
                            if element.name == 'red':
                                text += f"[RED]{element.get_text()}[/RED]"
                            elif isinstance(element, str):
                                text += str(element)
                        print(f"  • {text.strip()}")

                # Find paragraphs
                for p in soup.find_all('p'):
                    p_text = p.get_text(strip=True)
                    if p_text:
                        print(f"\nP: {p_text}")
            else:
                print("(Install beautifulsoup4 for structured extraction)")
        else:
            print("Could not parse HTML, showing raw:")
            print(html_data[:500])
    else:
        print("No HTML content available")
    print()

    # Parse and output JSON
    if html_data and html_data != 'missing value':
        parsed_html = parse_hex_data(html_data, "HTML")
        if parsed_html and BS4_AVAILABLE:
            print("=" * 80)
            print("STRUCTURED JSON OUTPUT:")
            print("-" * 80)
            outlier_data = parse_outlier_html(parsed_html)
            json_output = json.dumps(outlier_data, ensure_ascii=False, indent=2)
            print(json_output)
            print()

            # Save to file
            if outlier_data.get('traditional'):
                char = outlier_data['traditional']

                # Get script directory and construct paths
                script_dir = Path(__file__).parent.parent.parent
                json_dir = script_dir / 'public' / 'data' / 'pleco' / 'outlier_series'
                html_dir = script_dir / 'data' / 'pleco' / 'outlier_series'

                # Ensure directories exist
                json_dir.mkdir(parents=True, exist_ok=True)
                html_dir.mkdir(parents=True, exist_ok=True)

                json_file = json_dir / f'{char}.json'
                html_file = html_dir / f'{char}.html'

                try:
                    # Save JSON to public/data
                    with open(json_file, 'w', encoding='utf-8') as f:
                        json.dump(outlier_data, f, ensure_ascii=False, indent=2)

                    # Save HTML to data
                    with open(html_file, 'w', encoding='utf-8') as f:
                        f.write(parsed_html)

                    print("=" * 80)
                    print(f"JSON SAVED TO: {json_file}")
                    print(f"HTML SAVED TO: {html_file}")
                    print("-" * 80)
                    print()
                except Exception as e:
                    print(f"Error saving files: {e}", file=sys.stderr)
            else:
                print("No character found in data, skipping file save", file=sys.stderr)

    # Character analysis
    if plain_text:
        print("CHARACTER ANALYSIS:")
        print("-" * 80)
        print("First 100 characters with Unicode points:")
        for i, char in enumerate(plain_text[:100]):
            print(f"  {i:3d}: '{char}' U+{ord(char):04X} ({ord(char)}) - {char.encode('unicode_escape').decode('ascii')}")
        print()


if __name__ == '__main__':
    main()
