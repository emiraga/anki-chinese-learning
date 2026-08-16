#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Export vocabulary from Anki into a compact JSON payload for the iOS home
screen widget.

Syncs with AnkiWeb first, since study happens mostly on the phone and the
desktop collection would otherwise be stale.

Usage:
    ./export_widget_json.py --out widget.json
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

TOCFL_DECK = "Chinese::tocfl"

# Cap on how many words are published. Keeps the payload small and, more
# usefully, bounds how many sample sentences have to exist: words roll into the
# window only as earlier ones are unsuspended and leave it.
DEFAULT_LIMIT = 50

# Levels are drained in this order. Within a level, words are taken from the
# bottom (highest ID) upwards -- nearest the end of the list, where study has
# reached -- and the next level is only opened once the current one runs out.
TOCFL_LEVELS = ["L2", "L3", "L4", "L5"]

# Note IDs look like "L2-0004"; the trailing number is the position in the level.
_ID_RE = re.compile(r"^L(\d+)-(\d+)")

_TAG_RE = re.compile(r"<[^>]+>")
# Sample Sentences are stored as <p>Chinese<br>Pinyin<br>English</p> per sentence.
_P_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.S | re.I)
_BR_RE = re.compile(r"<br\s*/?>", re.I)


class FieldValue(TypedDict):
    value: str
    order: int


class NoteInfo(TypedDict):
    noteId: int
    modelName: str
    tags: list[str]
    fields: dict[str, FieldValue]


def anki(action: str, params: dict[str, Any] | None = None, timeout: int = ANKI_TIMEOUT) -> Any:
    """Call AnkiConnect, raising on transport or application errors."""
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
    """Strip HTML tags and entities that Anki fields accumulate."""
    return html.unescape(_TAG_RE.sub("", value)).replace(" ", " ").strip()


def field(note: NoteInfo, name: str) -> str:
    return clean(note["fields"].get(name, {"value": "", "order": 0})["value"])


_SYLLABLE_RE = re.compile(r"([a-zA-ZüÜvV]+)([1-5])")


def pinyin_syllables(pinyin: str) -> list[list[Any]] | None:
    """
    Split tone-marked pinyin into [syllable, tone] pairs so the widget can
    colour each syllable without doing pinyin parsing in JavaScript.

    Round-trips through the numbered form: that is what carries the tone as a
    digit, and converting each syllable back gives the marked display form.
    """
    if not pinyin.strip():
        return None
    try:
        numbered = transcriptions.accented_to_numbered(pinyin)
    except Exception:  # noqa: BLE001 - non-pinyin values (e.g. "QQ") just get no tones
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
    """
    Pair each character with its syllable's tone so the widget can colour the
    headword the same way the Anki card templates do.

    Non-Han characters (the slashes and brackets in entries like 橘(子) or
    伯伯/伯) are emitted with tone 0 and rendered uncoloured. Returns None when
    the character count does not match the syllable count, rather than risk
    colouring characters with the wrong tone.
    """
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


def parse_sample(raw: str) -> dict[str, str] | None:
    """
    Pull the first sample sentence out of the field.

    Only the first is kept: a widget has room for one, and shipping all three
    would triple the payload for content nobody sees.
    """
    if not raw.strip():
        return None
    blocks = _P_RE.findall(raw) or [raw]
    parts = [clean(p) for p in _BR_RE.split(blocks[0])]
    parts = [p for p in parts if p]
    if not parts:
        return None
    sample = {"zh": parts[0]}
    if len(parts) > 1:
        sample["py"] = parts[1]
    if len(parts) > 2:
        sample["en"] = parts[2]
    return sample


def sync() -> bool:
    """
    Pull down phone study progress. Returns True on success.

    A sync failure is not fatal: publishing slightly stale data beats
    publishing nothing, so the caller continues either way.
    """
    try:
        anki("sync", timeout=SYNC_TIMEOUT)
        # Sync is async inside Anki; give the collection a moment to settle
        # before querying, otherwise counts can reflect the pre-sync state.
        time.sleep(3)
        return True
    except Exception as exc:  # noqa: BLE001 - any failure degrades the same way
        print(f"warning: sync failed ({exc}); exporting local collection", file=sys.stderr)
        return False


def build_entry(note: NoteInfo, level: str) -> dict[str, Any] | None:
    """Turn one Anki note into a widget entry, or None if it is unusable."""
    traditional = field(note, "Traditional")
    meaning = field(note, "Meaning")
    if not traditional or not meaning:
        return None  # incomplete note, nothing useful to show on a widget

    pinyin = field(note, "Pinyin")
    entry: dict[str, Any] = {
        "t": traditional,
        "p": pinyin,
        "m": meaning,
        "src": "tocfl",
        "lvl": level,
    }
    syllables = pinyin_syllables(pinyin)
    if syllables:
        entry["syl"] = syllables
    chars = hanzi_tones(traditional, syllables)
    if chars:
        entry["tt"] = chars
    raw_sample = note["fields"].get("Sample Sentences", {"value": "", "order": 0})["value"]
    sample = parse_sample(raw_sample)
    if sample:
        entry["ex"] = sample
    return entry


def level_candidates(level: str) -> list[tuple[int, NoteInfo]]:
    """
    Suspended notes for one level, bottom of the list first.

    Sorted by the position embedded in the ID field (L2-0004 -> 4) rather than
    the card's `due` value: once a card has been studied `due` becomes a
    scheduling date rather than a queue position, so it is not comparable
    across the deck. The ID field stays fixed.
    """
    note_ids: list[int] = anki(
        "findNotes", {"query": f'deck:"{TOCFL_DECK}" tag:{level} is:suspended'}
    )
    if not note_ids:
        return []

    notes: list[NoteInfo] = anki("notesInfo", {"notes": note_ids})
    ranked: list[tuple[int, NoteInfo]] = []
    for note in notes:
        match = _ID_RE.match(field(note, "ID"))
        ranked.append((int(match.group(2)) if match else 0, note))
    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return ranked


def collect(levels: list[str], limit: int | None) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Fill the window from the bottom of each level, opening the next only when needed."""
    out: list[dict[str, Any]] = []
    per_level: dict[str, int] = {}
    for level in levels:
        if limit is not None and len(out) >= limit:
            break
        taken = 0
        for _, note in level_candidates(level):
            if limit is not None and len(out) >= limit:
                break
            entry = build_entry(note, level)
            if entry is None:
                continue
            out.append(entry)
            taken += 1
        if taken:
            per_level[level] = taken
    return out, per_level


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Anki vocab for the iOS widget")
    parser.add_argument("--out", default="widget.json", help="output path")
    parser.add_argument("--no-sync", action="store_true", help="skip the AnkiWeb sync")
    parser.add_argument(
        "--levels",
        default=",".join(TOCFL_LEVELS),
        help="comma-separated TOCFL level tags to include (default: %(default)s)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help="max words to publish, in introduction order (default: %(default)s; 0 for all)",
    )
    args = parser.parse_args()

    anki("version")  # fail fast with a clear error if Anki is not running

    if not args.no_sync:
        sync()

    levels = [lvl.strip() for lvl in args.levels.split(",") if lvl.strip()]
    limit = None if args.limit == 0 else args.limit

    # Order is deterministic (level, then position descending), which is what
    # lets publish.sh skip pushes when nothing has actually changed.
    cards, per_level = collect(levels, limit)

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(cards),
        "cards": cards,
    }

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")

    toned = sum(1 for c in cards if "tt" in c)
    with_ex = sum(1 for c in cards if "ex" in c)
    cap = "all" if limit is None else f"cap {limit}"
    breakdown = ", ".join(f"{lvl}:{n}" for lvl, n in per_level.items()) or "none"
    print(
        f"wrote {args.out}: {len(cards)} entries ({breakdown}; {cap}), "
        f"{toned} tone-coloured, {with_ex} with examples"
    )
    if with_ex < len(cards):
        print(f"note: {len(cards) - with_ex} published word(s) have no sample sentence")


if __name__ == "__main__":
    main()
