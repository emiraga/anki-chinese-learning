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

import requests
import argparse
import re


def anki_connect_request(action, params=None):
    """
    Send a request to anki-connect

    Args:
        action (str): The action to perform
        params (dict): Parameters for the action

    Returns:
        dict: Response from anki-connect
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


def query_traditional_field(note_type, level=None):
    """
    Query Traditional field values from Anki notes

    Args:
        note_type (str): The note type to query (e.g., "TOCFL", "Dangdai", "Hanzi")
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
    response = anki_connect_request("findNotes", {"query": query})
    note_ids = response.get("result", [])
    print(f"Found {len(note_ids)} notes")

    if not note_ids:
        return []

    # Get note info in batches
    traditional_values = []
    batch_size = 100

    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i:i + batch_size]
        notes_response = anki_connect_request("notesInfo", {"notes": batch_ids})
        notes_info = notes_response.get("result", [])

        for note_info in notes_info:
            traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
            if traditional:
                # Clean HTML tags if present
                traditional = re.sub(r'<[^>]+>', '', traditional)
                traditional_values.append(traditional)

    return traditional_values


def main():
    parser = argparse.ArgumentParser(
        description="Query Traditional field values from Anki notes"
    )
    parser.add_argument(
        "note_type",
        help="Note type to query (e.g., TOCFL, Dangdai, Hanzi, MyWords)"
    )
    parser.add_argument(
        "-l", "--level",
        help="Level field value to filter by (e.g., 1, 1*, 2)"
    )
    parser.add_argument(
        "--count-only",
        action="store_true",
        help="Only show the count, not the values"
    )
    parser.add_argument(
        "--unique",
        action="store_true",
        help="Show only unique values"
    )
    parser.add_argument(
        "--sort",
        action="store_true",
        help="Sort the output alphabetically"
    )
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
