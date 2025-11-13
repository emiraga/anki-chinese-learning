#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Extract useful information from YellowBridge raw JSON files.

This script processes JSON files from public/data/yellowbridge/raw/ and extracts:
- Character information validation (filename matches character)
- Phonetic components (sound components)
- Pinyin readings
- Definitions
- Formation methods (Pictophonetic, Associative Compound, etc.)
- Component breakdown
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set
from html.parser import HTMLParser


class YellowBridgeHTMLParser(HTMLParser):
    """Parse HTML content to extract character information."""

    def __init__(self):
        super().__init__()
        self.current_tag = None
        self.current_attrs = {}
        self.data_buffer = []
        self.in_zh0_span = False
        self.in_em_tag = False

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        self.current_attrs = dict(attrs)
        if tag == 'span' and self.current_attrs.get('class') == 'zh0':
            self.in_zh0_span = True
        if tag == 'em':
            self.in_em_tag = True

    def handle_endtag(self, tag):
        if tag == 'span':
            self.in_zh0_span = False
        if tag == 'em':
            self.in_em_tag = False
        self.current_tag = None

    def handle_data(self, data):
        self.data_buffer.append((self.current_tag, data.strip(), self.in_zh0_span, self.in_em_tag))


def extract_phonetic_components(decomp_html: str) -> List[Dict[str, str]]:
    """
    Extract phonetic components from the decomposition HTML.

    Returns a list of dictionaries with 'character' and 'pinyin' keys.
    """
    phonetic_components = []

    # Look for phonetic component markers
    phonetic_pattern = r"<img src=['\"]//r\.yellowbridge\.com/images/char-phonetic\.gif['\"][^>]*><span class=['\"]?zh0['\"]?>([^<]+)</span>\s*\[<em>([^<]+)</em>\]"

    matches = re.findall(phonetic_pattern, decomp_html)
    for char, pinyin in matches:
        phonetic_components.append({
            'character': char.strip(),
            'pinyin': pinyin.strip()
        })

    return phonetic_components


def extract_character_info(decomp_html: str) -> Optional[Dict[str, str]]:
    """
    Extract the main character information from decomposition HTML.

    Returns a dictionary with 'character', 'pinyin', and 'definition' keys.
    """
    # Pattern for main character line - look for the dt.add call with index 1
    # The character info is in the format: <span class="zh0">支</span> [<em>zhī</em>] definition
    # Need to handle escaped quotes in the JavaScript string
    pattern = r'dt\.add\(1,\s*0,\s*["\']<span[^>]*class=\\*["\']zh0\\*["\'][^>]*>([^<]+)</span>\s*\[<em>([^<]+)</em>\]\s*([^"\'\\]*)["\']'

    match = re.search(pattern, decomp_html)
    if match:
        return {
            'character': match.group(1).strip(),
            'pinyin': match.group(2).strip(),
            'definition': match.group(3).strip()
        }

    return None


def extract_formation_methods(formation_html: str) -> List[Dict[str, str]]:
    """
    Extract formation methods from the formation HTML.

    Returns a list of formation method descriptions.
    """
    methods = []

    # Look for formation method list items
    # Format: <li>(会意) <b>Associative Compound.</b> Description with <a> tags.</li>
    method_pattern = r'<li>\(([^)]+)\)\s*<b>([^<]+)</b>\.?\s*(.*?)</li>'

    matches = re.findall(method_pattern, formation_html, re.DOTALL)
    for chinese_name, english_name, description in matches:
        # Extract referenced characters from the description
        char_refs = re.findall(r'<a[^>]*class=["\']zh0["\'][^>]*>([^<]+)</a>', description)
        if not char_refs:
            char_refs = re.findall(r'<span[^>]*class=["\']zh0["\'][^>]*>([^<]+)</span>', description)

        # Clean up description
        clean_desc = re.sub(r'<[^>]+>', '', description).strip()

        methods.append({
            'type_chinese': chinese_name.strip(),
            'type_english': english_name.strip(),
            'description': clean_desc,
            'referenced_characters': char_refs
        })

    return methods


def extract_definition(formation_html: str) -> Optional[str]:
    """Extract the English definition from formation HTML."""
    # Look for definition row
    pattern = r'<td>Definition</td>\s*<td>([^<]*(?:<a[^>]*>[^<]*</a>[^<]*)*)</td>'

    match = re.search(pattern, formation_html)
    if match:
        # Remove HTML tags
        definition = re.sub(r'<[^>]+>', '', match.group(1))
        return definition.strip()

    return None


def extract_components(decomp_html: str) -> List[Dict[str, str]]:
    """
    Extract all components (not just phonetic) from the decomposition.

    Returns a list of component dictionaries.
    """
    components = []
    seen = set()

    # Pattern for all character components in the dt.add calls
    # Format: dt.add(N, parent, "content with <span class="zh0">char</span> [<em>pinyin</em>] description", ...)
    component_pattern = r'<span class=["\']?zh0["\']?>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^"<]+?)(?=(?:<|"|\\))'

    matches = re.findall(component_pattern, decomp_html)
    for char, pinyin, description in matches:
        char = char.strip()
        pinyin_clean = pinyin.strip() if pinyin.strip() else None
        # Clean description - remove trailing characters and HTML entities
        desc_clean = re.sub(r'[\s;,]+$', '', description.strip())
        desc_clean = re.sub(r'\.\.\.$', '', desc_clean)

        # Create a unique key to avoid duplicates
        key = f"{char}|{pinyin_clean}"
        if key not in seen:
            seen.add(key)
            components.append({
                'character': char,
                'pinyin': pinyin_clean,
                'description': desc_clean
            })

    return components


def extract_radical(decomp_html: str) -> Optional[Dict[str, str]]:
    """Extract the key radical component."""
    # Look for radical component with key radical marker
    radical_pattern = r"<img src=['\"]//r\.yellowbridge\.com/images/char-keyradical\.gif['\"][^>]*><span class=['\"]?zh0['\"]?>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^\"]*)"

    match = re.search(radical_pattern, decomp_html)
    if match:
        return {
            'character': match.group(1).strip(),
            'pinyin': match.group(2).strip() if match.group(2).strip() else None,
            'description': match.group(3).strip()
        }

    return None


def extract_simplification(formation_html: str) -> Optional[Dict[str, str]]:
    """Extract simplification information if present."""
    # Look for simplification row
    pattern = r'<td>Simplification<br>Method[^<]*</td>\s*<td>(.*?)</td>'

    match = re.search(pattern, formation_html, re.DOTALL)
    if match:
        content = match.group(1)

        # Extract simplified form
        simplified_pattern = r'Simplified form is <a[^>]*>([^<]+)</a>'
        simplified_match = re.search(simplified_pattern, content)

        if simplified_match:
            return {
                'simplified_form': simplified_match.group(1).strip(),
                'method': re.sub(r'<[^>]+>', '', content).strip()
            }

    return None


def process_file(file_path: Path) -> Dict:
    """
    Process a single YellowBridge JSON file.

    Returns extracted information as a dictionary.
    """
    filename_char = file_path.stem  # Character from filename

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {file_path}: {e}")
    except Exception as e:
        raise ValueError(f"Error reading {file_path}: {e}")

    decomp_html = data.get('decomp', '')
    formation_html = data.get('formation', '')

    # Extract character info
    char_info = extract_character_info(decomp_html)

    # Validate that filename matches character
    if char_info and char_info['character'] != filename_char:
        raise ValueError(
            f"Character mismatch: filename '{filename_char}' != "
            f"content '{char_info['character']}'"
        )

    # Extract all data
    result = {
        'character': char_info['character'] if char_info else filename_char,
        'pinyin': char_info['pinyin'] if char_info else None,
        'definition': extract_definition(formation_html),
        'phonetic_components': extract_phonetic_components(decomp_html),
        'radical': extract_radical(decomp_html),
        'formation_methods': extract_formation_methods(formation_html),
        'all_components': extract_components(decomp_html),
        'simplification': extract_simplification(formation_html),
        'source_file': file_path.name
    }

    return result


def process_directory(
    input_dir: Path,
    output_file: Optional[Path] = None,
    individual_files_dir: Optional[Path] = None
) -> Dict[str, Dict]:
    """
    Process all JSON files in the input directory.

    Args:
        input_dir: Directory containing raw JSON files
        output_file: Optional output file path for processed data
        individual_files_dir: Optional directory to write individual character files

    Returns:
        Dictionary mapping characters to their extracted data
    """
    results = {}
    errors = []

    json_files = sorted(input_dir.glob('*.json'))

    print(f"Processing {len(json_files)} files from {input_dir}...")

    for file_path in json_files:
        try:
            result = process_file(file_path)
            char = result['character']
            results[char] = result
            print(f"✓ {char} ({file_path.name})")

            # Print phonetic components if found
            if result['phonetic_components']:
                for pc in result['phonetic_components']:
                    print(f"  → Phonetic: {pc['character']} [{pc['pinyin']}]")

        except Exception as e:
            error_msg = f"✗ {file_path.name}: {e}"
            print(error_msg)
            errors.append(error_msg)

    print(f"\n{'='*60}")
    print(f"Processed: {len(results)} characters")
    print(f"Errors: {len(errors)}")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"  {error}")

    # Write combined output if specified
    if output_file:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\nCombined output written to: {output_file}")

    # Write individual files if specified
    if individual_files_dir:
        individual_files_dir.mkdir(parents=True, exist_ok=True)
        for char, info in results.items():
            individual_file = individual_files_dir / f"{char}.json"
            with open(individual_file, 'w', encoding='utf-8') as f:
                json.dump(info, f, ensure_ascii=False, indent=2)
        print(f"Individual files written to: {individual_files_dir} ({len(results)} files)")

    return results


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Extract useful data from YellowBridge raw JSON files'
    )
    parser.add_argument(
        '--input',
        type=Path,
        default=Path('public/data/yellowbridge/raw'),
        help='Input directory containing raw JSON files'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('public/data/yellowbridge/processed.json'),
        help='Output JSON file for processed data'
    )
    parser.add_argument(
        '--individual-dir',
        type=Path,
        default=Path('public/data/yellowbridge/info'),
        help='Directory to write individual character JSON files'
    )
    parser.add_argument(
        '--single',
        type=Path,
        help='Process a single file instead of a directory'
    )
    parser.add_argument(
        '--no-individual',
        action='store_true',
        help='Skip creating individual character files'
    )

    args = parser.parse_args()

    if args.single:
        # Process single file
        try:
            result = process_file(args.single)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Process directory
        if not args.input.exists():
            print(f"Error: Input directory not found: {args.input}", file=sys.stderr)
            sys.exit(1)

        individual_dir = None if args.no_individual else args.individual_dir
        process_directory(args.input, args.output, individual_dir)


if __name__ == '__main__':
    main()
