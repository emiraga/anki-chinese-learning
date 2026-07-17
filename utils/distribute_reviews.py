#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Distribute the currently-due review cards of a deck evenly over the next N days.

This takes all cards that are due now (due date is today or any previous day)
and are not suspended, then reschedules their due dates so they are spread out
evenly across the next N days. Only the due date is moved; card intervals are
left untouched.

Examples:
    ./distribute_reviews.py --days 7
    ./distribute_reviews.py --days 5 --dry-run
    ./distribute_reviews.py --deck "Chinese::Phrases" --days 10
"""

import argparse
import random
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.anki_utils import find_cards_by_query, set_due_date


def build_query(deck: str) -> str:
    """Build the Anki search query for due, non-suspended review cards in a deck."""
    # prop:due<=0 matches review cards whose due date is today (0) or earlier.
    return f'deck:"{deck}" -is:suspended prop:due<=0'


def distribute(card_ids: list[int], days: int) -> list[list[int]]:
    """
    Split card ids into `days` buckets as evenly as possible.

    The cards are shuffled first so no particular ordering is favoured, then the
    remainder is spread across the earliest days. Bucket index i corresponds to a
    due-date offset of i days from today (0 == today).
    """
    if days < 1:
        raise ValueError(f"--days must be at least 1, got {days}")

    shuffled = list(card_ids)
    random.shuffle(shuffled)

    buckets: list[list[int]] = [[] for _ in range(days)]
    for index, card_id in enumerate(shuffled):
        buckets[index % days].append(card_id)
    return buckets


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Distribute currently-due review cards evenly over the next N days."
    )
    parser.add_argument("--days", type=int, required=True, help="Number of days to distribute the cards over")
    parser.add_argument("--deck", default="Chinese", help="Deck name to pull cards from (default: Chinese)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without changing any cards")
    args = parser.parse_args()

    if args.days < 1:
        parser.error("--days must be at least 1")

    query = build_query(args.deck)
    print(f"=== Distribute reviews over {args.days} day(s) ===")
    print(f"Deck: {args.deck}")
    print(f"Query: {query}")

    card_ids = find_cards_by_query(query)
    print(f"Found {len(card_ids)} due, non-suspended card(s)")

    if not card_ids:
        print("Nothing to distribute.")
        return

    buckets = distribute(card_ids, args.days)

    print("\nDistribution plan:")
    for offset, bucket in enumerate(buckets):
        label = "today" if offset == 0 else f"+{offset}d"
        print(f"  {label:>6}: {len(bucket)} card(s)")

    if args.dry_run:
        print("\n(dry run) No changes made.")
        return

    print()
    for offset, bucket in enumerate(buckets):
        if not bucket:
            continue
        set_due_date(bucket, str(offset))
        label = "today" if offset == 0 else f"in {offset} day(s)"
        print(f"✓ Set {len(bucket)} card(s) due {label}")

    print("\n=== Done ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)
