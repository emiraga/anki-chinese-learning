#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
#   "hanziconv",
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

Command line options:
- --overwrite: Force rebuild all files, ignoring modification times
- --character CHAR: Process only the specified character
- --delete-invalid: Delete files that fail processing due to exceptions
"""

import argparse
import base64
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict
from bs4 import BeautifulSoup
from hanziconv import HanziConv


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
        ValueError: If an unexpected character type is found or if images are missing for etymology IDs
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
    result = {
        key: parse_etymology_section(soup, header_text, image_map)
        for key, header_text in character_types.items()
    }

    # Validate: Check if any etymology IDs are missing images
    missing_images = []
    for section_name, section_data in result.items():
        for item in section_data.get("items", []):
            if item["id"] and not item["image"]:
                missing_images.append((section_name, item["id"]))

    if missing_images:
        missing_list = ", ".join(f"{section}:{id}" for section, id in missing_images)
        raise ValueError(
            f"Missing images for etymology IDs in etymologyStyles CSS: {missing_list}. "
            f"Found {len(missing_images)} etymology ID(s) in HTML that don't have corresponding "
            f"inline style definitions."
        )

    return result


def extract_etymology_images(etymology_styles: str, character: str, images_dir: Path) -> Dict[str, str]:
    """
    Extract base64-encoded images from etymologyStyles CSS and save them to files.

    Args:
        etymology_styles: CSS string with base64-encoded background images
        character: The Chinese character (used for unique filenames)
        images_dir: Directory to save image files

    Returns:
        Dictionary mapping etymology IDs to image paths (relative to public/)

    Raises:
        ValueError: If character is not '車' and image ID 'J29285' is found (indicates wrong file)
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

    # Validate: J29285 should only appear for character '車'
    if "J29285" in result and (character != "車" and character != "车"):
        raise ValueError(
            f"Image ID 'J29285' found for character '{character}'. "
            f"This ID should only appear for character '車'. "
            f"This indicates the wrong file data was loaded."
        )

    return result


def extract_best_character(char_string: str) -> str:
    """
    Extract the best single character from a string containing multiple character variants.

    Prefers traditional Chinese characters over simplified, and filters out
    non-standard or archaic variants. Uses the pattern that characters in parentheses
    are typically simplified forms: "(simplified)traditional".

    Args:
        char_string: String containing Chinese characters, possibly with parentheses
                    and multiple variants (e.g., "(车)車" or "艮𥃩")

    Returns:
        Single best character, or original string if no suitable character found
    """
    # Check if there are parentheses - if so, prefer characters NOT in parentheses
    # Pattern: "(simplified)traditional" or "(simplified)variant1variant2" - we want the last traditional
    if '(' in char_string and ')' in char_string:
        # Extract characters outside parentheses
        outside_parens = ""
        inside_parens = False
        for char in char_string:
            if char == '(':
                inside_parens = True
            elif char == ')':
                inside_parens = False
            elif not inside_parens:
                outside_parens += char

        # Collect all candidates outside parentheses in the main CJK block
        candidates_outside = []
        for char in outside_parens:
            code_point = ord(char)
            # Main CJK block is preferred
            if 0x4E00 <= code_point <= 0x9FFF:
                candidates_outside.append(char)

        # If we found candidates, prefer the LAST one (most standard traditional form)
        if candidates_outside:
            return candidates_outside[-1]

    # If no parentheses or no character found outside, use all characters
    # Extract all Chinese characters (CJK Unified Ideographs and extensions)
    # Main block: U+4E00-U+9FFF
    # Extension A: U+3400-U+4DBF
    # Extension B and beyond: U+20000-U+2EBEF (but these are rare/archaic)
    candidates = []
    for char in char_string:
        if char in ('(', ')'):
            continue
        code_point = ord(char)
        # Prefer characters in the main CJK block
        if 0x4E00 <= code_point <= 0x9FFF:
            candidates.append((char, 0))  # Priority 0 (highest)
        # Extension A is also acceptable (contains some traditional forms)
        elif 0x3400 <= code_point <= 0x4DBF:
            candidates.append((char, 1))  # Priority 1
        # Extension B and beyond are less common, lower priority
        elif 0x20000 <= code_point <= 0x2EBEF:
            candidates.append((char, 2))  # Priority 2 (lowest)

    if not candidates:
        # No Chinese characters found, return original
        return char_string.strip()

    # Sort by priority (lower number = higher priority)
    candidates.sort(key=lambda x: x[1])

    # Return the highest priority character
    return candidates[0][0]


def extract_character_variants(char_field: str) -> Dict[str, Any]:
    """
    Extract variant information from the character field.

    Patterns:
    - "char older 𣂺" -> olderForms: ["𣂺"]
    - "char mutant 緫" -> mutants: ["緫"]
    - "char mutants 镸𠑿" -> mutants: ["镸", "𠑿"]

    Args:
        char_field: The character field from the first line

    Returns:
        Dictionary with character, olderForms, and mutants
    """
    result: Dict[str, Any] = {"character": ""}
    parts = char_field.split()

    if not parts:
        return result

    # The first part is always the main character
    result["character"] = parts[0]

    # Look for "older", "mutant", or "mutants" keywords
    i = 1
    while i < len(parts):
        if parts[i] == "older" and i + 1 < len(parts):
            if "olderForms" not in result:
                result["olderForms"] = []
            # Collect all characters after "older" until we hit another keyword
            i += 1
            while i < len(parts) and parts[i] not in ["mutant", "mutants", "older"]:
                # Each character in the string is a separate older form
                for char in parts[i]:
                    if '\u4e00' <= char <= '\u9fff' or '\u3400' <= char <= '\u4dbf' or ord(char) >= 0x20000:
                        result["olderForms"].append(char)
                i += 1
        elif parts[i] == "mutant" and i + 1 < len(parts):
            if "mutants" not in result:
                result["mutants"] = []
            i += 1
            for char in parts[i]:
                if '\u4e00' <= char <= '\u9fff' or '\u3400' <= char <= '\u4dbf' or ord(char) >= 0x20000:
                    result["mutants"].append(char)
            i += 1
        elif parts[i] == "mutants" and i + 1 < len(parts):
            if "mutants" not in result:
                result["mutants"] = []
            i += 1
            # "mutants" can have multiple characters in one string
            while i < len(parts) and parts[i] not in ["older", "mutant", "mutants"]:
                for char in parts[i]:
                    if '\u4e00' <= char <= '\u9fff' or '\u3400' <= char <= '\u4dbf' or ord(char) >= 0x20000:
                        result["mutants"].append(char)
                i += 1
        else:
            i += 1

    return result


def extract_simplification_rules(line: str) -> Dict[str, Any]:
    """
    Extract simplification rule information from a line.

    Patterns:
    - "A037 处[處] simp 处" -> rule: "A037", simplified: "处"
    - "B012 长[長] new-char 长" -> rule: "B012", newChar: "长"
    - "F003 (内)內" -> rule: "F003"

    Args:
        line: A line potentially containing rule information

    Returns:
        Dictionary with rule information
    """
    result: Dict[str, Any] = {}

    # Pattern: Letter followed by digits (A037, B012, F003, etc.)
    rule_match = re.match(r'^([A-Z]\d+)\s+(.+)', line)
    if rule_match:
        result["rule"] = rule_match.group(1)
        rest = rule_match.group(2)

        # Look for "simp X" pattern
        simp_match = re.search(r'simp\s+(\S+)', rest)
        if simp_match:
            result["simplified"] = simp_match.group(1).rstrip('.')

        # Look for "new-char X" pattern
        newchar_match = re.search(r'new-char\s+(\S+)', rest)
        if newchar_match:
            result["newChar"] = newchar_match.group(1).rstrip('.')

    return result


def parse_decomposition_notes(notes_text: str) -> Dict[str, Any]:
    """
    Parse the "Decomposition notes" field into structured data.

    Patterns found:
    - (- explanation) - Parenthetical explanatory notes
    - A### characters - Rule references with related characters
    - see characters - Cross-references
    - (original-, inversion-, Kangxi, etc.) - Special markers
    - char pinyin - Related character references
    - Plain text - General explanations

    Args:
        notes_text: The decomposition notes text

    Returns:
        Dictionary with structured notes data
    """
    if not notes_text or notes_text.strip() in ["Not applicable.", "Not applicable", "/"]:
        return {}

    lines = notes_text.strip().split('\n')
    result: Dict[str, Any] = {}
    explanatory_notes = []
    rule_references = []
    cross_references = []
    related_characters = []
    special_markers = []
    plain_text = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for explanatory notes: (- text)
        if line.startswith('(-'):
            # Extract the note content
            note = line.strip('()')
            if note.startswith('- '):
                note = note[2:].strip()
            explanatory_notes.append(note)

        # Check for rule references: A### or similar pattern
        elif re.match(r'^[A-Z]\d+\s+', line):
            # Parse rule reference line
            match = re.match(r'^([A-Z]\d+)\s+(.+)', line)
            if match:
                rule_code = match.group(1)
                characters_part = match.group(2).strip()
                rule_references.append({
                    "code": rule_code,
                    "characters": characters_part
                })

        # Check for cross-references: "see characters" or "(- see characters)"
        elif 'see ' in line.lower():
            # Extract the referenced characters
            see_match = re.search(r'see\s+([^\)]+)', line, re.IGNORECASE)
            if see_match:
                ref_chars = see_match.group(1).strip()
                cross_references.append(ref_chars)

        # Check for special markers in parentheses
        elif line.startswith('(') and line.endswith(')'):
            marker = line.strip('()')
            special_markers.append(marker)

        # Check for character references: char pinyin (single line)
        elif re.search(r'[\u4e00-\u9fff]\s+[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ]+', line):
            related_characters.append(line)

        # Plain text explanation
        else:
            plain_text.append(line)

    # Build result structure
    if explanatory_notes:
        result["explanations"] = explanatory_notes
    if rule_references:
        result["ruleReferences"] = rule_references
    if cross_references:
        result["crossReferences"] = cross_references
    if related_characters:
        result["relatedCharacters"] = related_characters
    if special_markers:
        result["specialMarkers"] = special_markers
    if plain_text:
        result["notes"] = plain_text

    return result


def parse_character_decomposition(decomposition_text: str) -> Dict[str, Any]:
    """
    Parse the "Character decomposition 字形分解" field into a structured format.

    Args:
        decomposition_text: The plain text decomposition string

    Returns:
        Structured dictionary with type, character, components, and names, plus:
        - olderForms: Historical character forms
        - mutants: Variant/mutant forms
        - variantOf: Characters this is a variant of
        - simplificationRules: Rule references (A037, B012, etc.)
        - simplifiedForm/newCharForm: Simplified character forms
        - crossReferences: Related character references
    """
    if not decomposition_text or decomposition_text.strip() == "":
        return {}

    lines = decomposition_text.strip().split('\n')
    if not lines:
        return {}

    # Parse the first line to get type and character with variants
    first_line = lines[0].strip()
    decomp_type = None
    char_field = ""

    if first_line.startswith("Compound "):
        decomp_type = "Compound"
        char_field = first_line[9:].strip()  # Remove "Compound "
    elif first_line.startswith("Component "):
        decomp_type = "Component"
        char_field = first_line[10:].strip()  # Remove "Component "
    elif first_line == "Compound" or first_line == "Component":
        # Handle missing character name
        decomp_type = first_line
        char_field = ""
    else:
        # Unknown format, return raw text
        return {"raw": decomposition_text}

    # Extract character and variants from char_field
    variant_info = extract_character_variants(char_field) if char_field else {"character": ""}

    result: Dict[str, Any] = {
        "type": decomp_type,
        "character": variant_info.get("character", ""),
        "components": [],
        "names": []
    }

    # Add variant information if present
    if "olderForms" in variant_info:
        result["olderForms"] = variant_info["olderForms"]
    if "mutants" in variant_info:
        result["mutants"] = variant_info["mutants"]

    notes_lines = []
    simplification_rules = []
    cross_references = []

    # Parse remaining lines - combine multi-line component descriptions
    i = 1
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue

        # Check for simplification rules (A037, B012, etc.)
        if re.match(r'^[A-Z]\d+', line):
            rule_info = extract_simplification_rules(line)
            if rule_info:
                simplification_rules.append(rule_info)
            continue

        # Check for cross-references (See X or see X)
        if line.startswith("See ") or line.startswith("see "):
            # Extract the referenced characters
            ref_chars = line[4:].strip()
            cross_references.append(ref_chars)
            continue

        # Check for variant-of pattern
        if line.startswith("(variant-of ") and line.endswith(")"):
            variant_of = line[12:-1].strip()  # Remove "(variant-of " and ")"
            result["variantOf"] = variant_of
            continue

        # Check for standalone "simp X" or "new-char X" lines
        simp_match = re.match(r'^simp\s+(\S+)', line)
        if simp_match:
            result["simplifiedForm"] = simp_match.group(1).rstrip('.')
            continue

        newchar_match = re.match(r'^new-char\s+(\S+)', line)
        if newchar_match:
            result["newCharForm"] = newchar_match.group(1).rstrip('.')
            continue

        # Check for name entries like "(name- heart 忄 xīn)"
        if line.startswith("(name-") and line.endswith(")"):
            # Extract content between "(name-" and ")"
            name_content = line[6:-1].strip()  # Remove "(name-" and ")"

            # Try to parse: "description char pronunciation"
            # Split by spaces to find components
            parts = name_content.split()
            if len(parts) >= 2:
                # Last part might be pronunciation, second to last is character
                char = parts[-2]
                pronunciation = parts[-1] if len(parts) >= 2 else None

                # Everything before character is the description
                description = " ".join(parts[:-2]) if len(parts) > 2 else parts[0]

                result["names"].append({
                    "name": description,
                    "character": char,
                    "pronunciation": pronunciation
                })

        # Check for component entries like "from door 户戶戸 hù and" or just "from"
        elif line.startswith("from"):
            # Collect all parts of this component (may span multiple lines)
            component_lines = [line]

            # Check if the line is just "from" with nothing after it, or ends with "and"/"from"
            # Handle both "from " and "from" (without space)
            if line.startswith("from "):
                line_content = line[5:].strip()  # Remove "from " prefix
            elif line == "from":
                line_content = ""
            else:
                line_content = line[4:].strip()  # Remove "from" prefix (no space)

            should_continue = (line.endswith(" and") or line.endswith(" from") or not line_content)

            # If continuation is needed, collect following lines
            while should_continue and i < len(lines):
                next_line = lines[i].strip()
                i += 1
                # Continue collecting if it's a component line (even if it starts with parentheses)
                # Stop if we hit a rule reference, variant-of, or other metadata
                if next_line and not re.match(r'^[A-Z]\d+', next_line) and \
                   not next_line.startswith("See ") and not next_line.startswith("see ") and \
                   not next_line.startswith("(variant-of "):
                    component_lines.append(next_line)
                    line = next_line  # Update line for next iteration
                    # Continue if this line ends with "and", or if it's a marker line followed by more
                    should_continue = line.endswith(" and") or (line.endswith(")") and i < len(lines))
                else:
                    # This line is not part of the component, put it back
                    i -= 1
                    break

            # Parse each component line
            for comp_line in component_lines:
                comp_text = comp_line

                # Remove "from " prefix from first line
                if comp_text.startswith("from "):
                    comp_text = comp_text[5:].strip()

                # Remove trailing "and", "from", or "." if present
                if comp_text.endswith(" and"):
                    comp_text = comp_text[:-4].strip()
                elif comp_text.endswith(" from"):
                    comp_text = comp_text[:-5].strip()
                elif comp_text.endswith("."):
                    comp_text = comp_text[:-1].strip()

                # Check for markers in parentheses (rem-, rem+, not-)
                markers: Dict[str, Any] = {}

                # Extract (rem- X) pattern - this extracts the character info from the marker
                rem_minus_match = re.search(r'\(rem-\s+([^)]+)\)', comp_text)
                if rem_minus_match:
                    marker_content = rem_minus_match.group(1).strip()
                    # Parse the marker content: "char pronunciation" (e.g., "一 yī")
                    marker_parts = marker_content.split()
                    if len(marker_parts) >= 2:
                        markers["removed"] = {
                            "character": marker_parts[0],
                            "pronunciation": marker_parts[1]
                        }
                    else:
                        markers["removed"] = marker_content

                # Extract (rem+ X) pattern
                rem_plus_match = re.search(r'\(rem\+\s+([^)]+)\)', comp_text)
                if rem_plus_match:
                    marker_content = rem_plus_match.group(1).strip()
                    # Check if there are multiple components separated by '+'
                    if '+' in marker_content:
                        # Split by '+' and parse each component
                        component_parts = [part.strip() for part in marker_content.split('+')]
                        added_list = []
                        for part in component_parts:
                            part_tokens = part.split()
                            if len(part_tokens) >= 2:
                                added_list.append({
                                    "character": part_tokens[0],
                                    "pronunciation": part_tokens[1]
                                })
                            elif len(part_tokens) == 1:
                                added_list.append(part_tokens[0])
                        markers["added"] = added_list if len(added_list) > 1 else added_list[0] if added_list else marker_content
                    else:
                        marker_parts = marker_content.split()
                        if len(marker_parts) >= 2:
                            markers["added"] = {
                                "character": marker_parts[0],
                                "pronunciation": marker_parts[1]
                            }
                        else:
                            markers["added"] = marker_content

                # Extract (not- X) pattern
                not_match = re.search(r'\(not-\s+([^)]+)\)', comp_text)
                if not_match:
                    marker_content = not_match.group(1).strip()
                    marker_parts = marker_content.split()
                    if len(marker_parts) >= 2:
                        markers["not"] = {
                            "character": marker_parts[0],
                            "pronunciation": marker_parts[1]
                        }
                    else:
                        markers["not"] = marker_content

                # Remove all parenthetical notes for cleaner parsing
                comp_text = re.sub(r'\([^)]+\)', '', comp_text).strip()

                # If after removing markers, the line is empty or only has a quantity word,
                # this was a marker-only component with optional quantity
                # We still want to add it to show what was removed/added/negated
                quantity_words = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
                is_quantity_only = comp_text.lower() in quantity_words

                if (not comp_text or is_quantity_only) and markers:
                    # Create a marker-only entry
                    component_entry: Dict[str, Any] = {
                        "description": "",
                        "characters": "",
                        "component": "",
                        "pronunciation": "",
                        "markers": markers
                    }
                    if is_quantity_only:
                        component_entry["quantity"] = comp_text
                    result["components"].append(component_entry)
                    continue

                # Check if this is a phonetic component (contains "phonetic" anywhere)
                is_phonetic = "phonetic" in comp_text.lower()

                # If it starts with "phonetic ", remove that prefix for cleaner description
                if comp_text.startswith("phonetic "):
                    comp_text = comp_text[9:].strip()
                # Also handle "related phonetic" by removing just "related " prefix
                elif comp_text.startswith("related phonetic "):
                    comp_text = comp_text[8:].strip()  # Remove "related "

                # Parse the component text
                # Pattern: "quantity description characters pronunciation"
                # e.g., "three tree 木 mù" or "two person-right 匕 bǐ"

                # Split into parts
                parts = comp_text.split()
                if len(parts) >= 2:
                    # Check for quantity words at the start
                    quantity = None
                    quantity_words = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
                    if parts[0].lower() in quantity_words:
                        quantity = parts[0]
                        parts = parts[1:]  # Remove quantity from parts

                    # Last part is likely pronunciation (pinyin)
                    pronunciation = parts[-1] if parts else ""

                    # Find where Chinese characters start (they'll be consecutive)
                    # Work backwards from second-to-last part
                    char_start_idx = len(parts) - 2 if len(parts) >= 2 else 0
                    while char_start_idx > 0 and any('\u4e00' <= c <= '\u9fff' for c in parts[char_start_idx - 1]):
                        char_start_idx -= 1

                    # Everything from char_start_idx to -1 (exclusive) is characters
                    characters = " ".join(parts[char_start_idx:-1]) if len(parts) >= 2 else ""
                    # Everything before is description
                    description = " ".join(parts[:char_start_idx]) if char_start_idx > 0 else parts[0] if parts else ""

                    component_entry: Dict[str, Any] = {
                        "description": description,
                        "characters": characters,
                        "component": extract_best_character(characters) if characters else "",
                        "pronunciation": pronunciation
                    }

                    if quantity:
                        component_entry["quantity"] = quantity

                    if is_phonetic:
                        component_entry["role"] = "phonetic"

                    # Add markers if present
                    if markers:
                        component_entry["markers"] = markers

                    result["components"].append(component_entry)

        # Lines starting with capital letters followed by numbers are likely reference codes
        elif re.match(r'^[A-Z]\d+', line):
            notes_lines.append(line)

    # Add notes if any
    if notes_lines:
        result["notes"] = " ".join(notes_lines)

    # Add simplification rules if any
    if simplification_rules:
        result["simplificationRules"] = simplification_rules

    # Add cross-references if any
    if cross_references:
        result["crossReferences"] = cross_references

    return result


def convert_character_info(character_info: list[str]) -> Dict[str, str]:
    """
    Convert characterInfo array into a dictionary with plain text values.

    Args:
        character_info: Array of HTML-formatted strings

    Returns:
        Dictionary mapping labels to plain text content

    Raises:
        ValueError: If duplicate labels are found (indicates multiple characters in one file)
    """
    result: Dict[str, Any] = {}
    seen_labels: Dict[str, int] = {}  # Track labels and their first occurrence index

    for i, item in enumerate(character_info):
        extracted = extract_label_and_content(item)

        if extracted:
            label, content = extracted

            # Check for duplicate labels
            if label in result:
                raise ValueError(
                    f"Duplicate label '{label}' found in characterInfo at index {i}. "
                    f"First occurrence at index {seen_labels[label]}. "
                    f"This indicates the file contains data for multiple characters. "
                    f"Previous value: '{result[label][:50]}...', New value: '{content[:50]}...'"
                )

            result[label] = content
            seen_labels[label] = i
        else:
            # If no label found, convert to plain text and store under numbered key
            text = html_to_text(item)
            if text:  # Only add non-empty items
                result[f"_unlabeled_{i}"] = text

    return result


def needs_rebuild(input_path: Path, output_path: Path) -> bool:
    """
    Check if the output file needs to be rebuilt based on modification times.

    Args:
        input_path: Path to input JSON file
        output_path: Path to output JSON file

    Returns:
        True if the file needs to be rebuilt, False otherwise
    """
    # If output doesn't exist, we need to rebuild
    if not output_path.exists():
        return True

    # Compare modification times
    input_mtime = input_path.stat().st_mtime
    output_mtime = output_path.stat().st_mtime

    # Rebuild if input is newer than output
    return input_mtime > output_mtime


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

        # Validate that filename character matches the traditional, simplified, or older traditional field
        traditional_field = converted.get('Traditional in your browser 繁体字的浏览器显示', '')
        simplified_field = converted.get('Simplified in your browser 简体字的浏览器显示', '')
        older_traditional_field = converted.get('Older traditional characters 旧繁体字/异体字', '')

        # Check if the character is actually a simplified character
        is_actually_simplified = HanziConv.toTraditional(character) != character

        # Check if character matches exactly or is contained within the older traditional variants
        is_valid = (
            character == traditional_field or
            (character == simplified_field and is_actually_simplified) or
            character in older_traditional_field
        )

        if not is_valid:
            raise ValueError(
                f"Character mismatch in {input_path.name}: filename character '{character}' "
                f"does not match traditional '{traditional_field}', "
                f"simplified '{simplified_field}' (is_simplified={is_actually_simplified}), "
                f"or is not found in older traditional '{older_traditional_field}'"
            )

        # Extract and save etymology images first (to get the image map)
        etymology_styles = data.get('etymologyStyles', '')
        etymology_images = extract_etymology_images(etymology_styles, character, images_dir)

        # Convert etymologyCharacters with image paths
        etymology_chars = data.get('etymologyCharacters', '')
        converted_etymology = convert_etymology_characters(etymology_chars, etymology_images) if etymology_chars else {}

        # Parse character decomposition
        decomposition_text = converted.get('Character decomposition 字形分解', '')
        character_decomposition = parse_character_decomposition(decomposition_text)

        # Parse decomposition notes
        notes_text = converted.get('Decomposition notes 字形分解说明', '')
        decomposition_notes = parse_decomposition_notes(notes_text)

        # Create output structure
        output_data = {
            'characterInfo': converted,
            'etymologyCharacters': converted_etymology,
            'characterDecomposition': character_decomposition,
            'decompositionNotes': decomposition_notes
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
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description="Convert Hanziyuan JSON files by extracting and structuring character data."
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Force rebuild all files, ignoring modification times"
    )
    parser.add_argument(
        "--character",
        type=str,
        help="Process only the specified character (e.g., --character 車)"
    )
    parser.add_argument(
        "--delete-invalid",
        action="store_true",
        help="Delete files that fail processing due to exceptions"
    )
    args = parser.parse_args()

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
    if args.character:
        # Process only the specified character
        json_file = raw_dir / f"{args.character}.json"
        if not json_file.exists():
            print(f"Error: File not found for character '{args.character}': {json_file}", file=sys.stderr)
            sys.exit(1)
        json_files = [json_file]
        print(f"Processing single character: {args.character}")
    else:
        json_files = sorted(raw_dir.glob("*.json"))

    if not json_files:
        print(f"No JSON files found in {raw_dir}", file=sys.stderr)
        sys.exit(1)

    if not args.character:
        print(f"Found {len(json_files)} JSON files")
        if args.overwrite:
            print("Overwrite mode: rebuilding all files\n")
        else:
            print("Incremental mode: rebuilding only changed files\n")

    # Process each file
    errors = 0
    processed = 0
    skipped = 0
    deleted = 0
    ignored_files = {"home.json", "news.json", "research.json", "wechat.json"}  # Non-character files to ignore

    for json_file in json_files:
        # Skip ignored files
        if json_file.name in ignored_files:
            skipped += 1
            continue

        output_file = output_dir / json_file.name

        # Check if rebuild is needed (skip check if overwrite flag is set)
        if not args.overwrite and not needs_rebuild(json_file, output_file):
            skipped += 1
            continue

        try:
            process_file(json_file, output_file, images_dir)
            processed += 1
        except Exception:
            errors += 1
            if args.delete_invalid:
                try:
                    json_file.unlink()
                    deleted += 1
                    print(f"✗ Deleted invalid file: {json_file.name}", file=sys.stderr)
                except Exception as delete_error:
                    print(f"Failed to delete {json_file.name}: {delete_error}", file=sys.stderr)

    print(f"\nProcessed: {processed} files")
    if not args.overwrite:
        print(f"Skipped: {skipped} files (already up-to-date)")
    if args.delete_invalid and deleted > 0:
        print(f"Deleted: {deleted} invalid files", file=sys.stderr)
    if errors:
        print(f"Errors: {errors}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"Output directory: {output_dir}")
        print(f"Images directory: {images_dir}")


if __name__ == "__main__":
    main()
