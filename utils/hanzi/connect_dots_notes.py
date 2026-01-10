#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Script to create and update ConnectDots notes in Anki.

ConnectDots notes have three fields:
- Key: unique lookup identifier
- Left: comma-separated list of elements
- Right: comma-separated list of elements (same count as Left)

The script supports multiple generator types, each with different query criteria
and element mapping logic.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
import requests
import dragonmapper.transcriptions
import re
import argparse


def anki_connect_request(action: str, params: dict | None = None) -> dict:
    """
    Send a request to anki-connect

    Args:
        action: The action to perform
        params: Parameters for the action

    Returns:
        Response from anki-connect

    Raises:
        Exception: If request fails or returns an error
    """
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    response = requests.post("http://localhost:8765", json=request_data)
    response.raise_for_status()
    result = response.json()

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    return result


def find_notes_by_query(query: str) -> list[int]:
    """
    Find notes matching a query

    Args:
        query: Anki search query

    Returns:
        List of note IDs
    """
    response = anki_connect_request("findNotes", {"query": query})
    return response.get("result", [])


def get_notes_info(note_ids: list[int]) -> list[dict]:
    """
    Get detailed information about multiple notes

    Args:
        note_ids: List of note IDs

    Returns:
        List of note information dictionaries
    """
    if not note_ids:
        return []

    response = anki_connect_request("notesInfo", {"notes": note_ids})
    return response.get("result", [])


def remove_tone_marks(pinyin: str) -> str:
    """
    Remove tone marks from pinyin to get the syllable

    Args:
        pinyin: Pinyin with tone marks (e.g., "hǎo")

    Returns:
        Pinyin without tone marks (e.g., "hao")
    """
    try:
        # Convert to numbered pinyin first, then strip numbers
        numbered = dragonmapper.transcriptions.pinyin_to_numbered_pinyin(pinyin)
        # Remove the tone numbers
        return re.sub(r'[1-5]', '', numbered).lower()
    except Exception:
        # If conversion fails, try manual approach
        tone_map = {
            'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
            'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
            'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
            'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
            'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
            'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü',
        }
        result = pinyin.lower()
        for toned, plain in tone_map.items():
            result = result.replace(toned, plain)
        return result


@dataclass
class ConnectDotsNote:
    """Represents a ConnectDots note to be created or updated"""
    key: str
    left: list[str]
    right: list[str]

    def __post_init__(self):
        if len(self.left) != len(self.right):
            raise ValueError(
                f"Left and Right must have equal lengths: "
                f"left={len(self.left)}, right={len(self.right)}"
            )

    def get_sorted_pairs(self) -> list[tuple[str, str]]:
        """Get (left, right) pairs sorted by left element"""
        return sorted(zip(self.left, self.right), key=lambda x: x[0])

    def left_str(self) -> str:
        """Get comma-separated left elements, sorted"""
        return ", ".join([l for l, _ in self.get_sorted_pairs()])

    def right_str(self) -> str:
        """Get comma-separated right elements, sorted by corresponding left"""
        return ", ".join([r for _, r in self.get_sorted_pairs()])


class ConnectDotsGenerator(ABC):
    """Base class for generating ConnectDots notes"""

    @property
    @abstractmethod
    def generator_type(self) -> str:
        """Return the type identifier for this generator"""
        pass

    @abstractmethod
    def generate_notes(self) -> list[ConnectDotsNote]:
        """Generate all ConnectDots notes for this generator"""
        pass


class SoundComponentHanziToPinyin(ConnectDotsGenerator):
    """
    Generate notes mapping Hanzi with same sound component to their pinyin.

    Queries Hanzi notes that have a specific value in "Sound component character" field.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, sound_component: str):
        self.sound_component = sound_component

    @property
    def generator_type(self) -> str:
        return "sound_component"

    def generate_notes(self) -> list[ConnectDotsNote]:
        # Query Hanzi notes with this sound component
        query = f'"note:Hanzi" -is:suspended "Sound component character:{self.sound_component}"'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return []

        notes_info = get_notes_info(note_ids)

        left = []
        right = []

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()

            if traditional and pinyin:
                left.append(traditional)
                right.append(pinyin)

        if not left:
            return []

        key = f"{self.generator_type}:{self.sound_component}"
        return [ConnectDotsNote(key=key, left=left, right=right)]


class SyllableHanziToPinyin(ConnectDotsGenerator):
    """
    Generate notes mapping Hanzi with same syllable to their pinyin.

    Queries Hanzi notes where the Pinyin (with diacritics removed) matches
    the specified syllable.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, syllable: str):
        self.syllable = syllable.lower()

    @property
    def generator_type(self) -> str:
        return "syllable"

    def generate_notes(self) -> list[ConnectDotsNote]:
        # Query all single-character Hanzi notes
        query = 'note:Hanzi -is:suspended'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return []

        left = []
        right = []

        # Process in batches
        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i:i + batch_size]
            notes_info = get_notes_info(batch_ids)

            for note in notes_info:
                traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
                pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()

                if not traditional or not pinyin:
                    continue

                # Only consider single-character notes
                if len(traditional) != 1:
                    continue

                # Check if syllable matches
                syllable = remove_tone_marks(pinyin)
                if syllable == self.syllable:
                    left.append(traditional)
                    right.append(pinyin)

        if not left:
            return []

        key = f"{self.generator_type}:{self.syllable}"
        return [ConnectDotsNote(key=key, left=left, right=right)]


class TagTraditionalToMeaning(ConnectDotsGenerator):
    """
    Generate notes mapping Traditional to Meaning for notes with a specific tag.

    Works with multiple note types (Hanzi, TOCFL, Dangdai, etc.)
    Left = Traditional characters/phrases, Right = Meanings
    """

    def __init__(self, tag: str):
        self.tag = tag

    @property
    def generator_type(self) -> str:
        return "tag"

    def generate_notes(self) -> list[ConnectDotsNote]:
        # Query notes with this tag
        query = f'tag:{self.tag}'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return []

        notes_info = get_notes_info(note_ids)

        left = []
        right = []

        for note in notes_info:
            # Try different field names for traditional
            traditional = (
                note['fields'].get('Traditional', {}).get('value', '').strip() or
                note['fields'].get('Hanzi', {}).get('value', '').strip()
            )

            # Try different field names for meaning
            meaning = (
                note['fields'].get('Meaning', {}).get('value', '').strip() or
                note['fields'].get('English', {}).get('value', '').strip()
            )

            if traditional and meaning:
                left.append(traditional)
                right.append(meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.tag}"
        return [ConnectDotsNote(key=key, left=left, right=right)]


class ConnectDotsManager:
    """Manager for creating and updating ConnectDots notes in Anki"""

    DECK_NAME = "Chinese"
    NOTE_TYPE = "ConnectDots"

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run

    def get_existing_notes(self) -> dict[str, dict]:
        """
        Get all existing ConnectDots notes indexed by Key

        Returns:
            Dictionary mapping Key to note info
        """
        query = f'note:{self.NOTE_TYPE}'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return {}

        notes_info = get_notes_info(note_ids)
        existing = {}

        for note in notes_info:
            key = note['fields'].get('Key', {}).get('value', '').strip()
            if key:
                existing[key] = {
                    'noteId': note['noteId'],
                    'left': note['fields'].get('Left', {}).get('value', '').strip(),
                    'right': note['fields'].get('Right', {}).get('value', '').strip(),
                }

        return existing

    def create_note(self, note: ConnectDotsNote) -> int:
        """
        Create a new ConnectDots note

        Args:
            note: The note to create

        Returns:
            The note ID of the created note
        """
        if self.dry_run:
            print(f"  [DRY RUN] Would create note: {note.key}")
            return 0

        response = anki_connect_request("addNote", {
            "note": {
                "deckName": self.DECK_NAME,
                "modelName": self.NOTE_TYPE,
                "fields": {
                    "Key": note.key,
                    "Left": note.left_str(),
                    "Right": note.right_str(),
                },
                "tags": ["auto-generated", "connect-dots"]
            }
        })

        note_id = response.get("result")
        if not note_id:
            raise Exception(f"Failed to create note for key '{note.key}'")

        print(f"  Created note {note_id} for key '{note.key}'")
        return note_id

    def update_note(self, note_id: int, note: ConnectDotsNote) -> None:
        """
        Update an existing ConnectDots note

        Args:
            note_id: The ID of the note to update
            note: The new note data
        """
        if self.dry_run:
            print(f"  [DRY RUN] Would update note {note_id}: {note.key}")
            return

        anki_connect_request("updateNoteFields", {
            "note": {
                "id": note_id,
                "fields": {
                    "Key": note.key,
                    "Left": note.left_str(),
                    "Right": note.right_str(),
                }
            }
        })

        print(f"  Updated note {note_id} for key '{note.key}'")

    def process_generators(self, generators: list[ConnectDotsGenerator]) -> dict:
        """
        Process all generators and create/update notes as needed

        Args:
            generators: List of generator instances

        Returns:
            Statistics dictionary
        """
        stats = {
            'created': 0,
            'updated': 0,
            'unchanged': 0,
            'errors': 0,
        }

        print("Fetching existing ConnectDots notes...")
        existing_notes = self.get_existing_notes()
        print(f"Found {len(existing_notes)} existing notes")

        for generator in generators:
            print(f"\nProcessing {generator.__class__.__name__}...")

            try:
                notes = generator.generate_notes()
            except Exception as e:
                print(f"  Error generating notes: {e}")
                stats['errors'] += 1
                continue

            for note in notes:
                try:
                    existing = existing_notes.get(note.key)

                    if existing:
                        # Check if content changed
                        new_left = note.left_str()
                        new_right = note.right_str()

                        if existing['left'] == new_left and existing['right'] == new_right:
                            print(f"  Unchanged: {note.key}")
                            stats['unchanged'] += 1
                        else:
                            self.update_note(existing['noteId'], note)
                            stats['updated'] += 1
                    else:
                        self.create_note(note)
                        stats['created'] += 1

                except Exception as e:
                    print(f"  Error processing note '{note.key}': {e}")
                    stats['errors'] += 1

        return stats


def main():
    parser = argparse.ArgumentParser(
        description="Create and update ConnectDots notes in Anki"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    args = parser.parse_args()

    print("=== ConnectDots Note Manager ===\n")

    manager = ConnectDotsManager(dry_run=args.dry_run)
    generators: list[ConnectDotsGenerator] = []

    generators.append(SoundComponentHanziToPinyin('隹'))
    generators.append(SyllableHanziToPinyin('dui'))
    generators.append(TagTraditionalToMeaning('chinese::category::food'))

    if not generators:
        print("No generators to run")
        return

    print(f"\nRunning {len(generators)} generator(s)...\n")
    stats = manager.process_generators(generators)

    print("\n=== Summary ===")
    print(f"Created: {stats['created']}")
    print(f"Updated: {stats['updated']}")
    print(f"Unchanged: {stats['unchanged']}")
    print(f"Errors: {stats['errors']}")


if __name__ == "__main__":
    main()
