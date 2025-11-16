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


def extract_functional_components(decomp_html: str) -> Dict[str, List[Dict[str, str]]]:
    """
    Extract all functional components with their types from the decomposition HTML.

    Returns a dictionary with component types as keys:
    - phonetic: Components that suggest pronunciation
    - semantic: Components that suggest meaning (radicals)
    - primitive: Basic building blocks
    """
    components = {
        'phonetic': [],
        'semantic': [],
        'primitive': []
    }

    # Map image markers to component types
    component_patterns = [
        (r"<img src=['\"]//r\.yellowbridge\.com/images/char-phonetic\.gif['\"][^>]*><span class=['\"]?zh0['\"]?>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^\"<]*)", 'phonetic'),
        (r"<img src=['\"]//r\.yellowbridge\.com/images/char-(?:key)?radical\.gif['\"][^>]*><span class=['\"]?zh0['\"]?>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^\"<]*)", 'semantic'),
    ]

    seen_phonetic = set()
    seen_semantic = set()

    # Extract phonetic and semantic components
    for pattern, comp_type in component_patterns:
        matches = re.findall(pattern, decomp_html)
        for char, pinyin, description in matches:
            char = char.strip()
            # Split pinyin by comma to get multiple readings
            pinyin_list = [p.strip() for p in pinyin.split(',')] if pinyin.strip() else []
            desc_clean = description.strip()

            # Clean up description
            desc_clean = re.sub(r'[\s;,]+$', '', desc_clean)
            desc_clean = re.sub(r'\.\.\.$', '', desc_clean)

            # Check if this component is marked as altered (has delta.gif before it)
            is_altered = bool(re.search(
                rf"<img src=['\"]//r\.yellowbridge\.com/images/chars/delta\.gif['\"][^>]*>[^<]*<[^>]*>{re.escape(char)}</[^>]*>\s*\[<em>{re.escape(pinyin)}</em>\]",
                decomp_html
            ))

            component_data = {
                'character': char,
                'pinyin': pinyin_list,
                'description': desc_clean
            }

            if is_altered:
                component_data['isAltered'] = True

            if comp_type == 'phonetic':
                key = f"{char}|{','.join(pinyin_list)}"
                if key not in seen_phonetic:
                    seen_phonetic.add(key)
                    components['phonetic'].append(component_data)
            elif comp_type == 'semantic':
                key = f"{char}|{','.join(pinyin_list)}"
                if key not in seen_semantic:
                    seen_semantic.add(key)
                    components['semantic'].append(component_data)

    # Extract primitive components (those without phonetic or semantic markers)
    # These are basic building blocks that don't have explicit functional markers
    primitive_pattern = r'<img id=["\']idt\d+["\'] src=["\']//r\.yellowbridge\.com/images/char-primitive\.gif["\'][^>]*><a[^>]*><span class=["\']zh0["\']>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^<]*)</a>'

    primitive_matches = re.findall(primitive_pattern, decomp_html)
    seen_primitive = set()

    for char, pinyin, description in primitive_matches:
        char = char.strip()
        # Split pinyin by comma to get multiple readings
        pinyin_list = [p.strip() for p in pinyin.split(',')] if pinyin.strip() else []

        # Skip if already captured as phonetic or semantic
        key = f"{char}|{','.join(pinyin_list)}"
        if key not in seen_phonetic and key not in seen_semantic and key not in seen_primitive:
            seen_primitive.add(key)
            desc_clean = re.sub(r'<[^>]+>', '', description).strip()
            desc_clean = re.sub(r'[\s;,]+$', '', desc_clean)

            # Check if this component is marked as altered
            is_altered = bool(re.search(
                rf"<img src=['\"]//r\.yellowbridge\.com/images/chars/delta\.gif['\"][^>]*>[^<]*<[^>]*>{re.escape(char)}</[^>]*>\s*\[<em>{re.escape(pinyin)}</em>\]",
                decomp_html
            ))

            component_data = {
                'character': char,
                'pinyin': pinyin_list,
                'description': desc_clean
            }

            if is_altered:
                component_data['isAltered'] = True

            components['primitive'].append(component_data)

    return components


def extract_phonetic_components(decomp_html: str) -> List[Dict[str, str]]:
    """
    Extract phonetic components from the decomposition HTML.
    (Kept for backward compatibility)

    Returns a list of dictionaries with 'character' and 'pinyin' keys.
    """
    functional = extract_functional_components(decomp_html)
    return functional['phonetic']


def extract_character_info(decomp_html: str) -> Optional[Dict[str, str]]:
    """
    Extract the main character information from decomposition HTML.

    Returns a dictionary with 'character', 'pinyin' (as list), and 'definition' keys.
    """
    # Pattern for main character line - look for the dt.add call with index 1
    # The character info is in the format: <span class="zh0">支</span> [<em>zhī</em>] definition
    # Need to handle escaped quotes in the JavaScript string
    pattern = r'dt\.add\(1,\s*0,\s*["\']<span[^>]*class=\\*["\']zh0\\*["\'][^>]*>([^<]+)</span>\s*\[<em>([^<]+)</em>\]\s*([^"\'\\]*)["\']'

    match = re.search(pattern, decomp_html)
    if match:
        # Split pinyin by comma to get multiple readings
        pinyin_str = match.group(2).strip()
        pinyin_list = [p.strip() for p in pinyin_str.split(',')] if pinyin_str else []

        return {
            'character': match.group(1).strip(),
            'pinyin': pinyin_list,
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
            'typeChinese': chinese_name.strip(),
            'typeEnglish': english_name.strip(),
            'description': clean_desc,
            'referencedCharacters': char_refs
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
        # Split pinyin by comma to get multiple readings
        pinyin_list = [p.strip() for p in pinyin.split(',')] if pinyin.strip() else []
        # Clean description - remove trailing characters and HTML entities
        desc_clean = re.sub(r'[\s;,]+$', '', description.strip())
        desc_clean = re.sub(r'\.\.\.$', '', desc_clean)

        # Create a unique key to avoid duplicates
        key = f"{char}|{','.join(pinyin_list)}"
        if key not in seen:
            seen.add(key)

            # Check if this component is marked as altered
            is_altered = bool(re.search(
                rf"<img src=['\"]//r\.yellowbridge\.com/images/chars/delta\.gif['\"][^>]*>[^<]*<[^>]*>{re.escape(char)}</[^>]*>\s*\[<em>{re.escape(pinyin)}</em>\]",
                decomp_html
            ))

            component_data = {
                'character': char,
                'pinyin': pinyin_list,
                'description': desc_clean
            }

            if is_altered:
                component_data['isAltered'] = True

            components.append(component_data)

    return components


def extract_radical(decomp_html: str) -> Optional[Dict[str, str]]:
    """Extract the key radical component."""
    # Look for radical component with key radical marker
    radical_pattern = r"<img src=['\"]//r\.yellowbridge\.com/images/char-keyradical\.gif['\"][^>]*><span class=['\"]?zh0['\"]?>([^<]+)</span>\s*\[<em>([^<]*)</em>\]\s*([^\"]*)"

    match = re.search(radical_pattern, decomp_html)
    if match:
        description = match.group(3).strip()
        char = match.group(1).strip()
        pinyin_str = match.group(2).strip()

        # Split pinyin by comma to get multiple readings
        pinyin_list = [p.strip() for p in pinyin_str.split(',')] if pinyin_str else []

        # Extract Kangxi radical number if present
        kangxi_number = None
        kangxi_match = re.search(r'Kangxi radical (\d+)', description)
        if kangxi_match:
            kangxi_number = int(kangxi_match.group(1))

        # Check if this component is marked as altered
        is_altered = bool(re.search(
            rf"<img src=['\"]//r\.yellowbridge\.com/images/chars/delta\.gif['\"][^>]*>[^<]*<[^>]*>{re.escape(char)}</[^>]*>\s*\[<em>{re.escape(pinyin_str)}</em>\]",
            decomp_html
        ))

        result = {
            'character': char,
            'pinyin': pinyin_list,
            'description': description
        }

        if kangxi_number:
            result['kangxiRadicalNumber'] = kangxi_number

        if is_altered:
            result['isAltered'] = True

        return result

    return None


def extract_simplification(formation_html: str) -> Optional[Dict[str, str]]:
    """Extract simplification information if present."""
    # Look for simplification row
    # Need to handle the <span> tag with onclick that appears after "Method"
    pattern = r'<td>Simplification<br>Method[^<]*(?:<span[^>]*></span>)?</td>\s*<td>(.*?)</td>'

    match = re.search(pattern, formation_html, re.DOTALL)
    if match:
        content = match.group(1)

        # Extract simplified form
        simplified_pattern = r'Simplified form is <a[^>]*>([^<]+)</a>'
        simplified_match = re.search(simplified_pattern, content)

        # Extract simplification method type (e.g., "generic radical simplification #10")
        method_type = None
        generic_pattern = r'(generic (?:character|radical) simplification #\d+)'
        generic_match = re.search(generic_pattern, content, re.IGNORECASE)
        if generic_match:
            method_type = generic_match.group(1).strip()
        elif 'unique simplification' in content.lower():
            unique_pattern = r'(unique simplification #\d+)'
            unique_match = re.search(unique_pattern, content, re.IGNORECASE)
            if unique_match:
                method_type = unique_match.group(1).strip()

        if simplified_match:
            result = {
                'simplifiedForm': simplified_match.group(1).strip(),
                'method': re.sub(r'<[^>]+>', '', content).strip()
            }
            if method_type:
                result['methodType'] = method_type
            return result

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
    definition = extract_definition(formation_html)

    # Extract Kangxi radical number from definition if present
    kangxi_radical = None
    if definition:
        kangxi_match = re.search(r'Kangxi radical (\d+)', definition)
        if kangxi_match:
            kangxi_radical = int(kangxi_match.group(1))

    # Extract functional components
    functional_components = extract_functional_components(decomp_html)

    result = {
        'character': char_info['character'] if char_info else filename_char,
        'pinyin': char_info['pinyin'] if char_info else [],
        'definition': definition,
        'functionalComponents': functional_components,
        'radical': extract_radical(decomp_html),
        'formationMethods': extract_formation_methods(formation_html),
        'allComponents': extract_components(decomp_html),
        'simplification': extract_simplification(formation_html),
        'sourceFile': file_path.name
    }

    if kangxi_radical:
        result['kangxiRadical'] = kangxi_radical

    return result


def build_sounds_component_index(results: Dict[str, Dict]) -> Dict[str, Dict]:
    """
    Build an index mapping phonetic/sound components to characters that use them.

    Args:
        results: Dictionary mapping characters to their extracted data

    Returns:
        Dictionary mapping phonetic components to their usage information.
    """
    sounds_index = {}

    for char, data in results.items():
        phonetic_components = data.get('functionalComponents', {}).get('phonetic', [])

        for phonetic in phonetic_components:
            component_char = phonetic['character']

            # Initialize entry for this phonetic component if not exists
            if component_char not in sounds_index:
                sounds_index[component_char] = {
                    'component': {
                        'character': component_char,
                        'pinyin': phonetic.get('pinyin', []),
                        'description': phonetic.get('description', '')
                    },
                    'appearsIn': []
                }

            # Add this character to the list of characters using this phonetic component
            usage_info = {
                'character': char,
                'pinyin': data.get('pinyin', [])
            }

            # Include component-specific info if present
            if phonetic.get('description'):
                usage_info['componentDescription'] = phonetic['description']

            sounds_index[component_char]['appearsIn'].append(usage_info)

    # Sort the appearsIn lists by character for consistency
    for component_data in sounds_index.values():
        component_data['appearsIn'].sort(key=lambda x: x['character'])

    return sounds_index


def process_directory(
    input_dir: Path,
    output_file: Optional[Path] = None,
    individual_files_dir: Optional[Path] = None
) -> Dict[str, Dict]:
    """
    Process all JSON files in the input directory.

    Args:
        input_dir: Directory containing raw JSON files
        output_file: Optional output file path for processed data (indexes only)
        individual_files_dir: Optional directory to write individual character files

    Returns:
        Dictionary mapping characters to their extracted data
    """
    results = {}
    errors = []
    skipped = []

    json_files = sorted(input_dir.glob('*.json'))

    print(f"Processing {len(json_files)} files from {input_dir}...")

    for file_path in json_files:
        try:
            # Check if we should skip processing based on mtime comparison
            should_skip = False
            if individual_files_dir:
                # Try to determine the character from filename to check target file
                filename_char = file_path.stem
                target_file = individual_files_dir / f"{filename_char}.json"

                if target_file.exists():
                    source_mtime = file_path.stat().st_mtime
                    target_mtime = target_file.stat().st_mtime

                    if source_mtime <= target_mtime:
                        # Source hasn't been modified since target was created, skip processing
                        should_skip = True
                        skipped.append(filename_char)

                        # Still need to load the existing data for the combined output
                        if output_file:
                            with open(target_file, 'r', encoding='utf-8') as f:
                                result = json.load(f)
                                results[filename_char] = result
                        continue

            # Process the file
            result = process_file(file_path)
            char = result['character']
            results[char] = result
            print(f"✓ {char} ({file_path.name})")

            # Print phonetic components if found
            if result['functionalComponents']['phonetic']:
                for pc in result['functionalComponents']['phonetic']:
                    pinyin_str = ', '.join(pc['pinyin']) if pc['pinyin'] else ''
                    altered_marker = ' (altered)' if pc.get('isAltered') else ''
                    print(f"  → Phonetic: {pc['character']} [{pinyin_str}]{altered_marker}")

        except Exception as e:
            error_msg = f"✗ {file_path.name}: {e}"
            print(error_msg)
            errors.append(error_msg)

    print(f"\n{'='*60}")
    print(f"Processed: {len(results)} characters")
    if skipped:
        print(f"Skipped (unchanged): {len(skipped)} characters")
    print(f"Errors: {len(errors)}")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"  {error}")

    # Build aggregated indexes
    print(f"\nBuilding aggregated indexes...")
    sounds_component_in = build_sounds_component_index(results)
    print(f"  → soundsComponentIn: {len(sounds_component_in)} phonetic components")

    # Write indexes to combined output file (not character data - that's in individual files)
    if output_file:
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Only output aggregated indexes, not individual character data
        output_data = {
            'soundsComponentIn': sounds_component_in
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"\nIndexes written to: {output_file}")

    # Write individual files if specified
    if individual_files_dir:
        individual_files_dir.mkdir(parents=True, exist_ok=True)
        written_count = 0
        unchanged_count = 0

        for char, info in results.items():
            individual_file = individual_files_dir / f"{char}.json"

            # Serialize new content
            new_content = json.dumps(info, ensure_ascii=False, indent=2)

            # Check if file exists and compare content
            should_write = True
            if individual_file.exists():
                with open(individual_file, 'r', encoding='utf-8') as f:
                    existing_content = f.read()
                if existing_content == new_content:
                    should_write = False
                    unchanged_count += 1

            if should_write:
                with open(individual_file, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                written_count += 1

        print(f"\nIndividual files: {individual_files_dir}")
        print(f"  Updated: {written_count} files")
        print(f"  Unchanged: {unchanged_count} files")
        print(f"  Total: {len(results)} files")

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
