#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

import csv
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

# Add shared utils to path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))
from anki_utils import find_notes_by_query, get_notes_info

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "tocfl" / "20240923"
POS_FILE = Path(__file__).parent.parent.parent / "app" / "data" / "pos.json"


def load_valid_pos() -> dict[str, str]:
    """Load valid part of speech codes from pos.json.

    Returns a dict mapping lowercase POS to the canonical cased version.
    """
    with open(POS_FILE, encoding="utf-8") as f:
        pos_data = json.load(f)
    return {key.lower(): key for key in pos_data.keys()}

LEVEL_ORDER = [
    "Novice 1",
    "Novice 2",
    "Level 1",
    "Level 2",
    "Level 3",
    "Level 4",
    "Level 5",
]


@dataclass
class TocflWord:
    traditional: str
    pinyin: str
    part_of_speech: list[str]
    context: str
    level: str


@dataclass
class TocflEntry:
    """Aggregated entry for a traditional character, combining all occurrences."""
    traditional: str
    entries: list[TocflWord]
    pinyin: list[str]
    context: list[str]
    part_of_speech: list[str]
    levels: list[str]


# Zhuyin characters for detecting pronunciation annotations
ZHUYIN_CHARS = set("ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ˙ˊˇˋ")


def contains_zhuyin(text: str) -> bool:
    """Check if text contains zhuyin characters."""
    return any(c in ZHUYIN_CHARS for c in text)


def parse_traditional(raw: str) -> list[str]:
    """Parse traditional field, handling variants and special notations.

    Cases:
    - "石頭(˙ㄊㄡ)" - zhuyin in parentheses, ignore → "石頭"
    - "鴨(子)" - optional char in parentheses → "鴨子" (expand)
    - "做夢/作夢" - two variants → ["做夢", "作夢"]

    Returns list of traditional character variants.
    """
    raw = raw.strip()
    if not raw:
        raise ValueError("Empty traditional field")

    # Split on "/" for variants
    raw_variants = raw.split("/")
    results: list[str] = []

    for variant in raw_variants:
        variant = variant.strip()
        if not variant:
            raise ValueError(f"Empty variant in traditional field: '{raw}'")

        # Check for parentheses
        paren_match = re.search(r"\(([^)]+)\)", variant)
        if paren_match:
            paren_content = paren_match.group(1)

            if contains_zhuyin(paren_content):
                # Zhuyin annotation - remove the parenthesized content entirely
                result = re.sub(r"\([^)]+\)", "", variant).strip()
            else:
                # Optional character(s) - expand by including the content
                result = re.sub(r"\(([^)]+)\)", r"\1", variant).strip()

            if not result:
                raise ValueError(f"Empty result after parsing traditional: '{variant}'")
            results.append(result)
        else:
            results.append(variant)

    # Validate results
    for result in results:
        if not result:
            raise ValueError(f"Empty result in traditional parsing: '{raw}'")
        # Allow Chinese characters, some punctuation that might appear in phrases
        if re.search(r"[a-zA-Z0-9]", result):
            raise ValueError(f"Unexpected ASCII characters in traditional: '{result}' from '{raw}'")
        # Ensure no unparsed special characters remain
        if "/" in result or "(" in result or ")" in result:
            raise ValueError(f"Unparsed special characters in traditional: '{result}' from '{raw}'")

    return results


def parse_pinyin(raw: str, num_traditional_variants: int, traditional_raw: str) -> list[str]:
    """Parse pinyin field, handling variants and optional parts.

    Cases:
    - "xiăohái(zi)" - optional part → "xiăoháizi" (expand)
    - "zuòmèng/zuòmèng" - two variants matching traditional variants
    - Single pinyin for multiple traditional variants - same reading

    Returns list of pinyin variants matching the traditional variants.
    """
    raw = raw.strip()
    if not raw:
        raise ValueError(f"Empty pinyin field for traditional: '{traditional_raw}'")

    # Split on "/" for variants
    raw_variants = raw.split("/")

    # Validate variant count
    if len(raw_variants) != 1 and len(raw_variants) != num_traditional_variants:
        raise ValueError(
            f"Pinyin variant count ({len(raw_variants)}) doesn't match "
            f"traditional variant count ({num_traditional_variants}): "
            f"pinyin='{raw}', traditional='{traditional_raw}'"
        )

    results: list[str] = []
    for variant in raw_variants:
        variant = variant.strip()
        if not variant:
            raise ValueError(f"Empty variant in pinyin field: '{raw}'")

        # Expand optional parts in parentheses
        result = re.sub(r"\(([^)]+)\)", r"\1", variant).strip()

        if not result:
            raise ValueError(f"Empty result after parsing pinyin: '{variant}'")

        # Validate: pinyin should only contain letters, numbers (for tones), spaces, and some punctuation
        if re.search(r"[\u4e00-\u9fff]", result):
            raise ValueError(f"Unexpected Chinese characters in pinyin: '{result}' from '{raw}'")
        # Ensure no unparsed special characters remain
        if "/" in result or "(" in result or ")" in result:
            raise ValueError(f"Unparsed special characters in pinyin: '{result}' from '{raw}'")

        results.append(result)

    # If single pinyin for multiple traditional variants, duplicate it
    if len(results) == 1 and num_traditional_variants > 1:
        results = results * num_traditional_variants

    return results


def parse_part_of_speech(pos: str, valid_pos: dict[str, str], word: str) -> list[str]:
    """Parse part of speech string into a list, splitting on common delimiters.

    Performs case-insensitive matching and returns canonical cased versions.
    Raises ValueError if any part of speech is not in the valid set.
    """
    if not pos:
        return []
    # Split on comma, semicolon, or slash and strip whitespace
    parts = re.split(r"[,;/]", pos)
    raw_parts = [p.strip() for p in parts if p.strip()]

    result = []
    for p in raw_parts:
        canonical = valid_pos.get(p.lower())
        if canonical is None:
            raise ValueError(f"Invalid part of speech '{p}' for word '{word}'. Valid values: {sorted(valid_pos.values())}")
        result.append(canonical)

    return result


def parse_level_from_filename(filename: str) -> str:
    match = re.search(r"\((.+?)\)", filename)
    if not match:
        raise ValueError(f"Could not parse level from filename: {filename}")
    return match.group(1)


def load_csv(path: Path, valid_pos: dict[str, str]) -> list[TocflWord]:
    level = parse_level_from_filename(path.name)
    words: list[TocflWord] = []

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        # Normalize header: strip whitespace and newlines
        header = [h.split("\n")[0].strip() for h in header]

        # Novice 1/2 and Level 1/2 have a Context column; Level 3/4/5 don't
        has_context = header[0] == "任務領域"

        for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            if not any(cell.strip() for cell in row):
                continue

            if has_context:
                context = row[0].strip()
                traditional_raw = row[1].strip()
                pinyin_raw = row[2].strip()
                pos_raw = row[3].strip()
            else:
                context = ""
                traditional_raw = row[0].strip()
                pinyin_raw = row[1].strip()
                pos_raw = row[2].strip()

            try:
                # Parse traditional field to get variants
                traditional_variants = parse_traditional(traditional_raw)

                # Parse pinyin field to get variants matching traditional
                pinyin_variants = parse_pinyin(pinyin_raw, len(traditional_variants), traditional_raw)

                # Parse part of speech (same for all variants)
                pos_list = parse_part_of_speech(pos_raw, valid_pos, traditional_raw)

                # Create a word entry for each variant pair
                for trad, pin in zip(traditional_variants, pinyin_variants):
                    words.append(
                        TocflWord(
                            traditional=trad,
                            pinyin=pin,
                            part_of_speech=pos_list,
                            context=context,
                            level=level,
                        )
                    )
            except ValueError as e:
                raise ValueError(f"Error in {path.name} row {row_num}: {e}") from e

    return words


def load_all() -> list[TocflWord]:
    valid_pos = load_valid_pos()
    all_words: list[TocflWord] = []
    for csv_path in sorted(DATA_DIR.glob("*.csv")):
        all_words.extend(load_csv(csv_path, valid_pos))

    # Sort by level order
    level_index = {level: i for i, level in enumerate(LEVEL_ORDER)}
    all_words.sort(key=lambda w: level_index.get(w.level, 999))

    return all_words


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

    differences: list[dict[str, object]] = []
    not_in_csv: list[str] = []

    for note in notes:
        traditional = note["fields"].get("Traditional", {}).get("value", "").strip()
        anki_pos_raw = note["fields"].get("POS", {}).get("value", "").strip()

        if not traditional:
            continue

        anki_pos = set(parse_anki_pos(anki_pos_raw))

        if traditional not in mapping:
            if traditional:
                not_in_csv.append(traditional)
            continue

        csv_pos = set(mapping[traditional].part_of_speech)

        if anki_pos != csv_pos:
            differences.append({
                "traditional": traditional,
                "anki_pos": sorted(anki_pos),
                "csv_pos": sorted(csv_pos),
                "anki_only": sorted(anki_pos - csv_pos),
                "csv_only": sorted(csv_pos - anki_pos),
            })

    # Print results
    print(f"\n=== Results ===")
    print(f"Total notes compared: {len(notes)}")
    print(f"Notes not in CSV: {len(not_in_csv)}")
    print(f"POS differences found: {len(differences)}")

    if differences:
        print(f"\n=== POS Differences ===")
        for diff in differences:
            print(f"\n{diff['traditional']}:")
            print(f"  Anki: {diff['anki_pos']}")
            print(f"  CSV:  {diff['csv_pos']}")
            if diff['anki_only']:
                print(f"  Only in Anki: {diff['anki_only']}")
            if diff['csv_only']:
                print(f"  Only in CSV:  {diff['csv_only']}")

    if not_in_csv:
        print(f"\n=== Not in CSV ({len(not_in_csv)} entries) ===")
        for trad in not_in_csv[:20]:  # Show first 20
            print(f"  {trad}")
        if len(not_in_csv) > 20:
            print(f"  ... and {len(not_in_csv) - 20} more")


if __name__ == "__main__":
    words = load_all()
    print(f"Loaded {len(words)} words across {len(LEVEL_ORDER)} levels")
    for level in LEVEL_ORDER:
        count = sum(1 for w in words if w.level == level)
        print(f"  {level}: {count} words")

    mapping = create_mapping(words)
    print(f"\nCreated mapping with {len(mapping)} unique traditional entries")

    # Compare POS with Anki
    compare_pos_with_anki(mapping)
