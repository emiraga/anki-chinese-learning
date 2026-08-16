#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Export A Course in Contemporary Chinese (Dangdai) vocabulary for the shared iOS
widget.

Unlike the personal export this publishes *whole lessons*, not a rolling window:
the widget script picks which lesson to show, so everyone reading the gist can
switch chapters without anything being republished.

Note IDs look like "B2L05-I-01" -- book 2, lesson 5, section I, item 1.

Usage:
    ./export_dangdai_json.py --book 2 --out dangdai.json
    ./export_dangdai_json.py --book 2 --lessons 1,2,3
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, TypedDict

import dragonmapper.transcriptions as transcriptions
import requests

ANKI_URL = "http://127.0.0.1:8765"
ANKI_TIMEOUT = 60
SYNC_TIMEOUT = 300

DECK = "dangdai"
DEFAULT_BOOK = 2

_TAG_RE = re.compile(r"<[^>]+>")
_ID_RE = re.compile(r"^B(\d+)L(\d+)-([IVX]+)(?:-T)?-(\d+)")
_SYLLABLE_RE = re.compile(r"([a-zA-ZüÜvV]+)([1-5])")


class FieldValue(TypedDict):
    value: str
    order: int


class NoteInfo(TypedDict):
    noteId: int
    modelName: str
    tags: list[str]
    fields: dict[str, FieldValue]


def anki(action: str, params: dict[str, Any] | None = None, timeout: int = ANKI_TIMEOUT) -> Any:
    resp = requests.post(
        ANKI_URL,
        json={"action": action, "version": 6, "params": params or {}},
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"AnkiConnect error on {action}: {data['error']}")
    return data.get("result")


def clean(value: str) -> str:
    return html.unescape(_TAG_RE.sub("", value)).replace(" ", " ").strip()


def field(note: NoteInfo, name: str) -> str:
    return clean(note["fields"].get(name, {"value": "", "order": 0})["value"])


def pinyin_syllables(pinyin: str) -> list[list[Any]] | None:
    """Split tone-marked pinyin into [syllable, tone] pairs for colouring."""
    if not pinyin.strip():
        return None
    try:
        numbered = transcriptions.accented_to_numbered(pinyin)
    except Exception:  # noqa: BLE001 - names and loanwords may not parse
        return None

    out: list[list[Any]] = []
    for syllable, tone in _SYLLABLE_RE.findall(numbered):
        try:
            display = transcriptions.numbered_to_accented(syllable + tone)
        except Exception:  # noqa: BLE001
            display = syllable
        out.append([display, int(tone)])
    return out or None


def hanzi_tones(traditional: str, syllables: list[list[Any]] | None) -> list[list[Any]] | None:
    """Pair each character with its syllable's tone; None when they do not align."""
    if not syllables:
        return None
    han = [c for c in traditional if "一" <= c <= "鿿"]
    if len(han) != len(syllables):
        return None

    out: list[list[Any]] = []
    index = 0
    for char in traditional:
        if "一" <= char <= "鿿":
            out.append([char, syllables[index][1]])
            index += 1
        else:
            out.append([char, 0])
    return out


def sync() -> bool:
    try:
        anki("sync", timeout=SYNC_TIMEOUT)
        time.sleep(3)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"warning: sync failed ({exc}); exporting local collection", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Dangdai vocab for the shared widget")
    parser.add_argument("--out", default="dangdai.json", help="output path")
    parser.add_argument("--book", type=int, default=DEFAULT_BOOK, help="book number (default: %(default)s)")
    parser.add_argument(
        "--lessons",
        default="",
        help="comma-separated lesson numbers; default is every lesson in the book",
    )
    parser.add_argument("--no-sync", action="store_true", help="skip the AnkiWeb sync")
    args = parser.parse_args()

    anki("version")  # fail fast if Anki is not running
    if not args.no_sync:
        sync()

    wanted: set[int] | None = None
    if args.lessons.strip():
        wanted = {int(x) for x in args.lessons.split(",") if x.strip()}

    note_ids: list[int] = anki("findNotes", {"query": f'deck:"{DECK}"'})
    notes: list[NoteInfo] = anki("notesInfo", {"notes": note_ids})

    lessons: dict[str, list[dict[str, Any]]] = {}
    for note in notes:
        match = _ID_RE.match(field(note, "ID"))
        if not match:
            continue
        book, lesson, section, index = match.groups()
        if int(book) != args.book:
            continue
        if wanted is not None and int(lesson) not in wanted:
            continue

        traditional = field(note, "Traditional")
        meaning = field(note, "Meaning")
        if not traditional or not meaning:
            continue

        pinyin = field(note, "Pinyin")
        entry: dict[str, Any] = {
            "t": traditional,
            "p": pinyin,
            "m": meaning,
            "id": field(note, "ID"),
            # Sort key: section first (I before II), then item number, so the
            # widget can present a lesson in textbook order.
            "_k": (len(section), section, int(index)),
        }
        syllables = pinyin_syllables(pinyin)
        if syllables:
            entry["syl"] = syllables
        chars = hanzi_tones(traditional, syllables)
        if chars:
            entry["tt"] = chars

        lessons.setdefault(str(int(lesson)), []).append(entry)

    for entries in lessons.values():
        entries.sort(key=lambda e: e["_k"])
        for entry in entries:
            del entry["_k"]

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "book": args.book,
        "lessons": {k: lessons[k] for k in sorted(lessons, key=int)},
        "counts": {k: len(lessons[k]) for k in sorted(lessons, key=int)},
    }

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    total = sum(len(v) for v in lessons.values())
    toned = sum(1 for v in lessons.values() for e in v if "tt" in e)
    print(
        f"wrote {args.out}: book {args.book}, "
        f"{len(lessons)} lessons, {total} words, {toned} tone-coloured"
    )


if __name__ == "__main__":
    main()
