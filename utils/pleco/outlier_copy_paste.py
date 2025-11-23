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


def extract_pinyin_from_text(text: str) -> List[str]:
    """Extract pinyin syllables from text"""
    # Match pinyin with tone marks
    pinyin_pattern = r'\b[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]+\b'
    matches = re.findall(pinyin_pattern, text)
    return [m for m in matches if m and len(m) > 1]


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
    # First, get character and pinyin
    match = re.match(r'^([^\s]+)\s+([^:]+):\s*(.*)$', li_text)

    if match:
        char['traditional'] = match.group(1)

        # Extract pinyin from the second group
        pinyin_text = match.group(2).strip()
        pinyin = extract_pinyin_from_text(pinyin_text)
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

                # Only set explanation if it's not just the pinyin
                if clean_red and clean_red not in pinyin:
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
                # Only set explanation if it's not just the pinyin
                if clean_red and clean_red not in pinyin:
                    char['explanation'] = clean_red
                # The non-red part is the meaning
                meaning = after_colon.replace(red_text, '').strip()
                if meaning:
                    char['meaning'] = meaning
            else:
                # Everything is the meaning
                char['meaning'] = after_colon

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

    for element in soup.find_all(['h2', 'p', 'ul', 'span']):
        if element.name == 'h2':
            current_h2 = element.get_text(strip=True).lower()

        elif element.name == 'p' and current_h2:
            p_text = element.get_text(strip=True)

            if 'sound series' in current_h2:
                if 'sound_series' not in data:
                    data['sound_series'] = {'characters': []}
                if data['sound_series'] and p_text:
                    data['sound_series']['explanation'] = p_text

            elif 'semantic series' in current_h2:
                if 'semantic_series' not in data:
                    data['semantic_series'] = {'characters': []}
                if data['semantic_series'] and p_text:
                    # Accumulate explanation text
                    current_exp = data['semantic_series'].get('explanation', '')
                    data['semantic_series']['explanation'] = (current_exp + ' ' + p_text).strip()

            elif 'empty component' in current_h2:
                data['empty_component'] = p_text

            elif 'radical' in current_h2:
                data['radical'] = p_text

        elif element.name == 'ul' and current_h2:
            # Parse list items as characters
            characters = []
            for li in element.find_all('li', recursive=False):
                char = parse_character_from_li(li)
                if char:
                    characters.append(char)

            if characters:
                if 'sound series' in current_h2:
                    if 'sound_series' not in data:
                        data['sound_series'] = {}
                    data['sound_series']['characters'] = characters

                elif 'semantic series' in current_h2:
                    if 'semantic_series' not in data:
                        data['semantic_series'] = {}
                    data['semantic_series']['characters'] = characters

    return data


def main():
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
