#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Compare the TOCFL word lists with the TOCFL notes in Anki.

Reads the TOCFL CSV exports (one per level), aggregates every entry by its
traditional form, and reports where the part-of-speech tags on the Anki notes
disagree with the CSV. Notes with an empty Context field are filled in from the
CSV.
"""

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

# Add shared utils to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_field_value, get_notes_info, update_note_fields
from shared.cli import parse_no_arguments
from shared.tocfl_csv import LEVEL_ORDER, TocflWord, load_all


@dataclass
class TocflEntry:
    """Aggregated entry for a traditional character, combining all occurrences."""

    traditional: str
    entries: list[TocflWord]
    pinyin: list[str]
    context: list[str]
    part_of_speech: list[str]
    levels: list[str]


class PosDifference(TypedDict):
    note_id: int
    traditional: str
    anki_pos: list[str]
    csv_pos: list[str]
    anki_only: list[str]
    csv_only: list[str]


class ContextUpdate(TypedDict):
    note_id: int
    traditional: str
    csv_context: list[str]


def create_mapping(words: list[TocflWord]) -> dict[str, TocflEntry]:
    """Create a mapping from traditional characters to aggregated entries.

    Groups all entries by traditional character and unifies pinyin, context, and POS.
    """
    # Group words by traditional
    groups: dict[str, list[TocflWord]] = {}
    for word in words:
        if word.traditional not in groups:
            groups[word.traditional] = []
        groups[word.traditional].append(word)

    # Create aggregated entries
    mapping: dict[str, TocflEntry] = {}
    for traditional, entries in groups.items():
        # Collect unique values while preserving order
        pinyin_seen: set[str] = set()
        pinyin_list: list[str] = []
        for e in entries:
            if e.pinyin not in pinyin_seen:
                pinyin_seen.add(e.pinyin)
                pinyin_list.append(e.pinyin)

        context_seen: set[str] = set()
        context_list: list[str] = []
        for e in entries:
            if e.context and e.context not in context_seen:
                context_seen.add(e.context)
                context_list.append(e.context)

        pos_seen: set[str] = set()
        pos_list: list[str] = []
        for e in entries:
            for pos in e.part_of_speech:
                if pos not in pos_seen:
                    pos_seen.add(pos)
                    pos_list.append(pos)

        level_seen: set[str] = set()
        level_list: list[str] = []
        for e in entries:
            if e.level not in level_seen:
                level_seen.add(e.level)
                level_list.append(e.level)

        mapping[traditional] = TocflEntry(
            traditional=traditional,
            entries=entries,
            pinyin=pinyin_list,
            context=context_list,
            part_of_speech=pos_list,
            levels=level_list,
        )

    return mapping


def parse_anki_pos(pos_value: str) -> list[str]:
    """Parse POS field from Anki, splitting on '/' delimiter."""
    if not pos_value or not pos_value.strip():
        return []
    return [p.strip() for p in pos_value.split("/") if p.strip()]


def compare_pos_with_anki(mapping: dict[str, TocflEntry]) -> None:
    """Compare POS data between CSV mapping and Anki TOCFL notes.

    Queries Anki for all non-suspended TOCFL notes and compares the POS field
    with the aggregated part_of_speech from the CSV mapping.

    When CSV has POS values that Anki doesn't have, updates the Anki note's
    POS field with the combined values and clears the POS Description field.

    Also updates the Context field if it's empty in Anki but available in CSV.
    """
    print("\n=== Comparing POS with Anki ===")

    # Query Anki for non-suspended TOCFL notes
    print("Fetching non-suspended TOCFL notes from Anki...")
    note_ids = find_notes_by_query("note:TOCFL -is:suspended")
    print(f"Found {len(note_ids)} notes")

    if not note_ids:
        print("No TOCFL notes found in Anki")
        return

    # Get note info in batches
    print("Fetching note details...")
    notes = get_notes_info(note_ids)

    differences: list[PosDifference] = []
    context_updates: list[ContextUpdate] = []

    for note in notes:
        traditional = get_field_value(note, "Traditional")
        anki_pos_raw = get_field_value(note, "POS")
        anki_context = get_field_value(note, "Context")

        if not traditional:
            continue

        if traditional not in mapping:
            continue

        entry = mapping[traditional]
        anki_pos = set(parse_anki_pos(anki_pos_raw))
        csv_pos = set(entry.part_of_speech)

        if anki_pos != csv_pos:
            differences.append(
                {
                    "note_id": note["noteId"],
                    "traditional": traditional,
                    "anki_pos": sorted(anki_pos),
                    "csv_pos": sorted(csv_pos),
                    "anki_only": sorted(anki_pos - csv_pos),
                    "csv_only": sorted(csv_pos - anki_pos),
                }
            )

        # Track context updates for notes with empty Context field
        if not anki_context and entry.context:
            context_updates.append(
                {
                    "note_id": note["noteId"],
                    "traditional": traditional,
                    "csv_context": entry.context,
                }
            )

    # Print results
    print("\n=== Results ===")
    print(f"Total notes compared: {len(notes)}")
    print(f"POS differences found: {len(differences)}")
    print(f"Notes with empty Context to update: {len(context_updates)}")

    if differences:
        print("\n=== POS Differences ===")
        for diff in differences:
            print(f"\n{diff['traditional']}:")
            print(f"  Anki: {diff['anki_pos']}")
            print(f"  CSV:  {diff['csv_pos']}")
            if diff["anki_only"]:
                print(f"  Only in Anki: {diff['anki_only']}")
            if diff["csv_only"]:
                print(f"  Only in CSV:  {diff['csv_only']}")

    # Update Anki notes that have POS values only in CSV
    notes_to_update = [d for d in differences if d["csv_only"]]
    if notes_to_update:
        print(f"\n=== Updating {len(notes_to_update)} notes with CSV-only POS values ===")
        for diff in notes_to_update:
            # Combine all POS values (both from Anki and CSV)
            combined_pos = sorted(set(diff["anki_pos"]) | set(diff["csv_pos"]))
            new_pos_value = "/".join(combined_pos)

            print(f"  {diff['traditional']}: {diff['anki_pos']} -> {combined_pos}")

            update_note_fields(
                diff["note_id"],
                {
                    "POS": new_pos_value,
                    "POS Description": "",
                    "Examples": "",
                    "Examples JSON": "",
                },
            )
        print(f"Updated {len(notes_to_update)} notes")

    # Update Context field for notes with empty Context
    if context_updates:
        print(f"\n=== Updating {len(context_updates)} notes with Context from CSV ===")
        for update in context_updates:
            context_value = ", ".join(update["csv_context"])
            print(f"  {update['traditional']}: -> {context_value}")

            update_note_fields(update["note_id"], {"Context": context_value})
        print(f"Updated {len(context_updates)} Context fields")


def main() -> None:
    parse_no_arguments(__doc__)

    words = load_all()
    print(f"Loaded {len(words)} words across {len(LEVEL_ORDER)} levels")
    for level in LEVEL_ORDER:
        count = sum(1 for w in words if w.level == level)
        print(f"  {level}: {count} words")

    mapping = create_mapping(words)
    print(f"\nCreated mapping with {len(mapping)} unique traditional entries")

    # Compare POS with Anki
    compare_pos_with_anki(mapping)


if __name__ == "__main__":
    main()
