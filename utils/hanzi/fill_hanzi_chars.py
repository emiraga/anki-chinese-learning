#!/usr/bin/env -S uv run
import argparse
import sys
from collections import Counter
from collections.abc import Sequence
from pathlib import Path

from pypinyin import Style
from pypinyin import pinyin as get_pinyin

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    add_note,
    find_cards_by_query,
    find_notes_by_type,
    get_field_value,
    iter_notes_info,
    suspend_cards,
)
from shared.character_conversion import to_simplified, to_traditional
from shared.dictionary_utils import lookup_character_meaning
from shared.phrase_utils import CharOccurrence, extract_characters_from_phrases


def extract_existing_hanzi_characters() -> set[str]:
    """
    Extract all single characters from existing Hanzi notes
    Validates that Traditional field doesn't contain simplified-only characters

    Returns:
        set: Set of characters that already exist in Hanzi notes

    Raises:
        ValueError: If Traditional field contains a simplified-only character
    """
    print("\n=== Extracting existing Hanzi characters ===")
    hanzi_note_ids = find_notes_by_type("Hanzi")

    existing_chars: set[str] = set()

    for note_info in iter_notes_info(hanzi_note_ids):
        traditional = get_field_value(note_info, "Traditional")
        # Only consider single character notes
        if len(traditional) == 1:
            # Get the Hanzi (simplified) field for validation
            hanzi_field = get_field_value(note_info, "Hanzi")

            if hanzi_field and len(hanzi_field) == 1 and traditional != hanzi_field:
                simplified_of_traditional = to_simplified(traditional)

                if simplified_of_traditional != hanzi_field:
                    # Traditional doesn't simplify to Hanzi field value
                    # This could mean Traditional field contains the simplified form
                    # Check if Hanzi field is already in simplified form
                    traditional_of_hanzi = to_traditional(hanzi_field)

                    if traditional_of_hanzi != traditional and traditional == hanzi_field:
                        # Traditional field equals Hanzi field, but there's a different traditional form
                        note_id = note_info["noteId"]
                        raise ValueError(
                            f"Simplified character '{traditional}' found in Traditional field of Hanzi note {note_id}. "
                            f"Traditional form should be '{traditional_of_hanzi}'. "
                            f"Hanzi (simplified) field correctly contains: '{hanzi_field}'. "
                            f"Please correct the Traditional field to use '{traditional_of_hanzi}'."
                        )

            existing_chars.add(traditional)

    print(f"Found {len(existing_chars)} existing single-character Hanzi notes")
    return existing_chars


def infer_most_common_pinyin(char_occurrences: Sequence[CharOccurrence]) -> str:
    """
    Find the most common pinyin for a character based on its occurrences

    Args:
        char_occurrences (list): List of CharOccurrence entries for the character

    Returns:
        str: Most common pinyin syllable
    """
    pinyin_counter = Counter([occ.syllable for occ in char_occurrences])
    return pinyin_counter.most_common(1)[0][0]


def create_hanzi_note(char: str, pinyin: str, simplified: str, meaning: str = "") -> bool:
    """
    Create a new Hanzi note and suspend it

    Args:
        char (str): Traditional Chinese character
        pinyin (str): Pinyin pronunciation
        simplified (str): Simplified Chinese character
        meaning (str): Meaning (can be empty)

    Returns:
        bool: True if successful, False otherwise
    """
    # Create the note
    note_id = add_note(
        "Chinese::CharsProps",  # Adjust deck name as needed
        "Hanzi",
        {
            "Traditional": char,
            "Pinyin": pinyin,
            "Hanzi": simplified,
            "Meaning": meaning,
            # Leave other fields empty
            "Props": "",
            "Mnemonic pegs": "",
            "Audio": "",
            "Zhuyin": "",
        },
        ["auto-generated"],
    )
    print(f"Created note {note_id} for character '{char}' with pinyin '{pinyin}'")

    # New characters start suspended: they are unsuspended when they come up for learning.
    suspend_cards(find_cards_by_query(f"nid:{note_id}"))
    print(f"Suspended note {note_id}")
    return True


def process_single_character(char: str, char_data: dict[str, list[CharOccurrence]] | None = None) -> bool:
    """
    Process and create a note for a single character

    Args:
        char (str): The character to process
        char_data (dict): Optional pre-computed character data from phrases

    Returns:
        bool: True if successful, False otherwise
    """
    # If no char_data provided, extract it from phrases
    if char_data is None:
        note_types = ["TOCFL"]
        all_char_data = extract_characters_from_phrases(note_types)
        char_occurrences = all_char_data.get(char, [])
    else:
        char_occurrences = char_data.get(char, [])

    # If character not found in any phrases, try to get info from dictionary
    if not char_occurrences:
        print(f"Character '{char}' not found in any phrases, using dictionary lookup")
        # Try to get pinyin using pypinyin
        try:
            pinyin_result = get_pinyin(char, style=Style.TONE)
            if pinyin_result and len(pinyin_result) > 0 and len(pinyin_result[0]) > 0:
                pinyin = pinyin_result[0][0]
            else:
                raise ValueError(f"Could not find pinyin for '{char}'")
        except Exception as e:
            raise ValueError(f"Cannot process character '{char}': {e}") from e
    else:
        # Infer pinyin from occurrences
        pinyin = infer_most_common_pinyin(char_occurrences)

    # Extract meaning
    meaning = lookup_character_meaning(char, char_occurrences)

    # Get simplified form
    simplified = to_simplified(char)

    print(f"\nProcessing character '{char}':")
    print(f"  Pinyin: {pinyin}" + (f" (from {len(char_occurrences)} occurrences)" if char_occurrences else " (from dictionary)"))
    print(f"  Meaning: {meaning or '(none)'}")
    print(f"  Simplified: {simplified}")

    # Create the note
    return create_hanzi_note(char, pinyin, simplified, meaning)


def main() -> None:
    """
    Main function to discover missing characters and create Hanzi notes
    """
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Create Hanzi notes in Anki for missing characters")
    parser.add_argument("--char", type=str, help="Add a note for a specific character (bypasses existing character check)")
    args = parser.parse_args()

    print("=== Starting Hanzi note generation ===")

    # If a specific character is requested
    if args.char:
        if len(args.char) != 1:
            print(f"Error: --char must be a single character, got '{args.char}'")
            return

        char = args.char
        print(f"\n=== Processing single character: '{char}' ===")

        # Check if character already exists
        existing_chars = extract_existing_hanzi_characters()
        if char in existing_chars:
            print(f"Warning: Character '{char}' already has a Hanzi note")
            response = input("Do you want to create a duplicate note? (y/n): ")
            if response.lower() != "y":
                print("Aborted")
                return

        # Process the character
        if process_single_character(char):
            print(f"\n=== Successfully created note for '{char}' ===")
        else:
            print(f"\n=== Failed to create note for '{char}' ===")
        return

    # Normal batch processing mode
    # Step 1: Get existing Hanzi characters
    existing_chars = extract_existing_hanzi_characters()

    # Step 2: Extract characters from TOCFL
    note_types = ["TOCFL"]
    char_data = extract_characters_from_phrases(note_types)

    # Step 3: Find missing characters
    all_chars = set(char_data.keys())
    missing_chars = all_chars - existing_chars
    print(f"\n=== Found {len(missing_chars)} missing characters ===")

    # Step 4: Create notes for missing characters
    created_count = 0
    failed_count = 0

    for char in sorted(missing_chars):
        if process_single_character(char, char_data):
            created_count += 1
        else:
            failed_count += 1

    print("\n=== Summary ===")
    print(f"Total missing characters: {len(missing_chars)}")
    print(f"Successfully created: {created_count}")
    print(f"Failed: {failed_count}")
    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
