#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "dragonmapper",
#   "requests",
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
from typing import TypedDict
import argparse
import sys
from pathlib import Path

# Add parent directory to path for shared imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.anki_utils import (
    anki_connect_request,
    find_notes_by_query,
    get_notes_info,
    get_meaning_field,
)
from shared.character_discovery import normalize_cjk_char
from shared.pinyin_utils import (
    remove_tone_marks,
    get_tone_number,
    syllable_with_tone,
    pinyin_with_zhuyin,
)


# Thresholds for automatic generator creation
SOUND_COMPONENT_MIN_COUNT = 3  # Minimum characters sharing a sound component
SYLLABLE_MIN_COUNT = 3  # Minimum characters sharing a syllable
TWO_CHAR_PHRASE_MIN_COUNT = 3  # Minimum two-char phrases sharing a character
MAX_ITEMS_PER_NOTE = 10  # Maximum items per ConnectDots note before splitting

# Tags to generate Hanzi-to-Pinyin ConnectDots notes for (using TagHanziToPinyin generator)
# Full tag names in format "prefix::name"
HANZI_TO_PINYIN_TAGS = [
    'prop::square',
    'prop::pendant',
    'prop::water-around-the-house',
    'prop::buddhist-temple',
    'prop::arrow',
    'prop::monkey',
    'prop::cloth-filter',
    'prop::shrine',
    'prop::shrine-gate',
    'prop-top::sheep',
    'prop-bottom::child',
    'prop-left::slice-of-a-tree',
    'prop-right::hook',
    'prop::helmet',
    'prop-left::boat',
    'prop::the-one-who-makes',
    'prop::fountain',
    'prop-left::foot',
]

# Tag intersections for Hanzi-to-Pinyin notes - notes must have ALL listed tags
# Format: (key_name, [full_tag1, full_tag2, ...])
HANZI_TO_PINYIN_INTERSECTIONS: list[tuple[str, list[str]]] = [
    ('small-table+insect', ['prop::small-table', 'prop::insect']),
    ('square+walking-legs', ['prop-right::walking-legs', 'prop::square']),
    ('left-moon-mean', ['prop-left::narrow-meat', 'prop-left::moon']),
]

# Custom hanzi sets - manually curated character groups (using CustomHanziToPinyin generator)
# Format: 'key_name': 'characters_as_string'
CUSTOM_HANZI_TO_PINYIN_SETS = {
    'continuedrama': '繼續戲劇',
    'zhe-zhi': '這者折稚址質'
}

# Combined sound components - for sound components that don't have enough chars individually
# Format: 'key_name': ['component1', 'component2', ...]
COMBINED_SOUND_COMPONENTS_TO_PINYIN: dict[str, list[str]] = {
    '朝+苗': ['朝', '苗'],
}

# Tags to generate ConnectDots notes for (using TagTraditionalToMeaning generator)
# Note: Do NOT include 'tag:' prefix - it's added automatically in the query
TAG_TRADITIONAL_MEANING = [
    'chinese::category::food',
    'chinese::category::time-of-the-day',
    'chinese::category::touch',
    'chinese::category::frequency-of-doing',
    'chinese::category::protect-care',
    'chinese::category::strength',
]

# Whitelist for two-character phrase generators (by common character)
# Only characters in this list will have ConnectDots notes generated
TWO_CHAR_PHRASE_WHITELIST = [
    '如',
    '例',
    '列',
]


@dataclass
class HanziNote:
    """Pre-fetched data for a single Hanzi note"""
    note_id: int
    traditional: str
    pinyin: str
    meaning: str
    sound_component: str
    tags: set[str]

    @property
    def syllable(self) -> str:
        """Get the syllable (pinyin without tone marks)"""
        return remove_tone_marks(self.pinyin) if self.pinyin else ""

    @property
    def tone(self) -> int | None:
        """Get the tone number (1-5)"""
        return get_tone_number(self.pinyin) if self.pinyin else None


@dataclass
class TOCFLNote:
    """Pre-fetched data for a single TOCFL note"""
    note_id: int
    traditional: str
    meaning: str


@dataclass
class HanziDataStore:
    """
    Pre-fetched Hanzi and TOCFL data for efficient in-memory lookups.

    This avoids making many individual API calls by fetching all data upfront.
    """
    hanzi_notes: list[HanziNote] = field(default_factory=lambda: list[HanziNote]())
    tocfl_notes: list[TOCFLNote] = field(default_factory=lambda: list[TOCFLNote]())

    # Indexes for fast lookup
    _hanzi_by_traditional: dict[str, HanziNote] = field(default_factory=lambda: dict[str, HanziNote]())
    _hanzi_by_sound_component: dict[str, list[HanziNote]] = field(default_factory=lambda: dict[str, list[HanziNote]]())
    _hanzi_by_syllable: dict[str, list[HanziNote]] = field(default_factory=lambda: dict[str, list[HanziNote]]())
    _hanzi_by_tag: dict[str, list[HanziNote]] = field(default_factory=lambda: dict[str, list[HanziNote]]())
    _tocfl_two_char: list[TOCFLNote] = field(default_factory=lambda: list[TOCFLNote]())

    def build_indexes(self) -> None:
        """Build lookup indexes after loading notes"""
        self._hanzi_by_traditional.clear()
        self._hanzi_by_sound_component.clear()
        self._hanzi_by_syllable.clear()
        self._hanzi_by_tag.clear()
        self._tocfl_two_char.clear()

        for note in self.hanzi_notes:
            # Index by traditional character
            if note.traditional:
                self._hanzi_by_traditional[note.traditional] = note

            # Index by sound component
            if note.sound_component:
                if note.sound_component not in self._hanzi_by_sound_component:
                    self._hanzi_by_sound_component[note.sound_component] = []
                self._hanzi_by_sound_component[note.sound_component].append(note)

            # Index by syllable (only single characters)
            if note.traditional and len(note.traditional) == 1 and note.syllable:
                if note.syllable not in self._hanzi_by_syllable:
                    self._hanzi_by_syllable[note.syllable] = []
                self._hanzi_by_syllable[note.syllable].append(note)

            # Index by tag
            for tag in note.tags:
                if tag not in self._hanzi_by_tag:
                    self._hanzi_by_tag[tag] = []
                self._hanzi_by_tag[tag].append(note)

        # Index two-character TOCFL notes
        for note in self.tocfl_notes:
            if note.traditional and len(note.traditional) == 2:
                self._tocfl_two_char.append(note)

    def get_by_traditional(self, char: str) -> HanziNote | None:
        """Get a Hanzi note by its traditional character"""
        return self._hanzi_by_traditional.get(char)

    def get_by_sound_component(self, component: str) -> list[HanziNote]:
        """Get all Hanzi notes with a specific sound component"""
        return self._hanzi_by_sound_component.get(component, [])

    def get_by_syllable(self, syllable: str) -> list[HanziNote]:
        """Get all single-character Hanzi notes with a specific syllable"""
        return self._hanzi_by_syllable.get(syllable.lower(), [])

    def get_by_tag(self, tag: str) -> list[HanziNote]:
        """Get all Hanzi notes with a specific tag"""
        return self._hanzi_by_tag.get(tag, [])

    def get_single_char_hanzi(self) -> list[HanziNote]:
        """Get all single-character Hanzi notes"""
        return [n for n in self.hanzi_notes if n.traditional and len(n.traditional) == 1]

    def get_two_char_tocfl(self) -> list[TOCFLNote]:
        """Get all two-character TOCFL notes"""
        return self._tocfl_two_char

    def get_two_char_tocfl_by_character(self, char: str) -> list[TOCFLNote]:
        """Get all two-character TOCFL notes containing a specific character"""
        return [n for n in self._tocfl_two_char if char in n.traditional]

    def get_all_traditional_chars(self) -> set[str]:
        """Get all unique single traditional characters"""
        return {
            normalize_cjk_char(n.traditional)
            for n in self.hanzi_notes
            if n.traditional and len(n.traditional) == 1
        }

    def get_sound_component_counts(self) -> dict[str, int]:
        """Get count of characters per sound component"""
        return {k: len(v) for k, v in self._hanzi_by_sound_component.items()}

    def get_syllable_counts(self) -> dict[str, int]:
        """Get count of characters per syllable"""
        return {k: len(v) for k, v in self._hanzi_by_syllable.items()}

    def stats(self) -> dict[str, int]:
        """Return statistics about the data store"""
        return {
            'hanzi_notes': len(self.hanzi_notes),
            'tocfl_notes': len(self.tocfl_notes),
            'unique_sound_components': len(self._hanzi_by_sound_component),
            'unique_syllables': len(self._hanzi_by_syllable),
            'unique_tags': len(self._hanzi_by_tag),
            'two_char_tocfl': len(self._tocfl_two_char),
        }


# Global data store instance
_data_store: HanziDataStore | None = None


def get_data_store() -> HanziDataStore:
    """Get the global data store, raising an error if not initialized"""
    if _data_store is None:
        raise RuntimeError("Data store not initialized. Call load_all_data() first.")
    return _data_store


def load_all_data() -> HanziDataStore:
    """
    Load all Hanzi and TOCFL notes from Anki into the global data store.

    This should be called once at startup before running any generators.

    Returns:
        The initialized HanziDataStore
    """
    global _data_store

    print("Loading all Hanzi notes from Anki...")

    # Fetch all unsuspended Hanzi notes
    hanzi_query = 'note:Hanzi -is:suspended'
    response = anki_connect_request("findNotes", {"query": hanzi_query})
    hanzi_ids = response.get("result", [])

    print(f"  Found {len(hanzi_ids)} Hanzi notes, fetching details...")

    # Fetch note details in batches
    hanzi_notes: list[HanziNote] = []
    batch_size = 500
    for i in range(0, len(hanzi_ids), batch_size):
        batch_ids = hanzi_ids[i:i + batch_size]
        response = anki_connect_request("notesInfo", {"notes": batch_ids})
        notes_info = response.get("result", [])

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            pinyin = note['fields'].get('Pinyin', {}).get('value', '').strip()
            meaning = get_meaning_field(note)
            sound_component = note['fields'].get('Sound component character', {}).get('value', '').strip()
            tags = set(note.get('tags', []))

            hanzi_notes.append(HanziNote(
                note_id=note['noteId'],
                traditional=traditional,
                pinyin=pinyin,
                meaning=meaning,
                sound_component=sound_component,
                tags=tags,
            ))

    print(f"  Loaded {len(hanzi_notes)} Hanzi notes")

    # Fetch all unsuspended TOCFL notes
    print("Loading all TOCFL notes from Anki...")
    tocfl_query = 'note:TOCFL -is:suspended'
    response = anki_connect_request("findNotes", {"query": tocfl_query})
    tocfl_ids = response.get("result", [])

    print(f"  Found {len(tocfl_ids)} TOCFL notes, fetching details...")

    tocfl_notes: list[TOCFLNote] = []
    for i in range(0, len(tocfl_ids), batch_size):
        batch_ids = tocfl_ids[i:i + batch_size]
        response = anki_connect_request("notesInfo", {"notes": batch_ids})
        notes_info = response.get("result", [])

        for note in notes_info:
            traditional = note['fields'].get('Traditional', {}).get('value', '').strip()
            meaning = get_meaning_field(note)

            tocfl_notes.append(TOCFLNote(
                note_id=note['noteId'],
                traditional=traditional,
                meaning=meaning,
            ))

    print(f"  Loaded {len(tocfl_notes)} TOCFL notes")

    # Create and populate the data store
    _data_store = HanziDataStore(
        hanzi_notes=hanzi_notes,
        tocfl_notes=tocfl_notes,
    )
    _data_store.build_indexes()

    stats = _data_store.stats()
    print(f"  Built indexes: {stats['unique_sound_components']} sound components, "
          f"{stats['unique_syllables']} syllables, {stats['unique_tags']} tags")

    return _data_store


def escape_comma(text: str) -> str:
    """Replace ASCII comma with fullwidth comma + variation selector to avoid field delimiter conflicts"""
    return text.replace(',', '，︀')


@dataclass
class ConnectDotsNote:
    """Represents a ConnectDots note to be created or updated"""
    key: str
    left: list[str]
    right: list[str]
    explanation: list[str] = field(default_factory=lambda: list[str]())
    fake_right: list[str] = field(default_factory=lambda: list[str]())

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

    def has_single_right_value(self) -> bool:
        """Check if all right elements (including fake_right) are the same value."""
        all_right_values = set(self.right) | set(self.fake_right)
        return len(all_right_values) <= 1

    def split_if_needed(self, max_items: int = MAX_ITEMS_PER_NOTE) -> list['ConnectDotsNote']:
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
        # Collect all unique right values across all notes, including original fake_right
        # (e.g., syllable generators add fake_right for missing tones)
        all_right_values = set(right for _, right, _ in sorted_tuples) | set(self.fake_right)

        notes: list[ConnectDotsNote] = []
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


class BaseHanziToPinyinGenerator(ConnectDotsGenerator):
    """
    Base class for generators that map Hanzi to Pinyin.

    Subclasses must implement:
    - generator_type: The type identifier (used in key prefix)
    - get_key_suffix(): The suffix for the note key
    - get_notes(): Returns the HanziNote list to process

    Optionally override:
    - get_fake_right(): Returns fake_right values for the note
    """

    @abstractmethod
    def get_key_suffix(self) -> str:
        """Get the suffix for the note key"""
        pass

    @abstractmethod
    def get_notes(self) -> list[HanziNote]:
        """Get the notes to process"""
        pass

    def get_fake_right(self, notes: list[HanziNote]) -> list[str]:
        """Get fake_right values. Override in subclasses if needed."""
        return []

    def generate_notes(self) -> list[ConnectDotsNote]:
        notes = self.get_notes()

        left: list[str] = []
        right: list[str] = []
        explanation: list[str] = []

        for note in notes:
            if note.traditional and note.pinyin:
                left.append(note.traditional)
                right.append(pinyin_with_zhuyin(note.pinyin))
                explanation.append(note.meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.get_key_suffix()}"
        fake_right = self.get_fake_right(notes)
        return [ConnectDotsNote(key=key, left=left, right=right, explanation=explanation, fake_right=fake_right)]


class SoundComponentHanziToPinyin(BaseHanziToPinyinGenerator):
    """
    Generate notes mapping Hanzi with same sound component to their pinyin.

    Uses pre-fetched data from HanziDataStore.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, sound_component: str):
        self.sound_component = sound_component

    @property
    def generator_type(self) -> str:
        return "sound_component"

    def get_key_suffix(self) -> str:
        return self.sound_component

    def get_notes(self) -> list[HanziNote]:
        data_store = get_data_store()
        notes = data_store.get_by_sound_component(self.sound_component)

        # Also include the sound component character itself if it exists
        sound_component_note = data_store.get_by_traditional(self.sound_component)
        if sound_component_note and sound_component_note not in notes:
            notes = [sound_component_note] + notes

        return notes


class CombinedSoundComponentHanziToPinyin(BaseHanziToPinyinGenerator):
    """
    Generate notes mapping Hanzi from multiple sound components to their pinyin.

    Used when individual sound components don't have enough characters to meet
    the threshold for their own note.

    Uses pre-fetched data from HanziDataStore.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, key_name: str, sound_components: list[str]):
        self.key_name = key_name
        self.sound_components = sound_components

    @property
    def generator_type(self) -> str:
        return "sound_component"

    def get_key_suffix(self) -> str:
        return self.key_name

    def get_notes(self) -> list[HanziNote]:
        data_store = get_data_store()
        notes: list[HanziNote] = []
        seen_ids: set[int] = set()

        for component in self.sound_components:
            # Get notes with this sound component
            component_notes = data_store.get_by_sound_component(component)
            for note in component_notes:
                if note.note_id not in seen_ids:
                    notes.append(note)
                    seen_ids.add(note.note_id)

            # Also include the sound component character itself if it exists
            sound_component_note = data_store.get_by_traditional(component)
            if sound_component_note and sound_component_note.note_id not in seen_ids:
                notes.append(sound_component_note)
                seen_ids.add(sound_component_note.note_id)

        return notes


class SyllableHanziToPinyin(BaseHanziToPinyinGenerator):
    """
    Generate notes mapping Hanzi with same syllable to their pinyin.

    Uses pre-fetched data from HanziDataStore.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, syllable: str):
        self.syllable = syllable.lower()

    @property
    def generator_type(self) -> str:
        return "syllable"

    def get_key_suffix(self) -> str:
        return self.syllable

    def get_notes(self) -> list[HanziNote]:
        return get_data_store().get_by_syllable(self.syllable)

    def get_fake_right(self, notes: list[HanziNote]) -> list[str]:
        # Track which tones are present
        present_tones: set[int] = set()
        for note in notes:
            if note.traditional and note.pinyin and note.tone:
                present_tones.add(note.tone)

        # Generate fake_right for missing tones (all 5 tones should be represented)
        all_tones = {1, 2, 3, 4, 5}
        missing_tones = all_tones - present_tones
        fake_right: list[str] = []
        for tone in sorted(missing_tones):
            pinyin_with_tone = syllable_with_tone(self.syllable, tone)
            fake_right.append(pinyin_with_zhuyin(pinyin_with_tone))

        return fake_right


class TagHanziToPinyin(BaseHanziToPinyinGenerator):
    """
    Generate notes mapping Hanzi with a specific tag to their pinyin.

    Uses pre-fetched data from HanziDataStore.
    Left = Traditional characters, Right = Pinyin pronunciations
    """

    def __init__(self, tag: str):
        """
        Args:
            tag: Full tag name in format "prefix::name" (e.g., "prop::square", "prop-top::sheep")
        """
        if "::" not in tag:
            raise ValueError(f"Tag must be in format 'prefix::name', got: {tag}")
        self.tag = tag
        self.tag_prefix, self.tag_name = tag.split("::", 1)

    @property
    def generator_type(self) -> str:
        return self.tag_prefix

    def get_key_suffix(self) -> str:
        return self.tag_name

    def get_notes(self) -> list[HanziNote]:
        return get_data_store().get_by_tag(self.tag)


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
        query = f'-is:suspended tag:{self.tag}'
        note_ids = find_notes_by_query(query)

        if not note_ids:
            return []

        notes_info = get_notes_info(note_ids)

        left: list[str] = []
        right: list[str] = []

        for note in notes_info:
            # Try different field names for traditional
            traditional = (
                note['fields'].get('Traditional', {}).get('value', '').strip() or
                note['fields'].get('Hanzi', {}).get('value', '').strip()
            )

            # Try different field names for meaning (Meaning 2 > Meaning > English)
            meaning = (
                get_meaning_field(note) or
                note['fields'].get('English', {}).get('value', '').strip()
            )

            if traditional and meaning:
                left.append(traditional)
                right.append(meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.tag}"
        return [ConnectDotsNote(key=key, left=left, right=right)]


class TwoCharPhraseByCharacter(ConnectDotsGenerator):
    """
    Generate notes mapping two-character phrases sharing a common character to their meanings.

    Uses pre-fetched data from HanziDataStore.
    Left = Traditional phrases, Right = Meanings
    """

    def __init__(self, character: str):
        self.character = character

    @property
    def generator_type(self) -> str:
        return "two_char_phrase"

    def generate_notes(self) -> list[ConnectDotsNote]:
        data_store = get_data_store()

        # Get two-character TOCFL notes containing this character
        notes = data_store.get_two_char_tocfl_by_character(self.character)

        left: list[str] = []
        right: list[str] = []

        for note in notes:
            if note.traditional and note.meaning:
                left.append(note.traditional)
                right.append(note.meaning)

        if not left:
            return []

        key = f"{self.generator_type}:{self.character}"
        return [ConnectDotsNote(key=key, left=left, right=right)]


class IntersectionGenerator(ConnectDotsGenerator):
    """
    Generate notes from the intersection of two other generators.

    Takes two generators and produces a note containing only elements
    that appear in both generators' left values. Uses the first generator's
    right and explanation values for the common elements.
    """

    def __init__(self, key_name: str, gen1: ConnectDotsGenerator, gen2: ConnectDotsGenerator):
        self.key_name = key_name
        self.gen1 = gen1
        self.gen2 = gen2

    @property
    def generator_type(self) -> str:
        return "intersection"

    def generate_notes(self) -> list[ConnectDotsNote]:
        # Run both generators
        notes1 = self.gen1.generate_notes()
        notes2 = self.gen2.generate_notes()

        if not notes1 or not notes2:
            return []

        # Collect all left values from generator 2 (normalized for comparison)
        left_set2: set[str] = set()
        for note in notes2:
            left_set2.update(normalize_cjk_char(l) for l in note.left)

        # Build result from generator 1, keeping only elements also in generator 2
        left: list[str] = []
        right: list[str] = []
        explanation: list[str] = []

        for note in notes1:
            for i, l in enumerate(note.left):
                if normalize_cjk_char(l) in left_set2:
                    left.append(l)
                    right.append(note.right[i])
                    if note.explanation:
                        explanation.append(note.explanation[i])

        if not left:
            return []

        key = f"{self.generator_type}:{self.key_name}"
        return [ConnectDotsNote(
            key=key,
            left=left,
            right=right,
            explanation=explanation if explanation else []
        )]


class CustomHanziToPinyin(BaseHanziToPinyinGenerator):
    """
    Generate notes mapping a custom set of Hanzi characters to their pinyin.

    Uses pre-fetched data from HanziDataStore.
    """

    def __init__(self, name: str, characters: str):
        self.name = name
        self.characters = characters

    @property
    def generator_type(self) -> str:
        return "custom_hanzi"

    def get_key_suffix(self) -> str:
        return self.name

    def get_notes(self) -> list[HanziNote]:
        data_store = get_data_store()
        notes: list[HanziNote] = []
        for char in self.characters:
            note = data_store.get_by_traditional(char)
            if note:
                notes.append(note)
        return notes


class ExistingNoteInfo(TypedDict):
    """Type for existing note info dictionary"""
    noteId: int
    left: str
    right: str
    explanation: str
    fake_right: str


class ProcessStats(TypedDict):
    """Type for process_generators statistics"""
    created: int
    updated: int
    unchanged: int
    skipped_single_right: int
    errors: int
    untracked: int


class ConnectDotsManager:
    """Manager for creating and updating ConnectDots notes in Anki"""

    DECK_NAME = "Chinese::CharsProps"
    NOTE_TYPE = "ConnectDots"

    def __init__(self, dry_run: bool = False, skip_reschedule: bool = False):
        self.dry_run = dry_run
        self.skip_reschedule = skip_reschedule

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

    def get_existing_notes(self) -> dict[str, ExistingNoteInfo]:
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
        existing: dict[str, ExistingNoteInfo] = {}

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
            print(f"    Left: {note.left_str()}")
            print(f"    Right: {note.right_str()}")
            if note.explanation_str():
                print(f"    Explanation: {note.explanation_str()}")
            if note.fake_right_str():
                print(f"    Fake Right: {note.fake_right_str()}")
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

    def update_note(
        self,
        note_id: int,
        note: ConnectDotsNote,
        existing: ExistingNoteInfo | None = None
    ) -> None:
        """
        Update an existing ConnectDots note

        Args:
            note_id: The ID of the note to update
            note: The new note data
            existing: Optional existing note data for diff display in dry run
        """
        if self.dry_run:
            print(f"  [DRY RUN] Would update note {note_id}: {note.key}")
            new_left = note.left_str()
            new_right = note.right_str()
            new_explanation = note.explanation_str()
            new_fake_right = note.fake_right_str()

            if existing:
                if existing['left'] != new_left:
                    print(f"    Left:")
                    print(f"      - {existing['left']}")
                    print(f"      + {new_left}")
                if existing['right'] != new_right:
                    print(f"    Right:")
                    print(f"      - {existing['right']}")
                    print(f"      + {new_right}")
                if existing['explanation'] != new_explanation:
                    print(f"    Explanation:")
                    print(f"      - {existing['explanation']}")
                    print(f"      + {new_explanation}")
                if existing['fake_right'] != new_fake_right:
                    print(f"    Fake Right:")
                    print(f"      - {existing['fake_right']}")
                    print(f"      + {new_fake_right}")
            else:
                print(f"    Left: {new_left}")
                print(f"    Right: {new_right}")
                if new_explanation:
                    print(f"    Explanation: {new_explanation}")
                if new_fake_right:
                    print(f"    Fake Right: {new_fake_right}")
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
        if not self.skip_reschedule:
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

    def process_generators(self, generators: list[ConnectDotsGenerator]) -> tuple[ProcessStats, dict[str, list[ConnectDotsNote]]]:
        """
        Process all generators and create/update notes as needed

        Args:
            generators: List of generator instances

        Returns:
            Tuple of (statistics dictionary, notes_by_type dictionary)
        """
        stats: ProcessStats = {
            'created': 0,
            'updated': 0,
            'unchanged': 0,
            'skipped_single_right': 0,
            'errors': 0,
            'untracked': 0,
        }
        processed_keys: set[str] = set()
        notes_by_type: dict[str, list[ConnectDotsNote]] = {}

        print("Fetching existing ConnectDots notes...")
        existing_notes = self.get_existing_notes()
        print(f"Found {len(existing_notes)} existing notes")

        for generator in generators:
            gen_type = generator.generator_type
            if gen_type not in notes_by_type:
                notes_by_type[gen_type] = []

            try:
                notes = generator.generate_notes()
            except Exception as e:
                print(f"  Error generating notes: {e}")
                stats['errors'] += 1
                continue

            for note in notes:
                # Collect pre-split notes for coverage stats
                notes_by_type[gen_type].append(note)

                # Split notes that exceed the maximum items threshold
                split_notes = note.split_if_needed(max_items=MAX_ITEMS_PER_NOTE)

                for split_note in split_notes:
                    # Skip notes where all right elements are the same (trivial matching)
                    if split_note.has_single_right_value():
                        print(f"  Skipped (single right value): {split_note.key}")
                        stats['skipped_single_right'] += 1
                        continue

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
                                self.update_note(existing['noteId'], split_note, existing)
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

        return stats, notes_by_type


@dataclass
class FrequencyData:
    """Data from frequency analysis"""
    counts: dict[str, int]
    examples: dict[str, list[str]]
    total_items: int


def get_sound_component_frequencies() -> FrequencyData:
    """
    Get sound component frequency data from all Hanzi notes.

    Uses pre-fetched data from HanziDataStore.

    Returns:
        FrequencyData with counts and examples per sound component
    """
    data_store = get_data_store()

    counts: dict[str, int] = {}
    examples: dict[str, list[str]] = {}
    total_with_sound_component = 0

    for note in data_store.hanzi_notes:
        if not note.sound_component:
            continue

        total_with_sound_component += 1
        counts[note.sound_component] = counts.get(note.sound_component, 0) + 1

        if note.sound_component not in examples:
            examples[note.sound_component] = []
        if len(examples[note.sound_component]) < 5 and note.traditional:
            example = f"{note.traditional}({note.pinyin})" if note.pinyin else note.traditional
            examples[note.sound_component].append(example)

    return FrequencyData(counts=counts, examples=examples, total_items=total_with_sound_component)


def get_tocfl_two_char_frequencies() -> FrequencyData:
    """
    Get character frequency data from two-character TOCFL phrases.

    Uses pre-fetched data from HanziDataStore.

    Returns:
        FrequencyData with counts and examples per character
    """
    data_store = get_data_store()

    counts: dict[str, int] = {}
    examples: dict[str, list[str]] = {}

    two_char_notes = data_store.get_two_char_tocfl()

    for note in two_char_notes:
        # Count each character in the two-character phrase
        for char in note.traditional:
            counts[char] = counts.get(char, 0) + 1
            if char not in examples:
                examples[char] = []
            if len(examples[char]) < 5:
                examples[char].append(note.traditional)

    return FrequencyData(counts=counts, examples=examples, total_items=len(two_char_notes))


def get_syllable_frequencies() -> FrequencyData:
    """
    Get syllable frequency data from all single-character Hanzi notes.

    Uses pre-fetched data from HanziDataStore.

    Returns:
        FrequencyData with counts and examples per syllable
    """
    data_store = get_data_store()

    counts: dict[str, int] = {}
    examples: dict[str, list[str]] = {}

    single_char_notes = data_store.get_single_char_hanzi()

    for note in single_char_notes:
        if not note.pinyin:
            continue

        syllable = note.syllable
        if syllable:
            counts[syllable] = counts.get(syllable, 0) + 1
            if syllable not in examples:
                examples[syllable] = []
            if len(examples[syllable]) < 5:
                examples[syllable].append(f"{note.traditional}({note.pinyin})")

    return FrequencyData(counts=counts, examples=examples, total_items=len(single_char_notes))


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

    data_store = get_data_store()
    data_store_stats = data_store.stats()
    print(f"\n=== Data Store Stats ===")
    print(f"Hanzi notes: {data_store_stats['hanzi_notes']}")
    print(f"TOCFL notes: {data_store_stats['tocfl_notes']}")


def list_sound_component_frequencies(top_n: int = 50) -> None:
    """List sound components by frequency from all Hanzi notes."""
    data = get_sound_component_frequencies()
    print_frequency_table("Sound Component Frequency Analysis", data, "Component", top_n)


def list_syllable_frequencies(top_n: int = 50) -> None:
    """List syllables by frequency from all single-character Hanzi notes."""
    data = get_syllable_frequencies()
    print_frequency_table("Syllable Frequency Analysis", data, "Syllable", top_n)


def list_tocfl_two_char_frequencies(top_n: int = 50) -> None:
    """List characters by frequency from two-character TOCFL phrases."""
    data = get_tocfl_two_char_frequencies()
    print_frequency_table("TOCFL Two-Character Phrase Character Frequency", data, "Character", top_n)


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


@dataclass
class CoverageStats:
    """Statistics about Hanzi coverage in ConnectDots notes"""
    total_hanzi: int
    covered_characters: set[str]
    coverage_by_type: dict[str, set[str]]  # generator_type -> set of characters
    all_characters: set[str] = field(default_factory=lambda: set[str]())  # all Hanzi characters

    @property
    def covered_hanzi(self) -> int:
        return len(self.covered_characters)

    @property
    def coverage_percentage(self) -> float:
        if self.total_hanzi == 0:
            return 0.0
        return (self.covered_hanzi / self.total_hanzi) * 100

    @property
    def uncovered_characters(self) -> set[str]:
        return self.all_characters - self.covered_characters


def get_all_hanzi_characters() -> set[str]:
    """
    Get all single-character Hanzi from the database.

    Uses pre-fetched data from HanziDataStore.

    Returns:
        Set of all Traditional characters from Hanzi notes
    """
    data_store = get_data_store()
    return data_store.get_all_traditional_chars()


def calculate_coverage_from_notes(
    notes_by_type: dict[str, list[ConnectDotsNote]],
    all_hanzi_characters: set[str]
) -> CoverageStats:
    """
    Calculate coverage statistics from generated notes.

    Args:
        notes_by_type: Dictionary mapping generator_type to list of notes
        all_hanzi_characters: Set of all Hanzi characters

    Returns:
        CoverageStats derived from the notes
    """
    covered_characters: set[str] = set()
    coverage_by_type: dict[str, set[str]] = {}

    for gen_type, notes in notes_by_type.items():
        if gen_type not in coverage_by_type:
            coverage_by_type[gen_type] = set()

        for note in notes:
            for char in note.left:
                normalized = normalize_cjk_char(char)
                covered_characters.add(normalized)
                coverage_by_type[gen_type].add(normalized)

    return CoverageStats(
        total_hanzi=len(all_hanzi_characters),
        covered_characters=covered_characters,
        coverage_by_type=coverage_by_type,
        all_characters=all_hanzi_characters
    )


def get_sound_components_above_threshold(min_count: int = SOUND_COMPONENT_MIN_COUNT) -> list[str]:
    """
    Get sound components that have at least min_count characters.

    Args:
        min_count: Minimum number of characters for a sound component to be included

    Returns:
        List of sound component characters meeting the threshold
    """
    data = get_sound_component_frequencies()
    return get_items_above_threshold(data, min_count)


def get_syllables_above_threshold(min_count: int = SYLLABLE_MIN_COUNT) -> list[str]:
    """
    Get syllables that have at least min_count characters.

    Args:
        min_count: Minimum number of characters for a syllable to be included

    Returns:
        List of syllables meeting the threshold
    """
    data = get_syllable_frequencies()
    return get_items_above_threshold(data, min_count)


def get_two_char_phrase_characters_above_threshold(
    min_count: int = TWO_CHAR_PHRASE_MIN_COUNT,
    whitelist: list[str] | None = None
) -> list[str]:
    """
    Get characters from two-character phrases that meet the minimum count threshold.

    Args:
        min_count: Minimum number of two-char phrases for a character to be included
        whitelist: If provided, only return characters in this list

    Returns:
        List of characters meeting the threshold (and whitelist if provided)
    """
    data = get_tocfl_two_char_frequencies()
    above_threshold = get_items_above_threshold(data, min_count)

    if whitelist is not None:
        return [char for char in above_threshold if char in whitelist]
    return above_threshold


def _is_prop_tag(tag: str) -> bool:
    """Check if a tag is a prop tag (starts with 'prop::' or 'prop-')."""
    return tag.startswith("prop::") or tag.startswith("prop-")


def analyze_uncovered_character_tags(
    uncovered_characters: set[str]
) -> list[tuple[str, int, int]]:
    """
    Analyze the prop tags of uncovered characters to find the most common ones.

    Args:
        uncovered_characters: Set of characters that are not covered by any generator

    Returns:
        List of (tag, uncovered_count, total_count) tuples sorted by uncovered_count descending
        Only includes tags starting with 'prop::' or 'prop-'
    """
    data_store = get_data_store()
    uncovered_tag_counts: dict[str, int] = {}
    total_tag_counts: dict[str, int] = {}

    # Count prop tags among uncovered characters
    for char in uncovered_characters:
        note = data_store.get_by_traditional(char)
        if note:
            for tag in note.tags:
                if _is_prop_tag(tag):
                    uncovered_tag_counts[tag] = uncovered_tag_counts.get(tag, 0) + 1

    # Count prop tags among all Hanzi characters
    for note in data_store.hanzi_notes:
        for tag in note.tags:
            if _is_prop_tag(tag):
                total_tag_counts[tag] = total_tag_counts.get(tag, 0) + 1

    # Combine counts: (tag, uncovered_count, total_count)
    result = [
        (tag, uncovered_count, total_tag_counts.get(tag, 0))
        for tag, uncovered_count in uncovered_tag_counts.items()
    ]

    # Sort by uncovered count descending
    return sorted(result, key=lambda x: x[1], reverse=True)


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
        "--list-tocfl-chars",
        action="store_true",
        help="List characters by frequency from two-character TOCFL phrases"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=50,
        help="Number of top items to show (default: 50)"
    )
    parser.add_argument(
        "--skip-reschedule",
        action="store_true",
        help="Skip rescheduling cards after updating notes"
    )
    args = parser.parse_args()

    # Load all data upfront to avoid repeated API calls
    print("=== Loading Data ===\n")
    load_all_data()
    print()

    if args.list_syllables:
        list_syllable_frequencies(top_n=args.top)
        return

    if args.list_sound_components:
        list_sound_component_frequencies(top_n=args.top)
        return

    if args.list_tocfl_chars:
        list_tocfl_two_char_frequencies(top_n=args.top)
        return

    print("=== ConnectDots Note Manager ===\n")

    manager = ConnectDotsManager(dry_run=args.dry_run, skip_reschedule=args.skip_reschedule)
    generators: list[ConnectDotsGenerator] = []

    # Auto-add sound components above threshold
    print(f"Finding sound components with {SOUND_COMPONENT_MIN_COUNT}+ characters...")
    sound_components = get_sound_components_above_threshold(min_count=SOUND_COMPONENT_MIN_COUNT)
    print(f"Found {len(sound_components)} sound components\n")
    for component in sound_components:
        generators.append(SoundComponentHanziToPinyin(component))

    # Auto-add syllables above threshold
    print(f"Finding syllables with {SYLLABLE_MIN_COUNT}+ characters...")
    syllables = get_syllables_above_threshold(min_count=SYLLABLE_MIN_COUNT)
    print(f"Found {len(syllables)} syllables\n")
    for syllable in syllables:
        generators.append(SyllableHanziToPinyin(syllable))

    # Tag-based generators
    for tag_name in TAG_TRADITIONAL_MEANING:
        generators.append(TagTraditionalToMeaning(tag_name))

    # Tag-based Hanzi-to-Pinyin generators
    for tag in HANZI_TO_PINYIN_TAGS:
        generators.append(TagHanziToPinyin(tag))

    # Tag intersection generators
    for key_name, tags in HANZI_TO_PINYIN_INTERSECTIONS:
        if len(tags) >= 2:
            # Start with the first two tags
            gen1 = TagHanziToPinyin(tags[0])
            gen2 = TagHanziToPinyin(tags[1])
            result_gen = IntersectionGenerator(key_name, gen1, gen2)
            # Chain additional tags if more than 2
            for additional_tag in tags[2:]:
                additional_gen = TagHanziToPinyin(additional_tag)
                result_gen = IntersectionGenerator(key_name, result_gen, additional_gen)
            generators.append(result_gen)

    # Two-character phrase generators (by common character)
    print(f"Finding whitelisted characters with {TWO_CHAR_PHRASE_MIN_COUNT}+ two-char phrases...")
    two_char_characters = get_two_char_phrase_characters_above_threshold(
        min_count=TWO_CHAR_PHRASE_MIN_COUNT,
        whitelist=TWO_CHAR_PHRASE_WHITELIST
    )
    print(f"Found {len(two_char_characters)} characters: {', '.join(two_char_characters)}\n")
    for character in two_char_characters:
        generators.append(TwoCharPhraseByCharacter(character))

    # Custom hanzi set generators
    print(f"Adding {len(CUSTOM_HANZI_TO_PINYIN_SETS)} custom hanzi set(s)...")
    for name, characters in CUSTOM_HANZI_TO_PINYIN_SETS.items():
        generators.append(CustomHanziToPinyin(name, characters))

    # Combined sound component generators
    print(f"Adding {len(COMBINED_SOUND_COMPONENTS_TO_PINYIN)} combined sound component(s)...")
    for key_name, components in COMBINED_SOUND_COMPONENTS_TO_PINYIN.items():
        generators.append(CombinedSoundComponentHanziToPinyin(key_name, components))

    if not generators:
        print("No generators to run")
        return

    print(f"\nRunning {len(generators)} generator(s)...\n")
    stats, notes_by_type = manager.process_generators(generators)

    # Get all Hanzi characters for coverage calculation
    all_hanzi_characters = get_all_hanzi_characters()

    # Calculate coverage from generated notes
    coverage = calculate_coverage_from_notes(notes_by_type, all_hanzi_characters)

    print("\n=== Summary ===")
    print(f"Created: {stats['created']}")
    print(f"Updated: {stats['updated']}")
    print(f"Unchanged: {stats['unchanged']}")
    print(f"Skipped (single right): {stats['skipped_single_right']}")
    print(f"Untracked: {stats['untracked']}")
    print(f"Errors: {stats['errors']}")

    print(f"\n=== Hanzi Coverage ===")
    print(f"Total Hanzi: {coverage.total_hanzi}")
    print(f"Covered: {coverage.covered_hanzi} ({coverage.coverage_percentage:.1f}%)")
    print(f"Uncovered: {len(coverage.uncovered_characters)}")
    print(f"\nBy generator type:")
    for gen_type, chars in sorted(coverage.coverage_by_type.items()):
        print(f"  {gen_type}: {len(chars)} characters")

    # Print uncovered characters
    if coverage.uncovered_characters:
        print(f"\n=== Uncovered Characters ({len(coverage.uncovered_characters)}) ===")
        uncovered_sorted = sorted(coverage.uncovered_characters)
        print("".join(uncovered_sorted))

        # Analyze prop tags of uncovered characters
        print(f"\n=== Top 30 Prop Tags Among Uncovered Characters ===")
        tag_counts = analyze_uncovered_character_tags(coverage.uncovered_characters)
        print(f"{'Rank':<6}{'Uncov':<8}{'Total':<8}Tag")
        print("-" * 70)
        for rank, (tag, uncovered_count, total_count) in enumerate(tag_counts[:30], 1):
            print(f"{rank:<6}{uncovered_count:<8}{total_count:<8}{tag}")

    data_store = get_data_store()
    data_store_stats = data_store.stats()
    print(f"\n=== Data Store Stats ===")
    print(f"Hanzi notes: {data_store_stats['hanzi_notes']}")
    print(f"TOCFL notes: {data_store_stats['tocfl_notes']}")


if __name__ == "__main__":
    main()
