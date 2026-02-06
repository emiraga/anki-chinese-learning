#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "tocfl" / "20240923"

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
    part_of_speech: str
    context: str
    level: str


def parse_level_from_filename(filename: str) -> str:
    match = re.search(r"\((.+?)\)", filename)
    if not match:
        raise ValueError(f"Could not parse level from filename: {filename}")
    return match.group(1)


def load_csv(path: Path) -> list[TocflWord]:
    level = parse_level_from_filename(path.name)
    words: list[TocflWord] = []

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        # Normalize header: strip whitespace and newlines
        header = [h.split("\n")[0].strip() for h in header]

        # Novice 1/2 and Level 1/2 have a Context column; Level 3/4/5 don't
        has_context = header[0] == "任務領域"

        for row in reader:
            if not any(cell.strip() for cell in row):
                continue

            if has_context:
                context = row[0].strip()
                traditional = row[1].strip()
                pinyin = row[2].strip()
                pos = row[3].strip()
            else:
                context = ""
                traditional = row[0].strip()
                pinyin = row[1].strip()
                pos = row[2].strip()

            words.append(
                TocflWord(
                    traditional=traditional,
                    pinyin=pinyin,
                    part_of_speech=pos,
                    context=context,
                    level=level,
                )
            )

    return words


def load_all() -> list[TocflWord]:
    all_words: list[TocflWord] = []
    for csv_path in sorted(DATA_DIR.glob("*.csv")):
        all_words.extend(load_csv(csv_path))

    # Sort by level order
    level_index = {level: i for i, level in enumerate(LEVEL_ORDER)}
    all_words.sort(key=lambda w: level_index.get(w.level, 999))

    return all_words


if __name__ == "__main__":
    words = load_all()
    print(f"Loaded {len(words)} words across {len(LEVEL_ORDER)} levels")
    for level in LEVEL_ORDER:
        count = sum(1 for w in words if w.level == level)
        print(f"  {level}: {count} words")
    print()
    print(json.dumps([w.__dict__ for w in words[:5]], ensure_ascii=False, indent=2))
