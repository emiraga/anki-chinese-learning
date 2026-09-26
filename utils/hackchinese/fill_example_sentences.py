#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import argparse
import json
import sys
import unicodedata
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_field_value, iter_notes_info, update_note_fields
from shared.character_discovery import extract_known_chars
from shared.project_paths import HACKCHINESE_WORDS_DIR

LEARNED_CHARS_QUERY = "note:Hanzi -is:suspended"


def is_punctuation(char: str) -> bool:
    """
    Check if a character is punctuation (including Chinese punctuation)

    Args:
        char (str): Character to check

    Returns:
        bool: True if character is punctuation
    """
    # Common Chinese and Western punctuation
    chinese_punctuation = '。，、；：？！""（）《》【】…—·'  # noqa: RUF001
    western_punctuation = ".,;:?!'\"()[]{}<>-–—…·"  # noqa: RUF001

    if char in chinese_punctuation or char in western_punctuation:
        return True

    # Check Unicode category for punctuation
    category = unicodedata.category(char)
    return category.startswith("P")


def can_use_sentence(sentence_text: str, learned_chars: set[str]) -> bool:
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


ANKI_SENTENCE_NOTE_TYPES = ["TOCFL"]


def load_anki_sentences(learned_chars: set[str]) -> dict[str, list[tuple[str, str]]]:
    """
    Load sentences/words from Anki note types (TOCFL).
    These have higher priority than HackChinese data.

    Args:
        learned_chars: Set of learned characters

    Returns:
        Dict mapping character to list of (traditional, meaning) tuples
    """
    char_sentences: dict[str, list[tuple[str, str]]] = {}
    total_sentences = 0

    for note_type in ANKI_SENTENCE_NOTE_TYPES:
        note_ids = find_notes_by_query(f"note:{note_type} -is:suspended")

        if not note_ids:
            print(f"No {note_type} notes found for sentences")
            continue

        print(f"Found {len(note_ids)} {note_type} notes for sentences")

        for note_info in iter_notes_info(note_ids):
            traditional = get_field_value(note_info, "Traditional")
            meaning = get_field_value(note_info, "Meaning")

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


def load_all_word_data(learned_chars: set[str]) -> dict[str, dict[str, list[tuple[str, str]]]]:
    """
    Load all sentences and compounds from HackChinese word JSON files, grouped by character

    Args:
        learned_chars (Set[str]): Set of learned characters

    Returns:
        Dict[str, Dict[str, List[Tuple[str, str]]]]: Dictionary mapping character to dict with 'sentences' and 'compounds' keys,
        each containing list of (traditional, english) tuples
    """
    words_dir = HACKCHINESE_WORDS_DIR

    if not words_dir.exists():
        raise Exception(f"Words directory not found: {words_dir}")

    char_data: dict[str, dict[str, list[tuple[str, str]]]] = {}
    processed_files = 0
    single_char_words = 0
    total_sentences_found = 0
    total_compounds_found = 0

    for json_file in sorted(words_dir.glob("*.json")):
        try:
            with json_file.open(encoding="utf-8") as f:
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

                if sentence_trad and sentence_eng and can_use_sentence(sentence_trad, learned_chars):
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

                if compound_trad and compound_eng and can_use_sentence(compound_trad, learned_chars):
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
    anki_sentences: list[tuple[str, str]], sentences: list[tuple[str, str]], compounds: list[tuple[str, str]]
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
    seen_traditional: set[str] = set()

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


def update_example_sentences(note_types: list[str], dry_run: bool = False, limit: int | None = None, character: str | None = None) -> None:
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
    learned_chars = extract_known_chars(LEARNED_CHARS_QUERY)

    if not learned_chars:
        print("No learned characters found. Cannot proceed.")
        return

    # Load Anki sentences (highest priority)
    print("\nLoading sentences from Anki notes (TOCFL)...")
    anki_sentences = load_anki_sentences(learned_chars)

    # Load all sentences and compounds from HackChinese
    print("\nLoading sentences and compounds from HackChinese data...")
    char_data = load_all_word_data(learned_chars)

    # Get notes to update
    all_note_ids: list[int] = []

    character_suffix = f" for character '{character}'" if character else ""

    for note_type in note_types:
        # Build search query: a single character, or the requested one, and only
        # notes that are not suspended.
        traditional_term = f"Traditional:{character}" if character else "Traditional:_"
        note_ids = find_notes_by_query(f"note:{note_type} {traditional_term} -is:suspended")

        if note_ids:
            print(f"Found {len(note_ids)} {note_type} notes{character_suffix}")
            all_note_ids.extend(note_ids)
        else:
            print(f"No {note_type} notes found{character_suffix}")

    if not all_note_ids:
        print("No notes found to process")
        return

    print(f"\nTotal notes across all types: {len(all_note_ids)}")

    if limit and not character:
        all_note_ids = all_note_ids[:limit]
        print(f"Processing limited to {limit} notes")

    # Batch fetch all note info at once for speed
    print("Fetching note data...")
    all_notes_info = list(iter_notes_info(all_note_ids))
    print(f"Fetched {len(all_notes_info)} notes")

    updated_count = 0
    skipped_count = 0
    no_sentences_count = 0
    unchanged_count = 0

    for i, note_info in enumerate(all_notes_info, 1):
        try:
            note_id = note_info["noteId"]
            note_type = note_info.get("modelName", "Unknown")

            # Get the Traditional field
            traditional = get_field_value(note_info, "Traditional")
            if not traditional:
                print(f"[{i}/{len(all_notes_info)}] Note {note_id} ({note_type}): No Traditional field, skipping")
                skipped_count += 1
                continue

            char = traditional[0]

            # Get current field value
            current_value = get_field_value(note_info, "Example sentences")

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
                update_note_fields(note_id, {"Example sentences": new_html})
                print(
                    f"[{i}/{len(all_notes_info)}] Note {note_id} ({note_type}, {char}): "
                    f"Updated with {len(char_anki_sentences)} Anki, {len(sentences)} HackChinese, "
                    f"{len(compounds)} compounds"
                )
                updated_count += 1

        except Exception as e:
            print(f"[{i}/{len(all_notes_info)}] Error processing note {note_info['noteId']}: {e}")
            raise

    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Total notes: {len(all_notes_info)}")
    print(f"  Updated: {updated_count}")
    print(f"  Unchanged: {unchanged_count}")
    print(f"  No sentences or compounds available: {no_sentences_count}")
    print(f"  Skipped: {skipped_count}")
    if dry_run:
        print("  (DRY RUN - no changes were made)")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Fill Example sentences field for Hanzi notes in Anki",
        epilog="""
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
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without actually updating notes")
    parser.add_argument("--limit", type=int, metavar="N", help="Limit number of notes to process (useful for testing)")
    parser.add_argument("--character", type=str, metavar="CHAR", help="Process only this specific character (e.g., 被)")
    parser.add_argument(
        "--note-types", nargs="+", default=["Hanzi"], metavar="TYPE", help="Note types to process (default: Hanzi). Examples: Hanzi, TOCFL"
    )
    args = parser.parse_args()

    update_example_sentences(note_types=args.note_types, dry_run=args.dry_run, limit=args.limit, character=args.character)


if __name__ == "__main__":
    main()
