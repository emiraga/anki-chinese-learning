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
from dataclasses import dataclass, field
import requests
import dragonmapper.transcriptions
import re
import argparse


@dataclass
class AnkiCache:
    """Cache for Anki queries to avoid repeated API calls"""
    _query_cache: dict[str, list[int]] = field(default_factory=dict)
    _notes_info_cache: dict[int, dict] = field(default_factory=dict)

    def get_query(self, query: str) -> list[int] | None:
        """Get cached query result"""
        return self._query_cache.get(query)

    def set_query(self, query: str, note_ids: list[int]) -> None:
        """Cache query result"""
        self._query_cache[query] = note_ids

    def get_notes_info(self, note_ids: list[int]) -> tuple[list[dict], list[int]]:
        """
        Get cached notes info and return uncached IDs.

        Returns:
            Tuple of (cached_notes, uncached_ids)
        """
        cached = []
        uncached = []
        for note_id in note_ids:
            if note_id in self._notes_info_cache:
                cached.append(self._notes_info_cache[note_id])
            else:
                uncached.append(note_id)
        return cached, uncached

    def set_notes_info(self, notes: list[dict]) -> None:
        """Cache notes info"""
        for note in notes:
            note_id = note.get('noteId')
            if note_id:
                self._notes_info_cache[note_id] = note

    def clear(self) -> None:
        """Clear all caches"""
        self._query_cache.clear()
        self._notes_info_cache.clear()

    def stats(self) -> dict[str, int]:
        """Return cache statistics"""
        return {
            'queries': len(self._query_cache),
            'notes': len(self._notes_info_cache),
        }


# Global cache instance
_cache = AnkiCache()


def get_cache() -> AnkiCache:
    """Get the global cache instance"""
    return _cache


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


def find_notes_by_query(query: str, cache: AnkiCache | None = None) -> list[int]:
    """
    Find notes matching a query

    Args:
        query: Anki search query
        cache: Optional cache instance (uses global cache if not provided)

    Returns:
        List of note IDs
    """
    if cache is None:
        cache = _cache

    cached = cache.get_query(query)
    if cached is not None:
        return cached

    response = anki_connect_request("findNotes", {"query": query})
    result = response.get("result", [])
    cache.set_query(query, result)
    return result


def get_notes_info(note_ids: list[int], cache: AnkiCache | None = None) -> list[dict]:
    """
    Get detailed information about multiple notes

    Args:
        note_ids: List of note IDs
        cache: Optional cache instance (uses global cache if not provided)

    Returns:
        List of note information dictionaries
    """
    if not note_ids:
        return []

    if cache is None:
        cache = _cache

    cached_notes, uncached_ids = cache.get_notes_info(note_ids)

    if not uncached_ids:
        return cached_notes

    response = anki_connect_request("notesInfo", {"notes": uncached_ids})
    new_notes = response.get("result", [])
    cache.set_notes_info(new_notes)

    return cached_notes + new_notes


def escape_comma(text: str) -> str:
    """Replace ASCII comma with fullwidth comma + variation selector to avoid field delimiter conflicts"""
    return text.replace(',', '，︀')


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
        return ", ".join([escape_comma(l) for l, _ in self.get_sorted_pairs()])

    def right_str(self) -> str:
        """Get comma-separated right elements, sorted by corresponding left"""
        return ", ".join([escape_comma(r) for _, r in self.get_sorted_pairs()])


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
            'untracked': 0,
        }
        processed_keys: set[str] = set()

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
                processed_keys.add(note.key)
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

        # Check for untracked notes
        untracked_keys = set(existing_notes.keys()) - processed_keys
        if untracked_keys:
            print(f"\n⚠️  Warning: {len(untracked_keys)} untracked ConnectDots note(s):")
            for key in sorted(untracked_keys):
                print(f"  - {key}")
            stats['untracked'] = len(untracked_keys)

        return stats


def list_sound_component_frequencies(top_n: int = 50) -> None:
    """
    List sound components by frequency from all Hanzi notes.

    Args:
        top_n: Number of top sound components to display
    """
    print("=== Sound Component Frequency Analysis ===\n")

    # Query all Hanzi notes with a sound component
    query = 'note:Hanzi -is:suspended "Sound component character:_*"'
    note_ids = find_notes_by_query(query)

    if not note_ids:
        print("No Hanzi notes with sound components found")
        return

    print(f"Analyzing {len(note_ids)} Hanzi notes with sound components...\n")

    component_counts: dict[str, int] = {}
    component_examples: dict[str, list[str]] = {}

    # Process in batches
    batch_size = 100
    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i:i + batch_size]
        notes_info = get_notes_info(batch_ids)

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()
            sound_component = note['fields'].get('Sound component character', {}).get('value', '').strip()

            if not sound_component:
                continue

            component_counts[sound_component] = component_counts.get(sound_component, 0) + 1
            if sound_component not in component_examples:
                component_examples[sound_component] = []
            if len(component_examples[sound_component]) < 5 and traditional:
                example = f"{traditional}({pinyin})" if pinyin else traditional
                component_examples[sound_component].append(example)

    if not component_counts:
        print("No sound components found")
        return

    # Sort by frequency (descending)
    sorted_components = sorted(component_counts.items(), key=lambda x: x[1], reverse=True)

    print(f"Found {len(sorted_components)} unique sound components\n")
    print(f"Top {min(top_n, len(sorted_components))} sound components by frequency:\n")
    print(f"{'Rank':<6}{'Component':<12}{'Count':<8}Examples")
    print("-" * 70)

    for rank, (component, count) in enumerate(sorted_components[:top_n], 1):
        examples = ", ".join(component_examples.get(component, []))
        print(f"{rank:<6}{component:<12}{count:<8}{examples}")

    print(f"\n=== Summary ===")
    print(f"Total unique sound components: {len(sorted_components)}")
    print(f"Total characters with sound components: {sum(component_counts.values())}")

    cache_stats = _cache.stats()
    print(f"\n=== Cache Stats ===")
    print(f"Cached queries: {cache_stats['queries']}")
    print(f"Cached notes: {cache_stats['notes']}")


def list_syllable_frequencies(top_n: int = 50) -> None:
    """
    List syllables by frequency from all single-character Hanzi notes.

    Args:
        top_n: Number of top syllables to display
    """
    print("=== Syllable Frequency Analysis ===\n")

    # Query all single-character Hanzi notes
    query = 'note:Hanzi -is:suspended'
    note_ids = find_notes_by_query(query)

    if not note_ids:
        print("No Hanzi notes found")
        return

    print(f"Analyzing {len(note_ids)} Hanzi notes...\n")

    syllable_counts: dict[str, int] = {}
    syllable_examples: dict[str, list[str]] = {}

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

            syllable = remove_tone_marks(pinyin)
            if syllable:
                syllable_counts[syllable] = syllable_counts.get(syllable, 0) + 1
                if syllable not in syllable_examples:
                    syllable_examples[syllable] = []
                if len(syllable_examples[syllable]) < 5:
                    syllable_examples[syllable].append(f"{traditional}({pinyin})")

    if not syllable_counts:
        print("No syllables found")
        return

    # Sort by frequency (descending)
    sorted_syllables = sorted(syllable_counts.items(), key=lambda x: x[1], reverse=True)

    print(f"Found {len(sorted_syllables)} unique syllables\n")
    print(f"Top {min(top_n, len(sorted_syllables))} syllables by frequency:\n")
    print(f"{'Rank':<6}{'Syllable':<12}{'Count':<8}Examples")
    print("-" * 60)

    for rank, (syllable, count) in enumerate(sorted_syllables[:top_n], 1):
        examples = ", ".join(syllable_examples.get(syllable, []))
        print(f"{rank:<6}{syllable:<12}{count:<8}{examples}")

    print(f"\n=== Summary ===")
    print(f"Total syllables: {len(sorted_syllables)}")
    print(f"Total characters analyzed: {sum(syllable_counts.values())}")

    cache_stats = _cache.stats()
    print(f"\n=== Cache Stats ===")
    print(f"Cached queries: {cache_stats['queries']}")
    print(f"Cached notes: {cache_stats['notes']}")


def main():
    parser = argparse.ArgumentParser(
        description="Create and update ConnectDots notes in Anki"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--list-syllables",
        action="store_true",
        help="List syllables by frequency instead of processing generators"
    )
    parser.add_argument(
        "--list-sound-components",
        action="store_true",
        help="List sound components by frequency instead of processing generators"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=50,
        help="Number of top items to show (default: 50)"
    )
    args = parser.parse_args()

    if args.list_syllables:
        list_syllable_frequencies(top_n=args.top)
        return

    if args.list_sound_components:
        list_sound_component_frequencies(top_n=args.top)
        return

    print("=== ConnectDots Note Manager ===\n")

    manager = ConnectDotsManager(dry_run=args.dry_run)
    generators: list[ConnectDotsGenerator] = []

    generators.append(SoundComponentHanziToPinyin('隹'))
    generators.append(SoundComponentHanziToPinyin('青'))
    generators.append(SoundComponentHanziToPinyin('乍'))
    generators.append(SoundComponentHanziToPinyin('艮'))
    generators.append(SoundComponentHanziToPinyin('昜'))
    generators.append(SyllableHanziToPinyin('shi'))
    generators.append(SyllableHanziToPinyin('zhi'))
    generators.append(SyllableHanziToPinyin('ji'))
    generators.append(SyllableHanziToPinyin('xi'))
    generators.append(SyllableHanziToPinyin('yi'))
    generators.append(SyllableHanziToPinyin('li'))
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
    print(f"Untracked: {stats['untracked']}")
    print(f"Errors: {stats['errors']}")

    cache_stats = _cache.stats()
    print(f"\n=== Cache Stats ===")
    print(f"Cached queries: {cache_stats['queries']}")
    print(f"Cached notes: {cache_stats['notes']}")


if __name__ == "__main__":
    main()
