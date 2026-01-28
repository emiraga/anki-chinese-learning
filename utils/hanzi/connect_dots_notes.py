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

ConnectDots notes have these fields:
- Key: unique lookup identifier
- Left: comma-separated list of elements
- Right: comma-separated list of elements (same count as Left)
- Explanation: comma-separated explanations (optional)
- Fake Right: right values from sibling notes for increased difficulty (optional)

The script supports multiple generator types, each with different query criteria
and element mapping logic.

Tests: See test_connect_dots_notes.py (run with: uv run test_connect_dots_notes.py)
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
    explanation: list[str] = field(default_factory=list)
    fake_right: list[str] = field(default_factory=list)

    def __post_init__(self):
        if len(self.left) != len(self.right):
            raise ValueError(
                f"Left and Right must have equal lengths: "
                f"left={len(self.left)}, right={len(self.right)}"
            )
        if self.explanation and len(self.explanation) != len(self.left):
            raise ValueError(
                f"Explanation must have same length as Left/Right: "
                f"explanation={len(self.explanation)}, left={len(self.left)}"
            )

    def get_sorted_tuples(self) -> list[tuple[str, str, str]]:
        """Get (left, right, explanation) tuples sorted by left element"""
        explanations = self.explanation if self.explanation else [''] * len(self.left)
        return sorted(zip(self.left, self.right, explanations), key=lambda x: x[0])

    def left_str(self) -> str:
        """Get comma-separated left elements, sorted"""
        return ", ".join([escape_comma(l) for l, _, _ in self.get_sorted_tuples()])

    def right_str(self) -> str:
        """Get comma-separated right elements, sorted by corresponding left"""
        return ", ".join([escape_comma(r) for _, r, _ in self.get_sorted_tuples()])

    def explanation_str(self) -> str:
        """Get comma-separated explanation elements, sorted by corresponding left"""
        if not self.explanation:
            return ""
        return ", ".join([escape_comma(e) for _, _, e in self.get_sorted_tuples()])

    def fake_right_str(self) -> str:
        """Get comma-separated fake right elements, sorted"""
        if not self.fake_right:
            return ""
        return ", ".join([escape_comma(r) for r in sorted(self.fake_right)])

    def split_if_needed(self, max_items: int = 10) -> list['ConnectDotsNote']:
        """
        Split into multiple notes if there are more than max_items.

        Uses interleaved distribution by right value to maximize diversity:
        items are sorted by (right, left), then distributed round-robin across
        notes. This ensures each split note contains items from all available
        right values when possible.

        Each split note also gets a 'fake_right' field containing right values
        from sibling notes (other notes in the same series).

        Args:
            max_items: Maximum items per note before splitting

        Returns:
            List of ConnectDotsNote objects (may be just [self] if no split needed)
        """
        if len(self.left) <= max_items:
            return [self]

        # Sort by (right, left) to group by right value, then interleave
        # This maximizes diversity of right values in each split note
        explanations = self.explanation if self.explanation else [''] * len(self.left)
        sorted_tuples = sorted(
            zip(self.left, self.right, explanations),
            key=lambda x: (x[1], x[0])  # Sort by (right, left)
        )

        # Calculate number of notes needed (ceiling division)
        num_notes = -(-len(sorted_tuples) // max_items)

        # Initialize buckets for each note
        notes_data: list[tuple[str, list[str], list[str], list[str]]] = []
        for i in range(num_notes):
            # Determine key: first note keeps original, others get :2, :3, etc.
            if i == 0:
                key = self.key
            else:
                key = f"{self.key}:{i + 1}"
            notes_data.append((key, [], [], []))

        # Interleaved distribution: item i goes to note (i % num_notes)
        for i, (left, right, expl) in enumerate(sorted_tuples):
            note_idx = i % num_notes
            key, left_list, right_list, expl_list = notes_data[note_idx]
            left_list.append(left)
            right_list.append(right)
            expl_list.append(expl)

        # Calculate fake_right for each note
        # Collect all unique right values across all notes
        all_right_values = set(right for _, right, _ in sorted_tuples)

        notes = []
        for key, left_slice, right_slice, explanation_slice in notes_data:
            # fake_right = all right values minus this note's right values
            this_note_right = set(right_slice)
            fake_right_candidates = sorted(all_right_values - this_note_right)

            # Limit fake_right so that: len(left) >= len(unique_right) + len(fake_right)
            # This ensures there aren't more options than items to match
            max_fake_right = len(left_slice) - len(this_note_right)
            fake_right = fake_right_candidates[:max(0, max_fake_right)]

            notes.append(ConnectDotsNote(
                key=key,
                left=left_slice,
                right=right_slice,
                explanation=explanation_slice if self.explanation else [],
                fake_right=fake_right
            ))

        return notes


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
        explanation = []

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()
            meaning = note['fields'].get('Meaning', {}).get('value', '').strip()

            if traditional and pinyin:
                left.append(traditional)
                right.append(pinyin)
                explanation.append(meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.sound_component}"
        return [ConnectDotsNote(key=key, left=left, right=right, explanation=explanation)]


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
        explanation = []

        # Process in batches
        batch_size = 100
        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i:i + batch_size]
            notes_info = get_notes_info(batch_ids)

            for note in notes_info:
                traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
                pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()
                meaning = note['fields'].get('Meaning', {}).get('value', '').strip()

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
                    explanation.append(meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.syllable}"
        return [ConnectDotsNote(key=key, left=left, right=right, explanation=explanation)]


class PropHanziToPinyin(ConnectDotsGenerator):
    """
    Generate notes mapping Hanzi with a specific prop tag to their pinyin.

    Queries Hanzi notes that have a tag like "prop::{prop_name}".
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, prop_name: str):
        self.prop_name = prop_name

    @property
    def generator_type(self) -> str:
        return "prop"

    def generate_notes(self) -> list[ConnectDotsNote]:
        # Query Hanzi notes with this prop tag
        query = f'note:Hanzi -is:suspended "tag:prop::{self.prop_name}"'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return []

        notes_info = get_notes_info(note_ids)

        left = []
        right = []
        explanation = []

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()
            meaning = note['fields'].get('Meaning', {}).get('value', '').strip()

            if traditional and pinyin:
                left.append(traditional)
                right.append(pinyin)
                explanation.append(meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.prop_name}"
        return [ConnectDotsNote(key=key, left=left, right=right, explanation=explanation)]


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

    DECK_NAME = "Chinese::CharsProps"
    NOTE_TYPE = "ConnectDots"

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run

    def _get_card_ids_for_note(self, note_id: int) -> list[int]:
        """
        Get card IDs associated with a note.

        Args:
            note_id: The note ID

        Returns:
            List of card IDs for this note
        """
        response = anki_connect_request("findCards", {
            "query": f"nid:{note_id}"
        })
        return response.get("result", [])

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
                    'explanation': note['fields'].get('Explanation', {}).get('value', '').strip(),
                    'fake_right': note['fields'].get('Fake Right', {}).get('value', '').strip(),
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
                    "Explanation": note.explanation_str(),
                    "Fake Right": note.fake_right_str(),
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
                    "Explanation": note.explanation_str(),
                    "Fake Right": note.fake_right_str(),
                }
            }
        })

        # Reset due date to today and interval to 1 day using "1!"
        card_ids = self._get_card_ids_for_note(note_id)
        if card_ids:
            anki_connect_request("setDueDate", {
                "cards": card_ids,
                "days": "1!"
            })
            anki_connect_request("setDueDate", {
                "cards": card_ids,
                "days": "0"
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
            try:
                notes = generator.generate_notes()
            except Exception as e:
                print(f"  Error generating notes: {e}")
                stats['errors'] += 1
                continue

            for note in notes:
                # Split notes that have more than 10 items
                split_notes = note.split_if_needed(max_items=10)

                for split_note in split_notes:
                    processed_keys.add(split_note.key)
                    try:
                        existing = existing_notes.get(split_note.key)

                        if existing:
                            # Check if content changed
                            new_left = split_note.left_str()
                            new_right = split_note.right_str()
                            new_explanation = split_note.explanation_str()
                            new_fake_right = split_note.fake_right_str()

                            if (existing['left'] == new_left and
                                existing['right'] == new_right and
                                existing['explanation'] == new_explanation and
                                existing['fake_right'] == new_fake_right):
                                print(f"  Unchanged: {split_note.key}")
                                stats['unchanged'] += 1
                            else:
                                self.update_note(existing['noteId'], split_note)
                                stats['updated'] += 1
                        else:
                            self.create_note(split_note)
                            stats['created'] += 1

                    except Exception as e:
                        print(f"  Error processing note '{split_note.key}': {e}")
                        stats['errors'] += 1

        # Check for untracked notes
        untracked_keys = set(existing_notes.keys()) - processed_keys
        if untracked_keys:
            print(f"\n⚠️  Warning: {len(untracked_keys)} untracked ConnectDots note(s):")
            for key in sorted(untracked_keys):
                print(f"  - {key}")
            stats['untracked'] = len(untracked_keys)

        return stats


@dataclass
class FrequencyData:
    """Data from frequency analysis"""
    counts: dict[str, int]
    examples: dict[str, list[str]]
    total_items: int


def get_sound_component_frequencies() -> FrequencyData:
    """
    Get sound component frequency data from all Hanzi notes.

    Returns:
        FrequencyData with counts and examples per sound component
    """
    query = 'note:Hanzi -is:suspended "Sound component character:_*"'
    note_ids = find_notes_by_query(query)

    counts: dict[str, int] = {}
    examples: dict[str, list[str]] = {}

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

            counts[sound_component] = counts.get(sound_component, 0) + 1
            if sound_component not in examples:
                examples[sound_component] = []
            if len(examples[sound_component]) < 5 and traditional:
                example = f"{traditional}({pinyin})" if pinyin else traditional
                examples[sound_component].append(example)

    return FrequencyData(counts=counts, examples=examples, total_items=len(note_ids))


def get_syllable_frequencies() -> FrequencyData:
    """
    Get syllable frequency data from all single-character Hanzi notes.

    Returns:
        FrequencyData with counts and examples per syllable
    """
    query = 'note:Hanzi -is:suspended'
    note_ids = find_notes_by_query(query)

    counts: dict[str, int] = {}
    examples: dict[str, list[str]] = {}
    total_single_chars = 0

    batch_size = 100
    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i:i + batch_size]
        notes_info = get_notes_info(batch_ids)

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()

            if not traditional or not pinyin or len(traditional) != 1:
                continue

            total_single_chars += 1
            syllable = remove_tone_marks(pinyin)
            if syllable:
                counts[syllable] = counts.get(syllable, 0) + 1
                if syllable not in examples:
                    examples[syllable] = []
                if len(examples[syllable]) < 5:
                    examples[syllable].append(f"{traditional}({pinyin})")

    return FrequencyData(counts=counts, examples=examples, total_items=total_single_chars)


def print_frequency_table(
    title: str,
    data: FrequencyData,
    item_label: str,
    top_n: int = 50
) -> None:
    """
    Print a formatted frequency table.

    Args:
        title: Title for the analysis
        data: FrequencyData to display
        item_label: Label for the items (e.g., "Component", "Syllable")
        top_n: Number of top items to display
    """
    print(f"=== {title} ===\n")

    if not data.counts:
        print(f"No {item_label.lower()}s found")
        return

    sorted_items = sorted(data.counts.items(), key=lambda x: x[1], reverse=True)

    print(f"Found {len(sorted_items)} unique {item_label.lower()}s\n")
    print(f"Top {min(top_n, len(sorted_items))} {item_label.lower()}s by frequency:\n")
    print(f"{'Rank':<6}{item_label:<12}{'Count':<8}Examples")
    print("-" * 70)

    for rank, (item, count) in enumerate(sorted_items[:top_n], 1):
        examples_str = ", ".join(data.examples.get(item, []))
        print(f"{rank:<6}{item:<12}{count:<8}{examples_str}")

    print(f"\n=== Summary ===")
    print(f"Total unique {item_label.lower()}s: {len(sorted_items)}")
    print(f"Total items analyzed: {data.total_items}")

    cache_stats = _cache.stats()
    print(f"\n=== Cache Stats ===")
    print(f"Cached queries: {cache_stats['queries']}")
    print(f"Cached notes: {cache_stats['notes']}")


def list_sound_component_frequencies(top_n: int = 50) -> None:
    """List sound components by frequency from all Hanzi notes."""
    data = get_sound_component_frequencies()
    print_frequency_table("Sound Component Frequency Analysis", data, "Component", top_n)


def list_syllable_frequencies(top_n: int = 50) -> None:
    """List syllables by frequency from all single-character Hanzi notes."""
    data = get_syllable_frequencies()
    print_frequency_table("Syllable Frequency Analysis", data, "Syllable", top_n)


def get_items_above_threshold(data: FrequencyData, min_count: int) -> list[str]:
    """
    Get items from frequency data that meet the minimum count threshold.

    Args:
        data: FrequencyData containing counts
        min_count: Minimum count for an item to be included

    Returns:
        List of items meeting the threshold
    """
    return [item for item, count in data.counts.items() if count >= min_count]


def get_sound_components_above_threshold(min_count: int = 5) -> list[str]:
    """
    Get sound components that have at least min_count characters.

    Args:
        min_count: Minimum number of characters for a sound component to be included

    Returns:
        List of sound component characters meeting the threshold
    """
    data = get_sound_component_frequencies()
    return get_items_above_threshold(data, min_count)


def get_syllables_above_threshold(min_count: int = 8) -> list[str]:
    """
    Get syllables that have at least min_count characters.

    Args:
        min_count: Minimum number of characters for a syllable to be included

    Returns:
        List of syllables meeting the threshold
    """
    data = get_syllable_frequencies()
    return get_items_above_threshold(data, min_count)


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

    # Auto-add sound components with 5+ characters
    print("Finding sound components with 5+ characters...")
    sound_components = get_sound_components_above_threshold(min_count=5)
    print(f"Found {len(sound_components)} sound components\n")
    for component in sound_components:
        generators.append(SoundComponentHanziToPinyin(component))

    # Auto-add syllables with 8+ characters
    print("Finding syllables with 8+ characters...")
    syllables = get_syllables_above_threshold(min_count=8)
    print(f"Found {len(syllables)} syllables\n")
    for syllable in syllables:
        generators.append(SyllableHanziToPinyin(syllable))

    # Manual tag generators
    generators.append(TagTraditionalToMeaning('chinese::category::food'))

    # Manual tag props
    generators.append(PropHanziToPinyin('square'))

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
