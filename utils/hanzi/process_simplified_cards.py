#!/usr/bin/env -S uv run
"""
Process Hanzi notes whose simplified form differs from their traditional form.

This script:
  1. Validates the "Hanzi" (simplified) and "Traditional" fields of all
     unsuspended Hanzi cards, raising on any inconsistency in the data.
  2. Tags every Hanzi note whose simplified form differs from its traditional
     form with "chinese::different-simplified-form" (and removes the tag from
     notes where the two forms are identical).
  3. Ranks the differing-simplified characters by learning priority, then
     un-suspends every eligible second card (note:Hanzi card:2) and writes that
     ranking into Anki's new-card queue positions, so the cards are introduced
     in priority order.

The pace at which they arrive is deliberately not managed here: it is the
new-cards/day limit of the Chinese::Simplified deck, which you can change in
Anki at any time. Re-running the script re-applies the current ranking to every
card that has not been studied yet, so changing the ranking reshuffles the
queue without disturbing cards already in learning or review.
"""

import argparse
import sys
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    add_tags,
    anki_connect_request,
    find_cards_by_query,
    find_notes_by_query,
    get_cards_info,
    get_notes_info,
    remove_tags,
    set_new_card_positions,
    unsuspend_cards,
)
from shared.character_conversion import to_simplified

# Reuse the phrase-scanning logic that already knows how to read TOCFL notes.
from shared.phrase_utils import extract_characters_from_phrases

DIFFERENT_SIMPLIFIED_TAG = "chinese::different-simplified-form"
PHRASE_NOTE_TYPES = ["TOCFL"]

# Deck holding the second (simplified-form) cards. Its new-cards/day limit is
# what actually paces the schedule; the script only reads it for reporting.
SIMPLIFIED_DECK = "Chinese::Simplified"

# Anki card queue values (see https://docs.ankiweb.net)
QUEUE_NEW = 0
QUEUE_SUSPENDED = -1

# Anki card type values: a card that has never left the new queue is type 0.
CARD_TYPE_NEW = 0

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


# Sentinel used when a note has no usable FrequencyRank. A blank (or malformed)
# rank means "we don't know how common this character is", which should sort
# *after* every character that does have a rank, so we treat it as +infinity.
NO_FREQUENCY_RANK = float("inf")


def get_frequency_rank(note: dict[str, Any]) -> float:
    """
    Return the FrequencyRank field as a number (smaller = more frequent = higher
    priority). Blank or non-numeric ranks become NO_FREQUENCY_RANK so they sort
    last.
    """
    raw = get_field(note, "FrequencyRank")
    if not raw:
        return NO_FREQUENCY_RANK
    try:
        return int(raw)
    except ValueError:
        return NO_FREQUENCY_RANK


def format_frequency_rank(rank: float) -> str:
    """Human-readable FrequencyRank for tables ('—' when unknown)."""
    return "—" if rank == NO_FREQUENCY_RANK else str(int(rank))


def fetch_all_hanzi_notes() -> list[dict[str, Any]]:
    """Fetch full note info for every Hanzi note."""
    note_ids = find_notes_by_query("note:Hanzi")
    notes: list[dict[str, Any]] = []
    for i in range(0, len(note_ids), 100):
        notes.extend(get_notes_info(note_ids[i : i + 100]))
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
    problems: list[str] = []
    for note in notes:
        if note["noteId"] not in unsuspended_ids:
            continue

        traditional = get_field(note, "Traditional")
        if not traditional:
            problems.append(f"Hanzi note {note['noteId']} has an empty Traditional field")
            continue

        # Only single-character notes carry a simplified/traditional relationship.
        if len(traditional) != 1:
            continue

        hanzi = get_field(note, "Hanzi")
        if not hanzi:
            problems.append(f"Hanzi note {note['noteId']} ('{traditional}') has an empty Hanzi field")
            continue
        if len(hanzi) != 1:
            problems.append(f"Hanzi note {note['noteId']} ('{traditional}') has a multi-character Hanzi field '{hanzi}'")
            continue

        # The Hanzi field must be exactly the simplified form of the Traditional
        # field. There is intentionally no "Hanzi may equal Traditional" escape
        # hatch: when a traditional character is genuinely unchanged in Mainland
        # simplified (e.g. 著, 瞭), simplified_form() already returns that same
        # character, so such notes still pass the equality check below. But when
        # OpenCC has a real simplification (佔 -> 占, 乾 -> 干, 於 -> 于, ...), a
        # note that left the Traditional character in the Hanzi field is wrong
        # and must be fixed to the simplified form.
        #
        # Note: we intentionally do NOT round-trip through to_traditional() to
        # confirm the Traditional field isn't itself a simplified character.
        # Characters like '了' are legitimate traditional forms that are *also*
        # the simplified form of another character ('瞭'), so
        # to_traditional('了') == '瞭' != '了'. Such one-simplified-to-many-
        # traditional cases are indistinguishable from a genuinely misplaced
        # simplified character using hanziconv alone, so we rely on the forward
        # check (what is the simplified form of the Traditional field?).
        expected_simplified = simplified_form(traditional)
        if hanzi != expected_simplified:
            problems.append(
                f"Hanzi note {note['noteId']}: Hanzi field '{hanzi}' does not match the "
                f"simplified form '{expected_simplified}' of Traditional '{traditional}'."
            )
            continue

        checked += 1

    if problems:
        raise ValueError(f"Found {len(problems)} inconsistent unsuspended Hanzi note(s):\n  " + "\n  ".join(problems))

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
    """Count how often each character appears across the unsuspended phrase notes."""
    print("\n=== Computing character frequency from phrases ===")
    char_data = extract_characters_from_phrases(PHRASE_NOTE_TYPES, only_unsuspended=True)
    freq: Counter[str] = Counter()
    for char, occurrences in char_data.items():
        freq[char] = len(occurrences)
    return freq


def fetch_card2_by_note() -> dict[int, dict[str, Any]]:
    """Map every Hanzi note id to the card info of its second card (note:Hanzi card:2)."""
    card2_ids = find_cards_by_query("note:Hanzi card:2")
    cards: list[dict[str, Any]] = []
    for i in range(0, len(card2_ids), 100):
        cards.extend(get_cards_info(card2_ids[i : i + 100]))
    return {card["note"]: card for card in cards}


def build_priority_order(notes: list[dict[str, Any]], freq: Counter[str]) -> list[dict[str, Any]]:
    """
    Order the differing-simplified characters by learning priority.

    Only characters whose first card (note:Hanzi card:1) is unsuspended are
    considered: the second card is meant to be scheduled once the first card is
    already being learned.

    Every eligible character is ranked, including those that do not appear in
    any phrase (they simply get a phrase frequency of 0).

    Sorting keys (in order):
      1. FrequencyRank (primary): smaller rank = more common character = higher
         priority; blank/unknown ranks sort last.
      2. Phrase frequency (secondary tie-breaker): characters that appear more
         often across the TOCFL phrases come first.

    Returns a list of entry dicts, each with: char (traditional), simplified,
    count (phrase frequency), freq_rank, note_id.
    """
    # Notes whose first card is unsuspended; only these are eligible.
    card1_unsuspended_ids = set(find_notes_by_query("note:Hanzi card:1 -is:suspended"))

    entries: list[dict[str, Any]] = []
    for note in notes:
        char = get_field(note, "Traditional")
        if len(char) != 1:
            continue
        if simplified_form(char) == char:
            continue  # simplified form identical to traditional -> not relevant
        if note["noteId"] not in card1_unsuspended_ids:
            continue  # first card not yet active -> skip the second card
        entries.append(
            {
                "char": char,
                "simplified": simplified_form(char),
                "count": freq.get(char, 0),
                "freq_rank": get_frequency_rank(note),
                "note_id": note["noteId"],
            }
        )

    # Smaller FrequencyRank first, then higher phrase count first (-count).
    entries.sort(key=lambda e: (e["freq_rank"], -e["count"]))
    return entries


def print_priority_order(priority: list[dict[str, Any]]) -> None:
    """Print the prioritized differing-simplified characters as a table."""
    print("\n=== Differing-simplified characters by priority ===")
    header = f"{'#':>4}  {'Trad':<6}{'Simp':<6}{'PhraseFreq':>10}  {'FreqRank':>9}"
    print(header)
    print("-" * len(header))
    for i, e in enumerate(priority, start=1):
        print(f"{i:>4}  {e['char']:<5} {e['simplified']:<5} {e['count']:>10}  {format_frequency_rank(e['freq_rank']):>9}")
    print(f"\nTotal: {len(priority)} characters")


def print_stats(notes: list[dict[str, Any]], priority: list[dict[str, Any]]) -> None:
    """
    Report how many differing-simplified second cards are still waiting to be
    enabled (i.e. how much of the backlog is left).
    """
    print("\n=== Simplified card:2 activation stats ===")

    note_to_card2 = fetch_card2_by_note()
    card1_unsuspended_ids = set(find_notes_by_query("note:Hanzi card:1 -is:suspended"))

    enabled_new = 0
    enabled_started = 0
    suspended_ready = 0  # first card already active -> can be enabled next
    suspended_blocked = 0  # first card still suspended -> not yet eligible
    missing_card2 = 0

    differing_notes = 0
    for note in notes:
        traditional = get_field(note, "Traditional")
        hanzi = get_field(note, "Hanzi")
        if len(traditional) != 1 or not hanzi or hanzi == traditional:
            continue
        differing_notes += 1

        card = note_to_card2.get(note["noteId"])
        if card is None:
            missing_card2 += 1
        elif card["queue"] == QUEUE_SUSPENDED:
            if note["noteId"] in card1_unsuspended_ids:
                suspended_ready += 1
            else:
                suspended_blocked += 1
        elif card["queue"] == QUEUE_NEW:
            enabled_new += 1
        else:
            enabled_started += 1

    # Of the eligible (first-card-active) characters, how many are still
    # suspended: these are the ones the next run would queue up.
    priority_suspended = sum(
        1 for entry in priority if (card := note_to_card2.get(entry["note_id"])) is not None and card["queue"] == QUEUE_SUSPENDED
    )

    suspended_total = suspended_ready + suspended_blocked
    print(f"Differing-simplified Hanzi notes:        {differing_notes}")
    print(f"  card:2 studied (learning/review):      {enabled_started}")
    print(f"  card:2 queued as new:                  {enabled_new}")
    print(f"  card:2 suspended (to be enabled):      {suspended_total}")
    print(f"    of which card:1 is already active:   {suspended_ready}")
    print(f"    of which card:1 is still suspended:  {suspended_blocked}")
    print(f"  no card:2 generated:                   {missing_card2}")
    print(f"Eligible characters still suspended:     {priority_suspended} (of {len(priority)} eligible)")

    per_day = get_new_cards_per_day()
    if per_day > 0 and enabled_new:
        days = -(-enabled_new // per_day)  # ceil
        print(f"Queue of {enabled_new} new card(s) at {per_day}/day: ~{days} days (until {date.today() + timedelta(days=days)})")

    if differing_notes:
        enabled_total = enabled_new + enabled_started
        pct = 100.0 * enabled_total / differing_notes
        print(f"Progress: {enabled_total}/{differing_notes} enabled ({pct:.1f}%), {suspended_total} remaining")


def get_new_cards_per_day() -> int:
    """Read the new-cards/day limit of the deck holding the second cards."""
    config = anki_connect_request("getDeckConfig", {"deck": SIMPLIFIED_DECK})["result"]
    return int(config["new"]["perDay"])


def schedule_eligible_cards(priority: list[dict[str, Any]], dry_run: bool) -> None:
    """
    Un-suspend every eligible second card and order the new queue by priority.

    Each still-new card:2 gets its rank as its new-queue position, so Anki
    introduces them in exactly the order computed by build_priority_order().
    Cards that have already left the new queue (learning or review) are left
    completely alone, and they do not consume a position.

    Because positions are rewritten from scratch on every run, changing the
    ranking simply reshuffles everything that has not been studied yet.
    """
    print("\n=== Scheduling eligible card:2 cards by priority ===")

    note_to_card2 = fetch_card2_by_note()

    to_unsuspend: list[int] = []
    positions: dict[int, int] = {}
    already_studied = 0
    missing = 0

    position = 0
    for entry in priority:
        card = note_to_card2.get(entry["note_id"])
        if card is None:
            missing += 1
            continue
        if card["type"] != CARD_TYPE_NEW:
            already_studied += 1
            continue

        position += 1
        if card["queue"] == QUEUE_SUSPENDED:
            to_unsuspend.append(card["cardId"])
        if card["due"] != position:
            positions[card["cardId"]] = position

    print(f"Eligible characters:                 {len(priority)}")
    print(f"  already studied (left untouched):  {already_studied}")
    print(f"  queued as new cards:               {position}")
    print(f"    of which need un-suspending:     {len(to_unsuspend)}")
    print(f"    of which need repositioning:     {len(positions)}")
    if missing:
        print(f"  without a card:2 (skipped):        {missing}")

    per_day = get_new_cards_per_day()
    if per_day > 0:
        days = -(-position // per_day)  # ceil
        finish = date.today() + timedelta(days=days)
        print(f"At the deck's current limit of {per_day} new card(s)/day, the queue lasts ~{days} days (until {finish}).")
    else:
        print(f"Deck '{SIMPLIFIED_DECK}' currently allows 0 new cards/day, so none of these will appear.")

    if dry_run:
        print("(dry-run) Skipping un-suspend / reposition")
        return

    unsuspend_cards(to_unsuspend)
    set_new_card_positions(positions)
    print(f"Un-suspended {len(to_unsuspend)} card(s) and repositioned {len(positions)} card(s)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate, tag, and schedule Hanzi notes with a differing simplified form")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without modifying Anki (validation still runs)",
    )
    parser.add_argument(
        "--print-priority",
        action="store_true",
        help="Only print the differing-simplified characters in priority order, then exit",
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Only print how many simplified card:2 cards are still waiting to be enabled, then exit",
    )
    args = parser.parse_args()

    notes = fetch_all_hanzi_notes()
    freq = compute_character_frequency()
    priority = build_priority_order(notes, freq)

    if args.print_priority:
        print_priority_order(priority)
        return

    if args.stats:
        print_stats(notes, priority)
        return

    print("=== Processing simplified-form Hanzi cards ===")

    unsuspended_ids = set(find_notes_by_query("note:Hanzi -is:suspended"))

    validate_unsuspended_notes(notes, unsuspended_ids)
    tag_different_simplified(notes, args.dry_run)

    schedule_eligible_cards(priority, args.dry_run)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
