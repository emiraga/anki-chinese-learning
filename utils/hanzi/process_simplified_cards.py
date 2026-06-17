#!/usr/bin/env -S uv run
"""
Process Hanzi notes whose simplified form differs from their traditional form.

This script:
  1. Validates the "Hanzi" (simplified) and "Traditional" fields of all
     unsuspended Hanzi cards, raising on any inconsistency in the data.
  2. Tags every Hanzi note whose simplified form differs from its traditional
     form with "chinese::different-simplified-form" (and removes the tag from
     notes where the two forms are identical).
  3. Ranks the differing-simplified characters by how frequently they appear in
     the phrases (TOCFL notes, all in traditional form), and makes sure there
     are always at least MIN_NEW_CARDS "new" second cards (note:Hanzi card:2) by
     un-suspending the most frequent suspended ones until the quota is met.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    find_notes_by_query,
    get_notes_info,
    find_cards_by_query,
    get_cards_info,
    unsuspend_cards,
    forget_cards,
    add_tags,
    remove_tags,
)
from shared.character_conversion import to_simplified

# Reuse the phrase-scanning logic that already knows how to read TOCFL notes.
from fill_hanzi_chars import extract_characters_from_phrases

DIFFERENT_SIMPLIFIED_TAG = "chinese::different-simplified-form"
MIN_NEW_CARDS = 5
PHRASE_NOTE_TYPES = ["TOCFL"]

# Anki card queue values (see https://docs.ankiweb.net)
QUEUE_NEW = 0
QUEUE_SUSPENDED = -1

# Traditional -> simplified pairs that hanziconv does not know about.
#
# These are kept local (and one-directional) on purpose: the relationship is a
# many-traditional-to-one-simplified merge, so the reverse mapping is ambiguous
# and would corrupt very common characters if added to the shared bidirectional
# conversion table (e.g. to_traditional('你') must stay '你', not become '妳').
EXTRA_TRADITIONAL_TO_SIMPLIFIED: dict[str, str] = {
    "牠": "它",  # "it" (for animals)
    "週": "周",  # week
    "託": "托",  # entrust
    "妳": "你",  # "you" (feminine)
}


def simplified_form(traditional: str) -> str:
    """Best-effort simplified form of a single traditional character."""
    return EXTRA_TRADITIONAL_TO_SIMPLIFIED.get(traditional, to_simplified(traditional))


def get_field(note: dict[str, Any], name: str) -> str:
    """Return the trimmed value of a note field, or '' if missing."""
    return note["fields"].get(name, {}).get("value", "").strip()


def fetch_all_hanzi_notes() -> list[dict[str, Any]]:
    """Fetch full note info for every Hanzi note."""
    note_ids = find_notes_by_query("note:Hanzi")
    notes: list[dict[str, Any]] = []
    for i in range(0, len(note_ids), 100):
        notes.extend(get_notes_info(note_ids[i:i + 100]))
    print(f"Fetched {len(notes)} Hanzi notes")
    return notes


def validate_unsuspended_notes(notes: list[dict[str, Any]], unsuspended_ids: set[int]) -> None:
    """
    Validate the Hanzi/Traditional fields of unsuspended single-character notes.

    Raises:
        ValueError: If any field is empty, malformed, or inconsistent.
    """
    print("\n=== Validating Hanzi/Traditional fields of unsuspended cards ===")
    checked = 0
    for note in notes:
        if note["noteId"] not in unsuspended_ids:
            continue

        traditional = get_field(note, "Traditional")
        if not traditional:
            raise ValueError(f"Hanzi note {note['noteId']} has an empty Traditional field")

        # Only single-character notes carry a simplified/traditional relationship.
        if len(traditional) != 1:
            continue

        hanzi = get_field(note, "Hanzi")
        if not hanzi:
            raise ValueError(
                f"Hanzi note {note['noteId']} ('{traditional}') has an empty Hanzi field"
            )
        if len(hanzi) != 1:
            raise ValueError(
                f"Hanzi note {note['noteId']} ('{traditional}') has a multi-character "
                f"Hanzi field '{hanzi}'"
            )

        # The Hanzi field must be the simplified form of the Traditional field.
        #
        # Note: we intentionally do NOT round-trip through to_traditional() to
        # confirm the Traditional field isn't itself a simplified character.
        # Characters like '了' are legitimate traditional forms that are *also*
        # the simplified form of another character ('瞭'), so
        # to_traditional('了') == '瞭' != '了'. Such one-simplified-to-many-
        # traditional cases are indistinguishable from a genuinely misplaced
        # simplified character using hanziconv alone, so we rely on the forward
        # check below (what is the simplified form of the Traditional field?).
        #
        # We accept the Hanzi field when it is either:
        #   (a) the simplified form derived for the Traditional field, or
        #   (b) the Traditional character itself -- many traditional characters
        #       map to several simplified forms (e.g. 著 -> 着/著, 乾 -> 干/乾),
        #       and the note is the source of truth for which one applies, so a
        #       note keeping the character unchanged is valid.
        expected_simplified = simplified_form(traditional)
        if hanzi != expected_simplified and hanzi != traditional:
            raise ValueError(
                f"Hanzi note {note['noteId']}: Hanzi field '{hanzi}' does not match the "
                f"simplified form '{expected_simplified}' of Traditional '{traditional}'."
            )

        checked += 1

    print(f"Validated {checked} single-character unsuspended Hanzi notes (no problems found)")


def tag_different_simplified(notes: list[dict[str, Any]], dry_run: bool) -> None:
    """
    Add DIFFERENT_SIMPLIFIED_TAG to notes whose Hanzi field differs from Traditional,
    and remove it from notes where the two are identical.
    """
    print("\n=== Tagging notes with a different simplified form ===")
    to_add: list[int] = []
    to_remove: list[int] = []

    for note in notes:
        traditional = get_field(note, "Traditional")
        hanzi = get_field(note, "Hanzi")
        if len(traditional) != 1 or not hanzi:
            continue

        has_tag = DIFFERENT_SIMPLIFIED_TAG in note.get("tags", [])
        is_different = hanzi != traditional

        if is_different and not has_tag:
            to_add.append(note["noteId"])
        elif not is_different and has_tag:
            to_remove.append(note["noteId"])

    print(f"Notes needing the tag added: {len(to_add)}")
    print(f"Notes needing the tag removed: {len(to_remove)}")

    if dry_run:
        print("(dry-run) Skipping tag changes")
        return

    add_tags(to_add, DIFFERENT_SIMPLIFIED_TAG)
    remove_tags(to_remove, DIFFERENT_SIMPLIFIED_TAG)


def compute_character_frequency() -> Counter[str]:
    """Count how often each character appears across the phrase notes."""
    print("\n=== Computing character frequency from phrases ===")
    char_data = extract_characters_from_phrases(PHRASE_NOTE_TYPES)
    freq: Counter[str] = Counter()
    for char, occurrences in char_data.items():
        freq[char] = len(occurrences)
    return freq


def ensure_minimum_new_cards(notes: list[dict[str, Any]], freq: Counter[str], dry_run: bool) -> None:
    """
    Ensure at least MIN_NEW_CARDS "new" second cards (note:Hanzi card:2) exist by
    un-suspending the most frequent suspended ones (and resetting them to new).
    """
    print("\n=== Ensuring minimum number of new card:2 cards ===")

    # Map each single-character traditional form to its note id.
    trad_to_note: dict[str, int] = {}
    for note in notes:
        traditional = get_field(note, "Traditional")
        if len(traditional) == 1:
            trad_to_note[traditional] = note["noteId"]

    # Fetch the state of every second card of the Hanzi note type.
    card2_ids = find_cards_by_query("note:Hanzi card:2")
    card2_info: list[dict[str, Any]] = []
    for i in range(0, len(card2_ids), 100):
        card2_info.extend(get_cards_info(card2_ids[i:i + 100]))
    note_to_card2 = {card["note"]: card for card in card2_info}

    current_new = len(find_cards_by_query("note:Hanzi card:2 is:new -is:suspended"))
    print(f"Current new card:2 count: {current_new} (target: {MIN_NEW_CARDS})")

    needed = MIN_NEW_CARDS - current_new
    if needed <= 0:
        print("Already have enough new cards; nothing to do")
        return

    # Walk the differing-simplified characters in order of phrase frequency and
    # collect suspended second cards until the quota is satisfied.
    to_activate: list[tuple[str, int]] = []
    for char, _count in freq.most_common():
        if len(to_activate) >= needed:
            break
        if simplified_form(char) == char:
            continue  # simplified form identical to traditional -> not relevant
        note_id = trad_to_note.get(char)
        if note_id is None:
            continue
        card = note_to_card2.get(note_id)
        if card is None:
            continue
        if card["queue"] == QUEUE_SUSPENDED:
            to_activate.append((char, card["cardId"]))

    if not to_activate:
        print("No suspended card:2 candidates available to activate")
        return

    print(
        f"Activating {len(to_activate)} suspended card:2 card(s) "
        f"(by frequency): {' '.join(char for char, _ in to_activate)}"
    )
    if len(to_activate) < needed:
        print(
            f"Warning: only {len(to_activate)} suspended candidate(s) available, "
            f"still short of the target of {MIN_NEW_CARDS} new cards."
        )

    if dry_run:
        print("(dry-run) Skipping un-suspend / reset")
        return

    card_ids = [card_id for _, card_id in to_activate]
    unsuspend_cards(card_ids)
    forget_cards(card_ids)
    print("Un-suspended and reset the cards to the new state")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate, tag, and schedule Hanzi notes with a differing simplified form"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without modifying Anki (validation still runs)",
    )
    args = parser.parse_args()

    print("=== Processing simplified-form Hanzi cards ===")

    notes = fetch_all_hanzi_notes()
    unsuspended_ids = set(find_notes_by_query("note:Hanzi -is:suspended"))

    validate_unsuspended_notes(notes, unsuspended_ids)
    tag_different_simplified(notes, args.dry_run)

    freq = compute_character_frequency()
    ensure_minimum_new_cards(notes, freq, args.dry_run)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
