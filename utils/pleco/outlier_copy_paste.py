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

Usage:
    ./utils/pleco/outlier_copy_paste.py                    # Process clipboard content
    ./utils/pleco/outlier_copy_paste.py --auto-copy        # Auto-copy from iPhone Mirroring window
    ./utils/pleco/outlier_copy_paste.py --rebuild          # Rebuild JSON files from HTML files
    ./utils/pleco/outlier_copy_paste.py --preload-list     # Generate top 50 sound components to explore
"""

import subprocess
import sys
import re
import json
import argparse
import time
import hashlib
import base64
from pathlib import Path
from typing import TypedDict, List, Optional, Tuple
try:
    from bs4 import BeautifulSoup, NavigableString, Tag
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False


# Type definitions for Outlier dictionary data
class Reference(TypedDict, total=False):
    """A reference to another character"""
    char: str
    href: str


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


class EmptyComponentData(TypedDict, total=False):
    """Empty component data"""
    explanation: str
    characters: List[Character]


class RadicalData(TypedDict, total=False):
    """Radical data"""
    explanation: str
    characters: List[Character]


class OutlierData(TypedDict, total=False):
    """Complete Outlier dictionary entry structure"""
    traditional: str
    simplified: Optional[str]
    pinyin: Optional[List[str]]
    note: Optional[str]
    references: Optional[List[Reference]]
    sound_series: Optional[Series]
    semantic_series: Optional[Series]
    empty_component: Optional[EmptyComponentData]
    radical: Optional[RadicalData]
    raw_html: Optional[str]


def auto_copy_from_window(window_name: str = "iPhone Mirroring", clear_clipboard: bool = True):
    """
    Automatically copy content from a specific window by sending keyboard shortcuts.

    Args:
        window_name: Name of the window to target (default: "iPhone Mirroring")
        clear_clipboard: Whether to clear clipboard before copying (default: True)
    """
    try:
        # Step 0: Clear clipboard first (only on first attempt)
        if clear_clipboard:
            print("Step 0: Clearing clipboard...")
            clear_clipboard_script = 'set the clipboard to ""'
            subprocess.run(
                ['osascript', '-e', clear_clipboard_script],
                capture_output=True,
                text=True,
                check=True
            )
            time.sleep(0.2)
            print("  ✓ Clipboard cleared")

        # Step 1: Activate the application
        print(f"Step 1: Activating '{window_name}' window...")
        activate_script = f'tell application "{window_name}" to activate'
        subprocess.run(
            ['osascript', '-e', activate_script],
            capture_output=True,
            text=True,
            check=True
        )
        time.sleep(0.8)
        print("  ✓ Window activated")

        # Step 3: Select all (twice)
        print("Step 3: Selecting all content (twice)...")
        select_all_script = f'tell application "System Events" to tell process "{window_name}" to keystroke "a" using command down'
        subprocess.run(
            ['osascript', '-e', select_all_script],
            capture_output=True,
            text=True,
            check=True
        )
        time.sleep(0.3)
        print("  First select all done...")

        # Select all again to ensure everything is selected
        subprocess.run(
            ['osascript', '-e', select_all_script],
            capture_output=True,
            text=True,
            check=True
        )
        time.sleep(0.5)
        print("  ✓ Select all completed")

        # Step 4: Copy
        print("Step 4: Copying to clipboard...")
        copy_script = f'tell application "System Events" to tell process "{window_name}" to keystroke "c" using command down'
        subprocess.run(
            ['osascript', '-e', copy_script],
            capture_output=True,
            text=True,
            check=True
        )
        time.sleep(0.8)
        print("  ✓ Copy command sent")

        print(f"\n✓ Successfully copied from '{window_name}' window")
        return True

    except subprocess.CalledProcessError as e:
        print(f"✗ Error activating window or copying: {e}", file=sys.stderr)
        if e.stderr:
            print(f"  Details: {e.stderr}", file=sys.stderr)
        return False


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
                # Remove trailing colon from red text if present
                clean_red = red_text.rstrip(':')

                # Check if red text is just pinyin (after removing (orig.) for comparison)
                red_without_orig = clean_red.replace("(orig.)", "").strip()
                is_just_pinyin = red_without_orig in (pinyin or [])

                # Only set explanation if it's not just the pinyin
                if clean_red and not is_just_pinyin:
                    char['explanation'] = clean_red
                    # Meaning is everything after the semicolon (explanation was extracted)
                    char['meaning'] = meaning_part
                else:
                    # Red text was just pinyin, so the semicolon is separating meanings, not explanation
                    # Keep the full meaning including all parts
                    char['meaning'] = after_colon
            else:
                # No red text, so everything is meaning
                char['meaning'] = after_colon
        else:
            # No semicolon - check if we have red text
            if red_text:
                clean_red = red_text.rstrip(':')

                # Check if red text is just pinyin (after removing (orig.) for comparison)
                red_without_orig = clean_red.replace("(orig.)", "").strip()
                is_just_pinyin = red_without_orig in (pinyin or [])

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


def extract_image_id_from_img_tag(img_tag) -> Tuple[Optional[str], Optional[bytes]]:
    """
    Extract image data from an img tag and generate an ID for it.
    Returns (image_id, image_bytes) or (None, None) if no image data found.
    """
    if not img_tag:
        return None, None

    src = img_tag.get('src', '')
    if not src.startswith('data:image/'):
        return None, None

    # Parse data URL: data:image/svg+xml;base64,<data>
    try:
        # Split on comma to get the base64 data
        parts = src.split(',', 1)
        if len(parts) != 2:
            return None, None

        image_data_b64 = parts[1]
        image_bytes = base64.b64decode(image_data_b64)

        # Generate MD5 hash as ID
        image_id = hashlib.md5(image_bytes).hexdigest()

        return image_id, image_bytes
    except Exception as e:
        print(f"Error extracting image data: {e}", file=sys.stderr)
        return None, None


def save_image_to_disk(image_id: str, image_bytes: bytes, images_dir: Path) -> bool:
    """
    Save image bytes to disk with the given ID.
    Returns True if successful, False otherwise.
    """
    try:
        # Ensure images directory exists
        images_dir.mkdir(parents=True, exist_ok=True)

        # Determine file extension from image data
        # SVG images start with <?xml or <svg
        if image_bytes.startswith(b'<?xml') or image_bytes.startswith(b'<svg'):
            ext = 'svg'
        elif image_bytes.startswith(b'\x89PNG'):
            ext = 'png'
        elif image_bytes.startswith(b'\xff\xd8\xff'):
            ext = 'jpg'
        else:
            # Default to svg for unknown types
            ext = 'svg'

        image_path = images_dir / f'{image_id}.{ext}'

        with open(image_path, 'wb') as f:
            f.write(image_bytes)

        print(f"  Saved image: {image_path}")
        return True
    except Exception as e:
        print(f"  Error saving image: {e}", file=sys.stderr)
        return False


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

        # First check if there's an img tag in the h1 (character as image)
        img_tag = h1.find('img')
        if img_tag:
            image_id, image_bytes = extract_image_id_from_img_tag(img_tag)
            if image_id:
                # Save the image
                script_dir = Path(__file__).parent.parent.parent
                images_dir = script_dir / 'public' / 'data' / 'pleco' / 'images'
                save_image_to_disk(image_id, image_bytes, images_dir)

                # Use the image ID as the "traditional" character
                data['traditional'] = f"img_{image_id}"
            else:
                raise ValueError(f"Failed to extract image ID from img tag in h1: {h1}")
        else:
            # Extract character from "System level info for component 神"
            match = re.search(r'component\s+(.)', h1_text)
            if match:
                data['traditional'] = match.group(1)

    # Extract top-level note between h1 and first h2 (if any)
    # This captures notes like "口 is the canonical form. See also the series for variants: 厶(口)"
    # Also extract references from links
    if h1:
        first_h2 = soup.find('h2')
        note_parts = []
        references: List[Reference] = []

        for sibling in h1.find_next_siblings():
            if sibling == first_h2:
                break
            if sibling.name == 'p':
                # Get text with separator to preserve spacing between elements
                p_text = sibling.get_text(separator=' ', strip=True)
                if p_text:
                    note_parts.append(p_text)

                # Extract references from links in this paragraph
                for link in sibling.find_all('a'):
                    href = link.get('href', '')
                    # Get text from link, or from img alt if it's an image link
                    link_text = link.get_text(strip=True)
                    if not link_text:
                        # Check if there's an img tag inside
                        img = link.find('img')
                        if img:
                            # Extract and save the image, use its ID as the reference
                            image_id, image_bytes = extract_image_id_from_img_tag(img)
                            if image_id and image_bytes:
                                script_dir = Path(__file__).parent.parent.parent
                                images_dir = script_dir / 'public' / 'data' / 'pleco' / 'images'
                                save_image_to_disk(image_id, image_bytes, images_dir)
                                link_text = f"img_{image_id}"
                            else:
                                continue

                    if href and link_text:
                        ref: Reference = {
                            'char': link_text,
                            'href': href
                        }
                        references.append(ref)

        if note_parts:
            data['note'] = ' '.join(note_parts)
        if references:
            data['references'] = references

    # Extract main character pinyin from the first h2 section (usually sound series)
    # Look for pattern like "This is the sound series for 且 qiě."
    first_section = soup.find('h2')
    if first_section:
        # Get all siblings between this h2 and the next h2 or ul
        # The red tag with pinyin appears at the same level as span tags
        for sibling in first_section.find_next_siblings():
            if sibling.name == 'h2':
                break
            if sibling.name == 'ul':
                break
            # Check if this element itself is a red tag
            if sibling.name == 'red':
                red_text = sibling.get_text(strip=True)
                pinyin_candidates = extract_pinyin_from_text(red_text)
                if pinyin_candidates:
                    valid_pinyin = [p for p in pinyin_candidates if validate_pinyin(p)]
                    if valid_pinyin:
                        data['pinyin'] = valid_pinyin
                        break

    # Process each h2 section
    current_h2 = None
    pending_text = []
    pending_elements = []

    def save_section(h2_name, text_list, element_list, chars_list=None):
        """Helper to save section data"""
        if not h2_name:
            return

        explanation = ' '.join(text_list).strip() if text_list else None

        # Extract references from links in this section's elements
        section_refs: List[Reference] = []
        for elem in element_list:
            for link in elem.find_all('a'):
                href = link.get('href', '')
                link_text = link.get_text(strip=True)
                if not link_text:
                    # Check if there's an img tag inside
                    img = link.find('img')
                    if img:
                        # Extract and save the image, use its ID as the reference
                        image_id, image_bytes = extract_image_id_from_img_tag(img)
                        if image_id and image_bytes:
                            script_dir = Path(__file__).parent.parent.parent
                            images_dir = script_dir / 'public' / 'data' / 'pleco' / 'images'
                            save_image_to_disk(image_id, image_bytes, images_dir)
                            link_text = f"img_{image_id}"
                        else:
                            continue
                if href and link_text:
                    ref: Reference = {
                        'char': link_text,
                        'href': href
                    }
                    section_refs.append(ref)

        # Add section references to global references
        if section_refs:
            if 'references' not in data:
                data['references'] = []
            # Only add unique references
            for ref in section_refs:
                if ref not in data['references']:
                    data['references'].append(ref)

        if 'sound series' in h2_name:
            if 'sound_series' not in data:
                data['sound_series'] = {}
            if chars_list:
                data['sound_series']['characters'] = chars_list
            if explanation:
                data['sound_series']['explanation'] = explanation

        elif 'semantic series' in h2_name:
            if 'semantic_series' not in data:
                data['semantic_series'] = {}
            if chars_list:
                data['semantic_series']['characters'] = chars_list
            if explanation:
                data['semantic_series']['explanation'] = explanation

        elif 'empty component' in h2_name:
            if 'empty_component' not in data:
                data['empty_component'] = {}
            if chars_list:
                data['empty_component']['characters'] = chars_list
            if explanation:
                data['empty_component']['explanation'] = explanation

        elif 'radical' in h2_name:
            if 'radical' not in data:
                data['radical'] = {}
            if chars_list:
                data['radical']['characters'] = chars_list
            if explanation:
                data['radical']['explanation'] = explanation

    for element in soup.find_all(['h2', 'p', 'ul', 'span']):
        if element.name == 'h2':
            # Save previous section if it had only text, no list
            if current_h2 and pending_text:
                save_section(current_h2, pending_text, pending_elements)

            current_h2 = element.get_text(strip=True).lower()
            pending_text = []
            pending_elements = []

        elif element.name in ['p', 'span'] and current_h2:
            p_text = element.get_text(strip=True)
            if p_text:
                pending_text.append(p_text)
                pending_elements.append(element)

        elif element.name == 'ul' and current_h2:
            # Parse list items as characters
            characters = []
            for li in element.find_all('li', recursive=False):
                char = parse_character_from_li(li)
                if char:
                    characters.append(char)

            # Save section with both characters and explanation
            save_section(current_h2, pending_text, pending_elements, characters)
            pending_text = []
            pending_elements = []

    # Save final section if it had only text, no list
    if current_h2 and pending_text:
        save_section(current_h2, pending_text, pending_elements)

    return data


def generate_preload_list():
    """
    Generate a list of the top 50 characters to preload based on their usage as sound components.
    For each Dong Chinese JSON file, count how many entries in componentIn have type "sound".
    Skip characters that already have Outlier data.
    For each sound component, include one sample character that uses it.
    """
    script_dir = Path(__file__).parent.parent.parent
    dong_dir = script_dir / 'public' / 'data' / 'dong'
    outlier_dir = script_dir / 'public' / 'data' / 'pleco' / 'outlier_series'

    if not dong_dir.exists():
        raise FileNotFoundError(f"Dong Chinese directory not found: {dong_dir}")

    # Get existing outlier characters
    existing_outlier_chars = set()
    if outlier_dir.exists():
        for json_file in outlier_dir.glob('*.json'):
            char_name = json_file.stem
            if char_name and len(char_name) <= 2:
                existing_outlier_chars.add(char_name)

    print(f"Found {len(existing_outlier_chars)} existing Outlier entries")
    print()

    # Count sound component usage for each character and track sample characters
    sound_component_counts = {}
    sound_component_samples = {}  # Map from component to a sample character that uses it

    dong_files = list(dong_dir.glob('*.json'))
    print(f"Scanning {len(dong_files)} Dong Chinese files...")
    print()

    for json_file in dong_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            char = data.get('char')
            if not char:
                continue

            # Count how many entries in componentIn have type "sound"
            component_in = data.get('componentIn', [])
            sound_count = 0

            for usage in component_in:
                components = usage.get('components', [])
                using_char = usage.get('char')  # The character that uses this component

                for comp in components:
                    # Check if this is our character and has "sound" in type
                    if comp.get('character') == char and 'sound' in comp.get('type', []):
                        sound_count += 1
                        # Store the first sample character we find
                        if char not in sound_component_samples and using_char:
                            sound_component_samples[char] = using_char
                        break  # Only count once per usage entry

            if sound_count > 0:
                sound_component_counts[char] = sound_count

        except Exception as e:
            print(f"  Warning: Error processing {json_file.name}: {e}", file=sys.stderr)
            continue

    # Filter out characters that already have Outlier data
    filtered_counts = {
        char: count
        for char, count in sound_component_counts.items()
        if char not in existing_outlier_chars
    }

    # Sort by count (descending) and take top 50
    sorted_chars = sorted(filtered_counts.items(), key=lambda x: x[1], reverse=True)
    top_50 = sorted_chars[:50]

    # Display results
    print("=" * 80)
    print("TOP 50 SOUND COMPONENTS TO PRELOAD")
    print("=" * 80)
    print()

    if top_50:
        # Print as single line with sample characters
        result_parts = []
        for char, count in top_50:
            sample = sound_component_samples.get(char, '')
            result_parts.append(f"{char}{sample}")

        result = "".join(result_parts)
        print(result)
        print()
    else:
        print("No candidates found")
        print()

    print("=" * 80)
    print(f"Total characters with sound component usage: {len(sound_component_counts)}")
    print(f"Already have Outlier data: {len([c for c in sound_component_counts if c in existing_outlier_chars])}")
    print(f"Missing Outlier data: {len(filtered_counts)}")
    print()


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
    parser.add_argument('--preload-list', action='store_true',
                       help='Generate list of top 50 sound components to preload')
    parser.add_argument('--auto-copy', action='store_true',
                       help='Automatically copy from iPhone Mirroring window before processing')
    parser.add_argument('--window-name', type=str, default='iPhone Mirroring',
                       help='Name of window to copy from (default: iPhone Mirroring)')
    args = parser.parse_args()

    if args.rebuild:
        rebuild_from_html_files()
        return

    if args.preload_list:
        generate_preload_list()
        return

    # Auto-copy from window if requested
    if args.auto_copy:
        print("=" * 80)
        print("AUTO-COPY FROM WINDOW")
        print("=" * 80)
        print()
        if not auto_copy_from_window(args.window_name):
            print("\nFailed to auto-copy. Please copy manually and try again.", file=sys.stderr)
            sys.exit(1)
        print()
        # Give a bit more time for clipboard to be ready
        time.sleep(0.5)

        # Verify clipboard has content, retry if needed
        max_retries = 10
        retry_count = 0
        html_data = None

        while retry_count < max_retries:
            html_data = get_clipboard_html()
            if html_data and html_data != 'missing value':
                parsed_html = parse_hex_data(html_data, "HTML")
                if parsed_html and len(parsed_html.strip()) > 0:
                    print(f"✓ Successfully verified clipboard content")
                    break

            retry_count += 1
            if retry_count < max_retries:
                print(f"⚠ Clipboard empty or invalid (attempt {retry_count}/{max_retries}), retrying copy...")
                time.sleep(0.5)

                # Try copying again without clearing clipboard
                if not auto_copy_from_window(args.window_name, clear_clipboard=False):
                    print("\nFailed to auto-copy on retry. Please copy manually and try again.", file=sys.stderr)
                    sys.exit(1)
                time.sleep(0.5)

        if retry_count >= max_retries:
            print(f"\n✗ Failed to get valid clipboard content after {max_retries} attempts", file=sys.stderr)
            print("Please ensure the content is visible and try again.", file=sys.stderr)
            sys.exit(1)
        print()

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

    html_data = get_clipboard_html()
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
    # if plain_text:
    #     print("CHARACTER ANALYSIS:")
    #     print("-" * 80)
    #     print("First 100 characters with Unicode points:")
    #     for i, char in enumerate(plain_text[:100]):
    #         print(f"  {i:3d}: '{char}' U+{ord(char):04X} ({ord(char)}) - {char.encode('unicode_escape').decode('ascii')}")
    #     print()


if __name__ == '__main__':
    main()
