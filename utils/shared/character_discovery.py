#!/usr/bin/env python3
"""
Shared utilities for character discovery across dong, rtega, and yellowbridge scripts.

This module provides a simple interface to discover all characters from:
- Anki notes
- Three standard data directories: dong, yellowbridge/raw, rtega
"""

import json
import unicodedata
from pathlib import Path
from collections import Counter
from typing import Set, Tuple, List, Dict

from .anki_utils import anki_connect_request


def normalize_cjk_char(char: str) -> str:
    """
    Normalize CJK characters by converting compatibility ideographs to canonical forms.
    """
    if not char:
        return char
    normalized = unicodedata.normalize('NFKC', char)
    return unicodedata.normalize('NFC', normalized)


def extract_all_characters(text: str, normalize: bool = False) -> Set[str]:
    """
    Extract all Chinese characters from a text string.
    """
    chars = set()
    for char in text:
        code_point = ord(char)
        if (0x4E00 <= code_point <= 0x9FFF or  # CJK Unified Ideographs
            0x3400 <= code_point <= 0x4DBF or  # CJK Unified Ideographs Extension A
            0x20000 <= code_point <= 0x2A6DF or  # CJK Unified Ideographs Extension B
            0x2A700 <= code_point <= 0x2B73F or  # CJK Unified Ideographs Extension C
            0x2B740 <= code_point <= 0x2B81F or  # CJK Unified Ideographs Extension D
            0x2B820 <= code_point <= 0x2CEAF or  # CJK Unified Ideographs Extension E
            0x2CEB0 <= code_point <= 0x2EBEF or  # CJK Unified Ideographs Extension F
            0xF900 <= code_point <= 0xFAFF or    # CJK Compatibility Ideographs
            0x2F800 <= code_point <= 0x2FA1F):   # CJK Compatibility Ideographs Supplement
            chars.add(normalize_cjk_char(char) if normalize else char)
    return chars


def get_notes_info_batch(note_ids: List[int]) -> List[Dict]:
    """Get detailed information about multiple notes in a batch."""
    if not note_ids:
        return []

    response = anki_connect_request("notesInfo", {"notes": note_ids})

    if response and response.get("result"):
        return response["result"]

    raise Exception("Failed to fetch notes")


def find_all_notes_with_traditional(note_type: str, extra_filter: str = "") -> List[int]:
    """Find all notes with Traditional field."""
    search_query = f'note:{note_type} Traditional:_* {extra_filter}'
    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) in {note_type}")
            return note_ids

    print(f"No notes found in {note_type}")
    return []


def _get_anki_characters(normalize: bool = False) -> Tuple[Set[str], Counter]:
    """Collect all characters from Anki notes."""
    note_types = [
        ("TOCFL", ""),
        ("Hanzi", ""),

    ]

    anki_chars = set()
    char_frequency = Counter()
    batch_size = 100

    for note_type, extra_filter in note_types:
        print(f"\nProcessing note type: {note_type}")
        note_ids = find_all_notes_with_traditional(note_type, extra_filter)

        for i in range(0, len(note_ids), batch_size):
            batch = note_ids[i:i + batch_size]
            try:
                notes_info = get_notes_info_batch(batch)

                for note_info in notes_info:
                    traditional = note_info['fields'].get('Traditional', {}).get('value', '')
                    if traditional:
                        chars = extract_all_characters(traditional, normalize=normalize)
                        anki_chars.update(chars)
                        char_frequency.update(chars)
            except Exception as e:
                print(f"  Error processing batch starting at note {i}: {e}")

    print(f"\nTotal unique characters from Anki: {len(anki_chars)}")
    return anki_chars, char_frequency


def _scan_data_directories(project_root: Path, normalize: bool = False) -> Tuple[Set[str], Counter]:
    """Scan the three standard data directories for existing character files."""
    data_dirs = [
        project_root / "public" / "data" / "dong",
        project_root / "public" / "data" / "yellowbridge" / "raw",
        # project_root / "data" / "rtega"
        project_root / "public" / "data" / "hanziyuan" / "converted",
        project_root / "public" / "data" / "hackchinese" / "outlier",
        project_root / "public" / "data" / "pleco" / "outlier_series",
    ]

    all_chars = set()
    char_frequency = Counter()

    for data_dir in data_dirs:
        if not data_dir.exists():
            print(f"Warning: Directory does not exist: {data_dir}")
            continue

        files = list(data_dir.glob("*"))
        print(f"Scanning {len(files)} files in {data_dir}...")

        for file_path in files:
            if not file_path.is_file():
                continue

            char = file_path.stem
            if normalize:
                char = normalize_cjk_char(char)

            chars = extract_all_characters(char, normalize=normalize)
            all_chars.update(chars)
            char_frequency.update(chars)

    print(f"Found {len(all_chars)} unique characters from data directories")
    return all_chars, char_frequency


def _scan_outlier_series_json(project_root: Path, normalize: bool = False) -> Tuple[Set[str], Counter]:
    """Scan outlier series JSON files for characters in specific fields.

    Extracts characters from:
    - references[].char
    - sound_series.characters[].traditional
    - semantic_series.characters[].traditional
    - empty_component.characters[].traditional
    - radical.characters[].traditional
    """
    outlier_dir = project_root / "public" / "data" / "pleco" / "outlier_series"

    all_chars = set()
    char_frequency = Counter()

    if not outlier_dir.exists():
        print(f"Warning: Directory does not exist: {outlier_dir}")
        return all_chars, char_frequency

    json_files = list(outlier_dir.glob("*.json"))
    print(f"Scanning {len(json_files)} JSON files in {outlier_dir}...")

    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Extract from references[].char
            for ref in data.get('references', []):
                char = ref.get('char', '')
                if char:
                    chars = extract_all_characters(char, normalize=normalize)
                    all_chars.update(chars)
                    char_frequency.update(chars)

            # Extract from sound_series.characters[].traditional
            sound_series = data.get('sound_series', {})
            for char_entry in sound_series.get('characters', []):
                trad = char_entry.get('traditional', '')
                if trad:
                    chars = extract_all_characters(trad, normalize=normalize)
                    all_chars.update(chars)
                    char_frequency.update(chars)

            # Extract from semantic_series.characters[].traditional
            semantic_series = data.get('semantic_series', {})
            for char_entry in semantic_series.get('characters', []):
                trad = char_entry.get('traditional', '')
                if trad:
                    chars = extract_all_characters(trad, normalize=normalize)
                    all_chars.update(chars)
                    char_frequency.update(chars)

            # Extract from empty_component.characters[].traditional
            empty_component = data.get('empty_component', {})
            for char_entry in empty_component.get('characters', []):
                trad = char_entry.get('traditional', '')
                if trad:
                    chars = extract_all_characters(trad, normalize=normalize)
                    all_chars.update(chars)
                    char_frequency.update(chars)

            # Extract from radical.characters[].traditional
            radical = data.get('radical', {})
            for char_entry in radical.get('characters', []):
                trad = char_entry.get('traditional', '')
                if trad:
                    chars = extract_all_characters(trad, normalize=normalize)
                    all_chars.update(chars)
                    char_frequency.update(chars)

        except (json.JSONDecodeError, IOError) as e:
            print(f"  Error reading {file_path}: {e}")

    print(f"Found {len(all_chars)} unique characters from outlier series JSON files")
    return all_chars, char_frequency


def discover_all_characters(
    project_root: Path,
    include_anki: bool = True,
    include_folders: bool = True,
    normalize: bool = False
) -> Tuple[Set[str], Counter]:
    """
    Discover all characters from Anki and the standard data directories.

    This is the main entry point that loads characters from:
    1. Anki notes (TOCFL, MyWords, Hanzi, Dangdai)
    2. public/data/dong
    3. public/data/yellowbridge/raw
    4. public/data/hanziyuan/converted
    5. public/data/hackchinese/outlier
    6. public/data/pleco/outlier_series (filenames)
    7. public/data/pleco/outlier_series JSON files (referenced characters)

    Args:
        project_root (Path): Project root directory
        include_anki (bool): Whether to include Anki characters (default: True)
        include_folders (bool): Whether to include data directory characters (default: True)
        normalize (bool): Whether to normalize characters (default: False)

    Returns:
        tuple: (set of all characters, Counter of character frequency)
    """
    all_chars = set()
    char_frequency = Counter()

    # Get characters from Anki
    if include_anki:
        print(f"\n{'='*60}")
        print("SCANNING ANKI")
        print(f"{'='*60}")
        try:
            anki_chars, anki_freq = _get_anki_characters(normalize=normalize)
            all_chars.update(anki_chars)
            char_frequency.update(anki_freq)
        except Exception as e:
            print(f"Error scanning Anki: {e}")
            print("Continuing without Anki data...")
    else:
        print("Skipping Anki scan")

    # Get characters from data directories
    if include_folders:
        print(f"\n{'='*60}")
        print("SCANNING DATA DIRECTORIES")
        print(f"{'='*60}")
        dir_chars, dir_freq = _scan_data_directories(project_root, normalize=normalize)
        all_chars.update(dir_chars)
        char_frequency.update(dir_freq)

        # Scan outlier series JSON files for referenced characters
        print(f"\n{'='*60}")
        print("SCANNING OUTLIER SERIES JSON FILES")
        print(f"{'='*60}")
        outlier_chars, outlier_freq = _scan_outlier_series_json(project_root, normalize=normalize)
        all_chars.update(outlier_chars)
        char_frequency.update(outlier_freq)
    else:
        print("Skipping data directories scan")

    print(f"\n{'='*60}")
    print(f"TOTAL: {len(all_chars)} unique characters discovered")
    print(f"{'='*60}")

    return all_chars, char_frequency
