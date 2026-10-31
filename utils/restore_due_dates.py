#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Undo "set due date" reschedules made since a given time, restoring each card's
previous due date and interval from its review log.

Every set-due-date writes a manual (type 4) review-log entry whose `lastIvl` is
the interval the card had before. As long as the last entry before the incident
is a real review, the card's original due date is that review's day plus that
interval, so it can be reconstructed exactly.

The day arithmetic is cross-checked against the cards themselves: under FSRS,
setting a card due today sets its interval to the days elapsed since its last
review, which must match what this script computes from the review log.

Examples:
    ./restore_due_dates.py --query "deck:Chinese::.Connect is:due" --since "2026-10-11 19:09"
    ./restore_due_dates.py --query "deck:Chinese::.Connect is:due" --since "2026-10-11 19:09" --apply
"""

import argparse
import collections
import datetime
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.anki_utils import AnkiReview, find_cards_by_query, get_cards_info, get_reviews_of_cards, set_card_values

MANUAL_REVLOG_TYPE = 4
REVIEW_CARD_TYPE = 2


def anki_date(epoch_seconds: float, rollover_hour: int) -> datetime.date:
    """The Anki day a moment belongs to; days start at `rollover_hour`, not midnight."""
    return (datetime.datetime.fromtimestamp(epoch_seconds, datetime.UTC).astimezone() - datetime.timedelta(hours=rollover_hour)).date()


def get_today_due_number() -> int:
    """
    The value of the `due` column that means "today" for review cards.

    Review cards store `due` as a day number relative to the collection's
    creation, which AnkiConnect does not expose, so read it off any review card
    that is due today.
    """
    card_ids = find_cards_by_query("prop:due=0 is:review -is:learn")
    for card in get_cards_info(card_ids[:50]):
        if card["type"] == REVIEW_CARD_TYPE and card["queue"] == REVIEW_CARD_TYPE:
            return card["due"]
    raise Exception("No review card is due today, cannot determine today's day number")


def plan_restore(
    card_id: int,
    reviews: list[AnkiReview],
    since_ms: int,
    today: datetime.date,
    rollover_hour: int,
) -> tuple[int, int, int] | None:
    """
    Work out a card's due date and interval from before the incident.

    Returns:
        (days from today to the original due date, original interval, days
        elapsed since the last review), or None if the incident did not touch
        the card or it has been answered since.

    Raises:
        Exception: If the card's state before the incident cannot be reconstructed.
    """
    before = [r for r in reviews if r["id"] < since_ms]
    incident = [r for r in reviews if r["id"] >= since_ms]
    if not incident or any(r["type"] != MANUAL_REVLOG_TYPE for r in incident):
        return None

    if not before or before[-1]["type"] == MANUAL_REVLOG_TYPE:
        raise Exception(f"Card {card_id}: no real review right before the incident, its original due date is unknown")

    original_ivl = incident[0]["lastIvl"]
    if original_ivl <= 0:
        raise Exception(f"Card {card_id}: was in learning before the incident (lastIvl {original_ivl})")

    review_date = anki_date(before[-1]["id"] / 1000, rollover_hour)
    elapsed = (today - review_date).days
    return original_ivl - elapsed, original_ivl, elapsed


def main() -> None:
    parser = argparse.ArgumentParser(description="Undo set-due-date reschedules made since a given time.")
    parser.add_argument("--query", required=True, help="Anki search query for the affected cards")
    parser.add_argument("--since", required=True, help='Local time just before the incident, e.g. "2026-10-11 19:09"')
    parser.add_argument("--rollover", type=int, default=4, help="Hour the Anki day starts at (default: 4)")
    parser.add_argument("--apply", action="store_true", help="Write the changes (default is a dry run)")
    args = parser.parse_args()

    since_ms = int(datetime.datetime.fromisoformat(args.since).timestamp() * 1000)
    today = anki_date(datetime.datetime.now(datetime.UTC).timestamp(), args.rollover)
    today_due = get_today_due_number()

    card_ids = find_cards_by_query(args.query)
    print(f"Found {len(card_ids)} card(s) for query: {args.query}")
    cards = {card["cardId"]: card for card in get_cards_info(card_ids)}
    reviews = get_reviews_of_cards(card_ids)

    values: dict[int, dict[str, int]] = {}
    skipped: list[int] = []
    mismatched: list[str] = []
    for card_id in card_ids:
        plan = plan_restore(card_id, reviews.get(card_id, []), since_ms, today, args.rollover)
        if plan is None:
            skipped.append(card_id)
            continue
        offset, original_ivl, elapsed = plan
        card = cards[card_id]
        if card["due"] == today_due and card.get("interval") != elapsed:
            mismatched.append(f"{card_id} (interval {card.get('interval')}, computed elapsed {elapsed})")
        values[card_id] = {"due": today_due + offset, "ivl": original_ivl}

    if mismatched:
        raise Exception(
            "Days elapsed since the last review do not match the cards' intervals; check --rollover "
            f"(only FSRS collections are supported): {', '.join(mismatched[:10])}"
        )

    print(f"Restoring {len(values)} card(s), skipping {len(skipped)} not touched by the incident or answered since")
    offsets = collections.Counter(columns["due"] - today_due for columns in values.values())
    overdue = sum(n for offset, n in offsets.items() if offset <= 0)
    print(f"  {overdue} card(s) were already due on or before today and stay due")
    weeks = collections.Counter(max(offset, 0) // 7 for offset, n in offsets.items() for _ in range(n))
    for week in sorted(weeks):
        print(f"  due in week {week:>3}: {weeks[week]} card(s)")

    if not args.apply:
        print("\n(dry run) No changes made. Re-run with --apply to write them.")
        return

    set_card_values(values, allow_protected_keys=True)
    print(f"\n✓ Restored due date and interval of {len(values)} card(s)")


if __name__ == "__main__":
    main()
