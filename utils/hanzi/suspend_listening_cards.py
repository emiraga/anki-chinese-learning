#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Suspend well-learned listening cards in the Chinese::Listening deck.

This script suspends cards (not notes) matched by a set of Anki search queries.
Each query is run sequentially and its matched cards are suspended before moving
on to the next query. Only cards whose note's "Traditional" field contains fewer
than 4 characters are suspended; longer phrases are kept in listening review.
Cards are suspended once they are considered well-learned enough that continued
listening review is no longer needed:

1. deck:Chinese::Listening card:2 -is:suspended prop:reps>=5 prop:lapses=0
2. deck:Chinese::Listening card:2 -is:suspended prop:reps>=5 prop:ivl>=50
"""

import sys
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    add_tags,
    find_cards_by_query,
    get_cards_info,
    get_notes_info,
    suspend_cards,
)

QUERIES = [
    "deck:Chinese::Listening -is:suspended prop:reps>=5 prop:lapses=0",
    "deck:Chinese::Listening -is:suspended prop:reps>=5 prop:ivl>=50",
]

IGNORED_TAG = "card-listening-ignored-on-purpose"

MAX_TRADITIONAL_CHARS = 3


def _is_short_traditional(note: dict[str, Any]) -> bool:
    """Return True if the note's Traditional field has fewer than 4 characters."""
    traditional = note["fields"].get("Traditional", {}).get("value", "").strip()
    return len(traditional) < MAX_TRADITIONAL_CHARS + 1


def main():
    """Suspend cards matched by each query sequentially."""
    print("=== Suspending listening cards ===")

    total_suspended = 0

    for query in QUERIES:
        print(f"\nQuery: {query}")
        card_ids = find_cards_by_query(query)
        print(f"  Found {len(card_ids)} matching cards")

        if not card_ids:
            print("  Nothing to suspend")
            continue

        cards_info = get_cards_info(card_ids)
        note_ids = list({card["note"] for card in cards_info})
        eligible_note_ids = {
            note["noteId"] for note in get_notes_info(note_ids) if _is_short_traditional(note)
        }

        eligible_cards = [
            card["cardId"] for card in cards_info if card["note"] in eligible_note_ids
        ]

        skipped = len(card_ids) - len(eligible_cards)
        if skipped:
            print(f"  Skipping {skipped} cards with 4+ characters in 'Traditional' field")

        if not eligible_cards:
            print("  Nothing to suspend")
            continue

        suspend_cards(eligible_cards)

        suspended_note_ids = list(eligible_note_ids)
        add_tags(suspended_note_ids, IGNORED_TAG)

        total_suspended += len(eligible_cards)
        print(f"  ✓ Suspended {len(eligible_cards)} cards")
        print(f"  ✓ Tagged {len(suspended_note_ids)} notes with '{IGNORED_TAG}'")

    print("\n=== Summary ===")
    print(f"Total cards suspended: {total_suspended}")
    print("=== All done! ===")


if __name__ == "__main__":
    main()
