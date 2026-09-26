#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Query Traditional field values from Anki notes.

Allows filtering by note type and Level field value.
"""

import argparse
import re
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_field_value, iter_notes_info


def query_traditional_field(note_type: str, level: str | None = None) -> list[str]:
    """
    Query Traditional field values from Anki notes

    Args:
        note_type (str): The note type to query (e.g., "TOCFL", "Hanzi")
        level (str): Optional Level field value to filter by (e.g., "1", "1*")

    Returns:
        list: List of Traditional field values
    """
    # Build the query
    query = f"note:{note_type}"
    if level is not None:
        query += f" Level:{level}"

    print(f"Query: {query}")

    # Find matching notes
    note_ids = find_notes_by_query(query)
    print(f"Found {len(note_ids)} notes")

    traditional_values: list[str] = []

    for note_info in iter_notes_info(note_ids):
        traditional = get_field_value(note_info, "Traditional")
        if traditional:
            # Clean HTML tags if present
            traditional_values.append(re.sub(r"<[^>]+>", "", traditional))

    return traditional_values


def main():
    parser = argparse.ArgumentParser(description="Query Traditional field values from Anki notes")
    parser.add_argument("note_type", help="Note type to query (e.g., TOCFL, Hanzi)")
    parser.add_argument("-l", "--level", help="Level field value to filter by (e.g., 1, 1*, 2)")
    parser.add_argument("--count-only", action="store_true", help="Only show the count, not the values")
    parser.add_argument("--unique", action="store_true", help="Show only unique values")
    parser.add_argument("--sort", action="store_true", help="Sort the output alphabetically")
    args = parser.parse_args()

    print("=" * 60)
    print(f"Querying Traditional field from {args.note_type} notes")
    if args.level:
        print(f"Filtering by Level: {args.level}")
    print("=" * 60)

    traditional_values = query_traditional_field(args.note_type, args.level)

    if args.unique:
        traditional_values = list(set(traditional_values))

    if args.sort:
        traditional_values.sort()

    print(f"\nFound {len(traditional_values)} values")

    if not args.count_only:
        print("\n" + "-" * 40)
        for value in traditional_values:
            print(value)


if __name__ == "__main__":
    main()
