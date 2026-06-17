#!/usr/bin/env -S uv run
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import dragonmapper.transcriptions
from pypinyin import Style
from pypinyin import pinyin as get_pinyin

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    anki_connect_request,
    find_notes_by_query,
    get_notes_info,
)
from shared.character_conversion import to_simplified, to_traditional
from shared.dictionary_utils import lookup_character_meaning


def find_notes_by_type(note_type: str) -> list[int]:
    """
    Find all notes of a specific type

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    note_ids = find_notes_by_query(f"note:{note_type}")
    if note_ids:
        print(f"Found {len(note_ids)} notes of type {note_type}")
    else:
        print(f"No notes found of type {note_type}")
    return note_ids


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

    if not hanzi_note_ids:
        return set()

    existing_chars = set()
    batch_size = 100

    for i in range(0, len(hanzi_note_ids), batch_size):
        batch_ids = hanzi_note_ids[i : i + batch_size]
        notes_info = get_notes_info(batch_ids)

        for note_info in notes_info:
            traditional = note_info["fields"].get("Traditional", {}).get("value", "").strip()
            # Only consider single character notes
            if len(traditional) == 1:
                # Get the Hanzi (simplified) field for validation
                hanzi_field = note_info["fields"].get("Hanzi", {}).get("value", "").strip()

                if hanzi_field and len(hanzi_field) == 1 and traditional != hanzi_field:
                        simplified_of_traditional = to_simplified(traditional)

                        if simplified_of_traditional != hanzi_field:
                            # Traditional doesn't simplify to Hanzi field value
                            # This could mean Traditional field contains the simplified form
                            # Check if Hanzi field is already in simplified form
                            traditional_of_hanzi = to_traditional(hanzi_field)

                            if traditional_of_hanzi != traditional and traditional == hanzi_field:
                                # Traditional field equals Hanzi field, but there's a different traditional form
                                note_id = note_info.get("noteId", "unknown")
                                raise ValueError(
                                    f"Simplified character '{traditional}' found in Traditional field of Hanzi note {note_id}. "
                                    f"Traditional form should be '{traditional_of_hanzi}'. "
                                    f"Hanzi (simplified) field correctly contains: '{hanzi_field}'. "
                                    f"Please correct the Traditional field to use '{traditional_of_hanzi}'."
                                )

                existing_chars.add(traditional)

    print(f"Found {len(existing_chars)} existing single-character Hanzi notes")
    return existing_chars


def extract_characters_from_phrases(note_types: list[str]) -> dict[str, list[tuple[str, str, str]]]:
    """
    Extract all unique characters from TOCFL notes with their pinyin and meanings

    Args:
        note_types (list): List of note types to process (e.g., ["TOCFL"])

    Returns:
        dict: Dictionary mapping characters to their occurrences with pinyin and meanings
    """
    print("\n=== Extracting characters from phrases ===")
    char_data: dict[str, list[tuple[str, str, str]]] = {}  # {char: [(pinyin_syllable, phrase, meaning), ...]}

    for note_type in note_types:
        print(f"\nProcessing {note_type} notes...")
        note_ids = find_notes_by_type(note_type)

        if not note_ids:
            continue

        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i : i + batch_size]
            notes_info = get_notes_info(batch_ids)

            for note_info in notes_info:
                meaning = note_info["fields"].get("Meaning", {}).get("value", "").strip()

                # Check if Variants field exists and has content
                variants_raw = note_info["fields"].get("Variants", {}).get("value", "").strip()
                variants_list: list[dict[str, str]] = []

                if variants_raw:
                    # Parse Variants JSON array
                    try:
                        parsed_variants = json.loads(variants_raw)
                        if isinstance(parsed_variants, list):
                            variants_list = parsed_variants
                    except json.JSONDecodeError as e:
                        print(f"Warning: Failed to parse Variants JSON: {e}")

                # If no variants, use the Traditional and Pinyin fields as a single variant
                if not variants_list:
                    traditional_raw = note_info["fields"].get("Traditional", {}).get("value", "").strip()
                    pinyin_raw = note_info["fields"].get("Pinyin", {}).get("value", "").strip()

                    # Clean HTML tags from pinyin
                    pinyin_raw = pinyin_raw.replace("<div>", "").replace("</div>", "").strip()

                    if not traditional_raw or not pinyin_raw:
                        print("Warning: missing traditional or pinyin", note_info)
                        continue

                    variants_list = [{"Traditional": traditional_raw, "Pinyin": pinyin_raw}]

                # Process each variant
                for variant in variants_list:
                    traditional_raw = variant.get("Traditional", "").strip()
                    pinyin_raw = variant.get("Pinyin", "").strip()

                    if not traditional_raw or not pinyin_raw:
                        continue

                    # Handle variants separated by / (e.g., "一塊/一塊兒" or "yīkuài/yīkuàir")
                    # Take only the first variant before the slash
                    traditional = traditional_raw.split("/")[0].strip()
                    pinyin = pinyin_raw.split("/")[0].strip()

                    # Remove parenthetical content (e.g., "籠(子)" -> "籠", "lóng(zi)" -> "lóng")
                    # This handles optional suffixes
                    traditional = re.sub(r"\([^)]*\)", "", traditional).strip()
                    pinyin = re.sub(r"\([^)]*\)", "", pinyin).strip()

                    # Remove ellipsis and surrounding characters (e.g., "以…為…" -> skip)
                    if "…" in traditional or "..." in traditional:
                        continue

                    # Skip entries with Latin letters or numbers (e.g., "KTV", "BBC", "101")
                    if re.search(r"[A-Za-z0-9]", traditional):
                        continue

                    # Remove punctuation from traditional (e.g., "哪裡,哪裡" -> "哪裡哪裡")
                    # Include middle dot . which is used in foreign names
                    # Also remove question marks and other sentence-ending punctuation
                    traditional = re.sub(r"[，、。！？；：．·?!]", "", traditional).strip()  # noqa: RUF001

                    # Remove punctuation and clean pinyin
                    # Include middle dot, apostrophes, and question marks used in sentences
                    pinyin = re.sub(r"[,，、。！？；：．·'?!]", " ", pinyin).strip()  # noqa: RUF001
                    # Remove hyphens (e.g., "chāo-shāng" -> "chāo shāng")
                    pinyin = pinyin.replace("-", " ")
                    # Convert to lowercase to handle capitalized syllables (e.g., "Ōu" -> "ōu")
                    # But preserve tone marks
                    pinyin = pinyin.lower()
                    # Normalize multiple spaces to single space
                    pinyin = re.sub(r"\s+", " ", pinyin).strip()

                    if not traditional or not pinyin:
                        continue

                    # Extract pinyin syllables
                    try:
                        pinyin_syllables = extract_pinyin_syllables(pinyin, len(traditional))
                    except Exception as e:
                        print(f"Error extracting pinyin for '{traditional}' (from '{traditional_raw}'): {e}")
                        continue

                    # Map each character to its pinyin syllable
                    if len(pinyin_syllables) == len(traditional):
                        for char, syllable in zip(traditional, pinyin_syllables, strict=False):
                            if char not in char_data:
                                char_data[char] = []
                            char_data[char].append((syllable, traditional, meaning))

    print(f"Extracted data for {len(char_data)} unique characters")
    return char_data


def extract_pinyin_syllables(pinyin_text: str, expected_count: int) -> list[str]:
    """
    Extract individual pinyin syllables from a pinyin string using zhuyin conversion

    Args:
        pinyin_text (str): Pinyin text (e.g., "nǐ hǎo" or "nǐhǎo")
        expected_count (int): Expected number of syllables

    Returns:
        list: List of pinyin syllables
    """
    try:
        # Convert pinyin to zhuyin (which automatically adds spaces between syllables)
        zhuyin = dragonmapper.transcriptions.pinyin_to_zhuyin(pinyin_text)

        # Split zhuyin by spaces
        zhuyin_syllables = zhuyin.split()

        # Convert each zhuyin syllable back to pinyin
        pinyin_syllables = [dragonmapper.transcriptions.zhuyin_to_pinyin(z) for z in zhuyin_syllables]

        # Verify we got the expected count
        if len(pinyin_syllables) != expected_count:
            raise ValueError(
                f"Syllable count mismatch: got {len(pinyin_syllables)} syllables but expected {expected_count} for '{pinyin_text}'"
            )

        return pinyin_syllables

    except Exception as e:
        raise ValueError(f"Cannot segment pinyin '{pinyin_text}' into {expected_count} syllables: {e}") from e


def infer_most_common_pinyin(char_occurrences: list[tuple[str, str, str]]) -> str:
    """
    Find the most common pinyin for a character based on its occurrences

    Args:
        char_occurrences (list): List of (pinyin_syllable, phrase, meaning) tuples

    Returns:
        str: Most common pinyin syllable
    """
    pinyin_counter = Counter([occ[0] for occ in char_occurrences])
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
    response = anki_connect_request(
        "addNote",
        {
            "note": {
                "deckName": "Chinese::CharsProps",  # Adjust deck name as needed
                "modelName": "Hanzi",
                "fields": {
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
                "tags": ["auto-generated"],
            }
        },
    )

    if response and response.get("result"):
        note_id = response["result"]
        print(f"Created note {note_id} for character '{char}' with pinyin '{pinyin}'")

        # Suspend the note
        suspend_response = anki_connect_request(
            "suspend", {"cards": anki_connect_request("findCards", {"query": f"nid:{note_id}"})["result"]}
        )

        if suspend_response and suspend_response.get("error") is None:
            print(f"Suspended note {note_id}")
            return True
        print(f"Failed to suspend note {note_id}")
        return False
    print(f"Failed to create note for character '{char}': {response}")
    return False


def process_single_character(char: str, char_data: dict[str, list[tuple[str, str, str]]] | None = None) -> bool:
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
    print(f"  Meaning: {meaning if meaning else '(none)'}")
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
