#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import json
import requests
import argparse
import unicodedata
from pathlib import Path
from typing import Set, List, Dict, Tuple


def anki_connect_request(action, params=None):
    """
    Send a request to anki-connect

    Args:
        action (str): The action to perform
        params (dict): Parameters for the action

    Returns:
        dict: Response from anki-connect
    """
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    try:
        response = requests.post("http://localhost:8765", json=request_data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to anki-connect: {e}")
        raise


def update_note_field(note_id, field_name, field_value):
    """
    Update a specific field of a note

    Args:
        note_id (int): The note ID
        field_name (str): Name of the field to update
        field_value (str): Value to set

    Returns:
        bool: True if successful
    """
    fields = {field_name: field_value}

    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": fields
        }
    })

    if response and response.get("error") is None:
        return True
    else:
        raise Exception(f"Failed to update field '{field_name}' for note {note_id}: {response.get('error')}")


def get_learned_characters() -> Set[str]:
    """
    Get all characters from Hanzi notes that are not new and not suspended

    Returns:
        Set[str]: Set of learned characters
    """
    # Query for Hanzi notes that are not new and not suspended
    search_query = 'note:Hanzi -is:suspended'

    response = anki_connect_request("findNotes", {"query": search_query})

    if not response or not response.get("result"):
        print("No learned Hanzi notes found")
        return set()

    note_ids = response["result"]
    print(f"Found {len(note_ids)} learned Hanzi notes")

    learned_chars = set()

    # Get note info for all notes
    notes_info = anki_connect_request("notesInfo", {"notes": note_ids})

    if notes_info and notes_info.get("result"):
        for note_info in notes_info["result"]:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            if traditional:
                # Take only the first character
                char = traditional[0]
                learned_chars.add(char)

    print(f"Total learned characters: {len(learned_chars)}")
    return learned_chars


def is_punctuation(char: str) -> bool:
    """
    Check if a character is punctuation (including Chinese punctuation)

    Args:
        char (str): Character to check

    Returns:
        bool: True if character is punctuation
    """
    # Common Chinese and Western punctuation
    chinese_punctuation = '。，、；：？！""''（）《》【】…—·'
    western_punctuation = '.,;:?!\'"()[]{}<>-–—…·'

    if char in chinese_punctuation or char in western_punctuation:
        return True

    # Check Unicode category for punctuation
    category = unicodedata.category(char)
    return category.startswith('P')


def can_use_sentence(sentence_text: str, learned_chars: Set[str]) -> bool:
    """
    Check if all characters in sentence are either punctuation or learned

    Args:
        sentence_text (str): The sentence to check
        learned_chars (Set[str]): Set of learned characters

    Returns:
        bool: True if sentence can be used
    """
    for char in sentence_text:
        # Skip whitespace
        if char.isspace():
            continue

        # Check if it's punctuation
        if is_punctuation(char):
            continue

        # Check if it's a learned character
        if char in learned_chars:
            continue

        # Check if it's a digit or Latin letter (sometimes used in Chinese text)
        if char.isdigit() or char.isascii():
            continue

        # Found a character that's not learned
        return False

    return True


ANKI_SENTENCE_NOTE_TYPES = ["TOCFL", "Dangdai", "MyWords"]


def load_anki_sentences(learned_chars: Set[str]) -> Dict[str, List[Tuple[str, str]]]:
    """
    Load sentences/words from Anki note types (TOCFL, Dangdai, MyWords).
    These have higher priority than HackChinese data.

    Args:
        learned_chars: Set of learned characters

    Returns:
        Dict mapping character to list of (traditional, meaning) tuples
    """
    char_sentences: Dict[str, List[Tuple[str, str]]] = {}
    total_sentences = 0

    for note_type in ANKI_SENTENCE_NOTE_TYPES:
        search_query = f'note:{note_type} -is:suspended'
        response = anki_connect_request("findNotes", {"query": search_query})

        if not response or not response.get("result"):
            print(f"No {note_type} notes found for sentences")
            continue

        note_ids = response["result"]
        print(f"Found {len(note_ids)} {note_type} notes for sentences")

        notes_info = anki_connect_request("notesInfo", {"notes": note_ids})

        if not notes_info or not notes_info.get("result"):
            continue

        for note_info in notes_info["result"]:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            meaning = note_info['fields'].get('Meaning', {}).get('value', '').strip()

            if not traditional or not meaning:
                continue

            # Check if all characters in this word are learned
            if not can_use_sentence(traditional, learned_chars):
                continue

            # Add this word to all learned characters that appear in it
            for char in traditional:
                if char in learned_chars:
                    if char not in char_sentences:
                        char_sentences[char] = []

                    sentence_tuple = (traditional, meaning)
                    if sentence_tuple not in char_sentences[char]:
                        char_sentences[char].append(sentence_tuple)
                        total_sentences += 1

    print(f"Loaded {total_sentences} Anki sentences for {len(char_sentences)} characters")
    return char_sentences


def load_all_word_data(learned_chars: Set[str]) -> Dict[str, Dict[str, List[Tuple[str, str]]]]:
    """
    Load all sentences and compounds from HackChinese word JSON files, grouped by character

    Args:
        learned_chars (Set[str]): Set of learned characters

    Returns:
        Dict[str, Dict[str, List[Tuple[str, str]]]]: Dictionary mapping character to dict with 'sentences' and 'compounds' keys,
        each containing list of (traditional, english) tuples
    """
    words_dir = Path(__file__).parent.parent.parent / "data" / "hackchinese" / "words"

    if not words_dir.exists():
        raise Exception(f"Words directory not found: {words_dir}")

    char_data: Dict[str, Dict[str, List[Tuple[str, str]]]] = {}
    processed_files = 0
    single_char_words = 0
    total_sentences_found = 0
    total_compounds_found = 0

    for json_file in sorted(words_dir.glob("*.json")):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            processed_files += 1

            # Check if this is a single character word
            traditional = data.get("word", {}).get("traditional", "")
            if len(traditional) != 1:
                continue

            single_char_words += 1
            char = traditional

            # Initialize data structure for this character
            if char not in char_data:
                char_data[char] = {"sentences": [], "compounds": []}

            # Get sentences for this character
            sentences = data.get("sentences", [])
            for sentence in sentences:
                sentence_trad = sentence.get("traditional", "")
                sentence_eng = sentence.get("english", "")

                if sentence_trad and sentence_eng:
                    if can_use_sentence(sentence_trad, learned_chars):
                        # Avoid duplicates
                        sentence_tuple = (sentence_trad, sentence_eng)
                        if sentence_tuple not in char_data[char]["sentences"]:
                            char_data[char]["sentences"].append(sentence_tuple)
                            total_sentences_found += 1

            # Get compounds for this character
            compounds = data.get("compounds", [])
            for compound in compounds:
                compound_trad = compound.get("traditional", "")
                compound_eng = compound.get("english", "")

                if compound_trad and compound_eng:
                    if can_use_sentence(compound_trad, learned_chars):
                        # Avoid duplicates
                        compound_tuple = (compound_trad, compound_eng)
                        if compound_tuple not in char_data[char]["compounds"]:
                            char_data[char]["compounds"].append(compound_tuple)
                            total_compounds_found += 1

        except Exception as e:
            print(f"Error loading {json_file}: {e}")
            continue

    print(f"Processed {processed_files} JSON files")
    print(f"Found {single_char_words} single-character words")
    print(f"Collected data for {len(char_data)} characters")
    print(f"Total sentences found: {total_sentences_found}")
    print(f"Total compounds found: {total_compounds_found}")

    return char_data


def generate_example_sentences_html(
    anki_sentences: List[Tuple[str, str]],
    sentences: List[Tuple[str, str]],
    compounds: List[Tuple[str, str]]
) -> str:
    """
    Generate HTML for Example sentences field (includes anki sentences, HackChinese sentences and compounds)

    Args:
        anki_sentences (List[Tuple[str, str]]): List of (traditional, english) tuples from Anki notes (highest priority)
        sentences (List[Tuple[str, str]]): List of (traditional, english) tuples for HackChinese sentences
        compounds (List[Tuple[str, str]]): List of (traditional, english) tuples for HackChinese compounds

    Returns:
        str: HTML string
    """
    if not anki_sentences and not sentences and not compounds:
        return ""

    html_parts = []
    seen_traditional: Set[str] = set()

    # Add Anki sentences first (highest priority)
    if anki_sentences:
        for trad, eng in anki_sentences[0:10]:
            html_parts.append(f"<p><b>{trad}</b><br>{eng}</p>")
            seen_traditional.add(trad)

    # Add HackChinese sentences (skip duplicates)
    if sentences:
        count = 0
        for trad, eng in sentences:
            if trad not in seen_traditional:
                html_parts.append(f"<p><b>{trad}</b><br>{eng}</p>")
                seen_traditional.add(trad)
                count += 1
                if count >= 10:
                    break

    # Add HackChinese compounds (skip duplicates)
    if compounds:
        count = 0
        for trad, eng in compounds:
            if trad not in seen_traditional:
                html_parts.append(f"<p><b>{trad}</b><br>{eng}</p>")
                seen_traditional.add(trad)
                count += 1
                if count >= 10:
                    break

    return "\n".join(html_parts)


def update_example_sentences(note_types, dry_run=False, limit=None, character=None):
    """
    Update notes with Example sentences

    Args:
        note_types (list): List of note type names to process
        dry_run (bool): If True, only print what would be updated
        limit (int): If specified, only process this many notes total
        character (str): If specified, only process this specific character
    """
    # Get learned characters
    print("Getting learned characters...")
    learned_chars = get_learned_characters()

    if not learned_chars:
        print("No learned characters found. Cannot proceed.")
        return

    # Load Anki sentences (highest priority)
    print("\nLoading sentences from Anki notes (TOCFL, Dangdai, MyWords)...")
    anki_sentences = load_anki_sentences(learned_chars)

    # Load all sentences and compounds from HackChinese
    print("\nLoading sentences and compounds from HackChinese data...")
    char_data = load_all_word_data(learned_chars)

    # Get notes to update
    all_note_ids = []

    for note_type in note_types:
        # Build search query
        search_query = f'note:{note_type}'
        if character:
            search_query += f' Traditional:{character}'
        else:
            search_query += f' Traditional:_'

        # Only get non-suspended notes
        search_query += ' -is:suspended'

        response = anki_connect_request("findNotes", {"query": search_query})
        if response and response.get("result"):
            note_ids = response["result"]
            char_info = f" for character '{character}'" if character else ""
            print(f"Found {len(note_ids)} {note_type} notes{char_info}")
            all_note_ids.extend(note_ids)
        else:
            char_info = f" for character '{character}'" if character else ""
            print(f"No {note_type} notes found{char_info}")

    if not all_note_ids:
        print("No notes found to process")
        return

    print(f"\nTotal notes across all types: {len(all_note_ids)}")

    if limit and not character:
        all_note_ids = all_note_ids[:limit]
        print(f"Processing limited to {limit} notes")

    # Batch fetch all note info at once for speed
    print(f"Fetching note data...")
    notes_response = anki_connect_request("notesInfo", {"notes": all_note_ids})
    if not notes_response or not notes_response.get("result"):
        print("Failed to fetch note information")
        return

    all_notes_info = notes_response["result"]
    print(f"Fetched {len(all_notes_info)} notes")

    updated_count = 0
    skipped_count = 0
    no_sentences_count = 0
    unchanged_count = 0

    for i, note_info in enumerate(all_notes_info, 1):
        try:
            note_id = note_info.get('noteId')
            note_type = note_info.get('modelName', 'Unknown')

            # Get the Traditional field
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            if not traditional:
                print(f"[{i}/{len(all_notes_info)}] Note {note_id} ({note_type}): No Traditional field, skipping")
                skipped_count += 1
                continue

            char = traditional[0]

            # Get current field value
            current_value = note_info['fields'].get('Example sentences', {}).get('value', '').strip()

            # Get Anki sentences for this character (highest priority)
            char_anki_sentences = anki_sentences.get(char, [])

            # Get HackChinese sentences and compounds for this character
            char_info = char_data.get(char, {"sentences": [], "compounds": []})
            sentences = char_info["sentences"]
            compounds = char_info["compounds"]

            if not char_anki_sentences and not sentences and not compounds:
                no_sentences_count += 1
                new_html = ""
            else:
                new_html = generate_example_sentences_html(char_anki_sentences, sentences, compounds)

            # Check if update is needed
            if current_value == new_html:
                unchanged_count += 1
                continue

            if dry_run:
                print(f"[{i}/{len(all_notes_info)}] Note {note_id} ({note_type}, {char}): Would update Example sentences")
                print(f"  Found {len(char_anki_sentences)} Anki, {len(sentences)} HackChinese sentences, {len(compounds)} compounds")
                if char_anki_sentences:
                    print(f"  First Anki sentence: {char_anki_sentences[0][0]}")
                elif sentences:
                    print(f"  First sentence: {sentences[0][0]}")
                elif compounds:
                    print(f"  First compound: {compounds[0][0]}")
                updated_count += 1
            else:
                # Update the note
                update_note_field(note_id, "Example sentences", new_html)
                print(f"[{i}/{len(all_notes_info)}] Note {note_id} ({note_type}, {char}): Updated with {len(char_anki_sentences)} Anki, {len(sentences)} HackChinese, {len(compounds)} compounds")
                updated_count += 1

        except Exception as e:
            note_id = note_info.get('noteId', 'unknown')
            print(f"[{i}/{len(all_notes_info)}] Error processing note {note_id}: {e}")
            raise

    print("\n" + "="*60)
    print(f"Summary:")
    print(f"  Total notes: {len(all_notes_info)}")
    print(f"  Updated: {updated_count}")
    print(f"  Unchanged: {unchanged_count}")
    print(f"  No sentences or compounds available: {no_sentences_count}")
    print(f"  Skipped: {skipped_count}")
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Fill Example sentences field for Hanzi notes in Anki',
        epilog='''
Examples:
  %(prog)s --dry-run                           Preview changes without updating
  %(prog)s --dry-run --limit 5                 Preview first 5 notes only
  %(prog)s                                     Update all Hanzi notes
  %(prog)s --note-types Hanzi TOCFL            Update both Hanzi and TOCFL notes
  %(prog)s --limit 100                         Update first 100 notes only
  %(prog)s --character 被                      Update specific character only

This script fills the "Example sentences" field with sentences and compounds from
HackChinese data where all characters have been learned (not suspended).
Sentences are shown first, followed by compounds (separated by a horizontal line).
It will overwrite existing content if it differs from the generated content.

Requires Anki running with AnkiConnect addon installed.
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually updating notes')
    parser.add_argument('--limit', type=int, metavar='N',
                       help='Limit number of notes to process (useful for testing)')
    parser.add_argument('--character', type=str, metavar='CHAR',
                       help='Process only this specific character (e.g., 被)')
    parser.add_argument('--note-types', nargs='+', default=['Hanzi'], metavar='TYPE',
                       help='Note types to process (default: Hanzi). Examples: Hanzi, TOCFL')
    args = parser.parse_args()

    update_example_sentences(
        note_types=args.note_types,
        dry_run=args.dry_run,
        limit=args.limit,
        character=args.character
    )


if __name__ == "__main__":
    main()
