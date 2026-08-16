#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill the "Sample Sentences" field from a JSON file of hand-written sentences.

The JSON maps a Traditional headword to [chinese, pinyin, english]:

    {"軟": ["這個麵包很軟。", "Zhège miànbāo hěn ruǎn.", "This bread is very soft."]}

Only notes whose Sample Sentences field is empty are touched, so re-running is
safe and will not clobber existing content.

Usage:
    ./import_sample_sentences.py --json sentences.json --dry-run
    ./import_sample_sentences.py --json sentences.json
"""

from __future__ import annotations

import argparse
import html
import json
import re
from typing import Any

import requests

ANKI_URL = "http://127.0.0.1:8765"
ANKI_TIMEOUT = 60
SAMPLE_FIELD = "Sample Sentences"

DECK_QUERIES = [
    'deck:"Chinese::Taiwan Menu"',
    'deck:"Chinese::tocfl" is:suspended tag:L2',
]

_TAG_RE = re.compile(r"<[^>]+>")


def anki(action: str, params: dict[str, Any] | None = None) -> Any:
    resp = requests.post(
        ANKI_URL,
        json={"action": action, "version": 6, "params": params or {}},
        timeout=ANKI_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"AnkiConnect error on {action}: {data['error']}")
    return data.get("result")


def clean(value: str) -> str:
    return html.unescape(_TAG_RE.sub("", value)).strip()


def esc(text: str) -> str:
    """Escape for HTML text content; the field stores markup."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render(entry: list[str]) -> str:
    """Match the existing field format: <p>Chinese<br>Pinyin<br>English</p>."""
    parts = [esc(p) for p in entry if p]
    return "<p>" + "<br>".join(parts) + "</p>"


def main() -> None:
    parser = argparse.ArgumentParser(description="Import sample sentences into Anki")
    parser.add_argument("--json", required=True, help="path to the sentences JSON")
    parser.add_argument("--dry-run", action="store_true", help="show changes without writing")
    parser.add_argument("--limit", type=int, default=None, help="only process this many notes")
    args = parser.parse_args()

    with open(args.json, encoding="utf-8") as fh:
        sentences: dict[str, list[str]] = json.load(fh)

    anki("version")  # fail fast if Anki is not running

    note_ids: list[int] = []
    for query in DECK_QUERIES:
        note_ids.extend(anki("findNotes", {"query": query}))
    note_ids = list(dict.fromkeys(note_ids))  # de-dupe, preserve order

    notes = anki("notesInfo", {"notes": note_ids})

    updated = skipped_filled = missing = 0
    for note in notes:
        if args.limit is not None and updated >= args.limit:
            break
        traditional = clean(note["fields"]["Traditional"]["value"])
        existing = clean(note["fields"].get(SAMPLE_FIELD, {"value": ""})["value"])
        if existing:
            skipped_filled += 1
            continue
        entry = sentences.get(traditional)
        if not entry:
            missing += 1
            print(f"  no sentence for: {traditional}")
            continue

        value = render(entry)
        if args.dry_run:
            if updated < 5:
                print(f"  [dry] {traditional}: {entry[0]}  /  {entry[2] if len(entry) > 2 else ''}")
        else:
            anki(
                "updateNoteFields",
                {"note": {"id": note["noteId"], "fields": {SAMPLE_FIELD: value}}},
            )
        updated += 1

    verb = "would update" if args.dry_run else "updated"
    print(f"\n{verb}: {updated}   already filled: {skipped_filled}   no sentence available: {missing}")


if __name__ == "__main__":
    main()
