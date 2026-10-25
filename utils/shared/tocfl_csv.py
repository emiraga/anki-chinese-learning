"""
Parser for the official TOCFL vocabulary lists in `data/tocfl/`.

The lists come as one CSV export per level (Novice 1-2, Level 1-5). Entries use
a few notations that are expanded here: "/" separates variants, parentheses hold
either an optional part ("鴨(子)") or a Zhuyin annotation ("石頭(˙ㄊㄡ)").
"""

import csv
import re
from dataclasses import dataclass
from pathlib import Path

from .project_paths import TOCFL_CSV_DIR, load_pos_mapping


def load_valid_pos() -> dict[str, str]:
    """Load valid part of speech codes from pos.json.

    Returns a dict mapping lowercase POS to the canonical cased version.
    """
    return {key.lower(): key for key in load_pos_mapping()}


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

    with path.open(newline="", encoding="utf-8") as f:
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
                for trad, pin in zip(traditional_variants, pinyin_variants, strict=False):
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
    for csv_path in sorted(TOCFL_CSV_DIR.glob("*.csv")):
        all_words.extend(load_csv(csv_path, valid_pos))

    # Sort by level order
    level_index = {level: i for i, level in enumerate(LEVEL_ORDER)}
    all_words.sort(key=lambda w: level_index.get(w.level, 999))

    return all_words


def load_tocfl_levels() -> dict[str, str]:
    """
    Map every word in the TOCFL lists to the easiest level it is listed at.

    Returns:
        Traditional word -> level name (e.g. "Level 3"); words missing from the
        lists are beyond Level 5
    """
    levels: dict[str, str] = {}
    for word in load_all():  # sorted easiest level first
        levels.setdefault(word.traditional, word.level)
    return levels
