#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Export the entire Dangdai deck (all six books) as a structured reference,
grouped book -> lesson -> section.

Produces two files for a shared gist:
  - dangdai_all.json : machine-readable, nested books/lessons/sections
  - dangdai_all.md   : the same content as a browsable list

Note IDs look like "B2L05-I-01" -- book 2, lesson 5, section I, item 1.
A few carry a "-T-" segment (supplementary) or a trailing "-N" sub-index; both
are handled and the section (I / II / III) is preserved.

Usage:
    ./export_dangdai_all.py --json dangdai_all.json --md dangdai_all.md
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

import requests

ANKI_URL = "http://127.0.0.1:8765"
ANKI_TIMEOUT = 60
SYNC_TIMEOUT = 300
DECK = "dangdai"

_TAG_RE = re.compile(r"<[^>]+>")
# B<book>L<lesson>-<section>[-T]-<index>[-<sub>]
_ID_RE = re.compile(r"^B(\d+)L(\d+)-(I{1,3})(?:-T)?-(\d+)(?:-(\d+))?$")
# Roman numeral -> sort rank, so "II" orders after "I", not lexically.
_SECTION_RANK = {"I": 1, "II": 2, "III": 3}


class FieldValue(TypedDict):
    value: str
    order: int


class NoteInfo(TypedDict):
    noteId: int
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


def sync() -> bool:
    try:
        anki("sync", timeout=SYNC_TIMEOUT)
        time.sleep(3)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"warning: sync failed ({exc}); exporting local collection", file=sys.stderr)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Export all Dangdai vocab, grouped by book/lesson/section")
    parser.add_argument("--json", default="dangdai_all.json", help="structured output path")
    parser.add_argument("--md", default="dangdai_all.md", help="readable output path")
    parser.add_argument("--no-sync", action="store_true", help="skip the AnkiWeb sync")
    args = parser.parse_args()

    anki("version")  # fail fast if Anki is not running
    if not args.no_sync:
        sync()

    notes: list[NoteInfo] = anki("notesInfo", {"notes": anki("findNotes", {"query": f'deck:"{DECK}"'})})

    # books[book][lesson][section] -> list of (index, entry)
    books: dict[int, dict[int, dict[str, list[tuple[int, dict[str, str]]]]]] = {}
    skipped = 0
    for note in notes:
        match = _ID_RE.match(field(note, "ID"))
        if not match:
            skipped += 1
            continue
        book, lesson, section, index, sub = match.groups()
        traditional = field(note, "Traditional")
        meaning = field(note, "Meaning")
        if not traditional:
            skipped += 1
            continue

        entry = {
            "t": traditional,
            "p": field(note, "Pinyin"),
            "m": meaning,
            "id": field(note, "ID"),
        }
        # A trailing sub-index keeps items ordered under their parent item.
        order = int(index) * 100 + (int(sub) if sub else 0)
        (
            books.setdefault(int(book), {})
            .setdefault(int(lesson), {})
            .setdefault(section, [])
            .append((order, entry))
        )

    # Materialise in a stable, human order: book, lesson, section rank, index.
    out_books: dict[str, Any] = {}
    counts: dict[str, Any] = {}
    total = 0
    for book in sorted(books):
        lessons_out: dict[str, Any] = {}
        book_count = 0
        for lesson in sorted(books[book]):
            sections_out: dict[str, list[dict[str, str]]] = {}
            for section in sorted(books[book][lesson], key=lambda s: _SECTION_RANK.get(s, 9)):
                items = [e for _, e in sorted(books[book][lesson][section], key=lambda p: p[0])]
                sections_out[section] = items
                book_count += len(items)
            lessons_out[str(lesson)] = sections_out
        out_books[str(book)] = lessons_out
        counts[str(book)] = book_count
        total += book_count

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "當代中文課程 A Course in Contemporary Chinese (Anki deck)",
        "total": total,
        "counts": counts,
        "books": out_books,
    }

    with open(args.json, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    # Readable companion.
    lines: list[str] = ["# 當代中文課程 — Vocabulary (all books)", ""]
    lines.append(f"Generated {payload['generated']} · {total} words total.")
    lines.append("")
    lines.append("| Book | Words |")
    lines.append("|------|-------|")
    for book in sorted(counts, key=int):
        lines.append(f"| Book {book} | {counts[book]} |")
    lines.append("")
    for book in sorted(out_books, key=int):
        lines.append(f"\n# Book {book}\n")
        for lesson in sorted(out_books[book], key=int):
            lines.append(f"## Lesson {lesson}\n")
            for section in sorted(out_books[book][lesson], key=lambda s: _SECTION_RANK.get(s, 9)):
                lines.append(f"### Section {section}\n")
                for i, e in enumerate(out_books[book][lesson][section], 1):
                    pinyin = f" · {e['p']}" if e["p"] else ""
                    meaning = f" — {e['m']}" if e["m"] else ""
                    lines.append(f"{i}. **{e['t']}**{pinyin}{meaning}")
                lines.append("")

    with open(args.md, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"wrote {args.json} and {args.md}")
    print(f"  {total} words across {len(out_books)} books; skipped {skipped}")
    print("  per book:", ", ".join(f"B{b}:{counts[b]}" for b in sorted(counts, key=int)))


if __name__ == "__main__":
    main()
