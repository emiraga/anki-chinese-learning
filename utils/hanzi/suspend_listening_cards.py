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
on to the next query. Cards are suspended once they are considered well-learned
enough that continued listening review is no longer needed:

1. deck:Chinese::Listening card:2 -is:suspended prop:reps>=5 prop:lapses=0
2. deck:Chinese::Listening card:2 -is:suspended prop:reps>=5 prop:ivl>=50
"""

import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    add_tags,
    find_cards_by_query,
    get_cards_info,
    suspend_cards,
)

QUERIES = [
    "deck:Chinese::Listening -is:suspended prop:reps>=5 prop:lapses=0",
    "deck:Chinese::Listening -is:suspended prop:reps>=5 prop:ivl>=50",
]

IGNORED_TAG = "card-listening-ignored-on-purpose"


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

        suspend_cards(card_ids)

        note_ids = list({card["note"] for card in get_cards_info(card_ids)})
        add_tags(note_ids, IGNORED_TAG)

        total_suspended += len(card_ids)
        print(f"  ✓ Suspended {len(card_ids)} cards")
        print(f"  ✓ Tagged {len(note_ids)} notes with '{IGNORED_TAG}'")

    print("\n=== Summary ===")
    print(f"Total cards suspended: {total_suspended}")
    print("=== All done! ===")


if __name__ == "__main__":
    main()
