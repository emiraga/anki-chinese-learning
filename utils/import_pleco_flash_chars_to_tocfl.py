#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///
"""
Import single-character entries from Pleco flashcards export (flash.xml) into
your TOCFL deck (typically "Chinese::SingleChars").

Rules:
- Only imports entries where Traditional headword is exactly 1 CJK character.
- Dry-run by default: prints which characters will be ADDED vs SKIPPED.
- If a character already exists in the deck, skip adding it; in --apply mode
  we will unsuspend the existing Hanzi/TOCFL cards instead of adding duplicates.

Usage:
  uv run utils/import_pleco_flash_chars_to_tocfl.py
  uv run utils/import_pleco_flash_chars_to_tocfl.py --dry-run
  uv run utils/import_pleco_flash_chars_to_tocfl.py --apply
  uv run utils/import_pleco_flash_chars_to_tocfl.py --xml-path "/path/to/flash.xml"
  uv run utils/import_pleco_flash_chars_to_tocfl.py --deck "Chinese::SingleChars"
  uv run utils/import_pleco_flash_chars_to_tocfl.py --hanzi-note-model "Hanzi"

Notes:
- This script uses AnkiConnect, so Anki must be open with AnkiConnect enabled.
- It only unsuspends existing notes in TOCFL (not new ones).
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

import requests
import dragonmapper.transcriptions


ANKI_URL = "http://127.0.0.1:8765"

# Default deck + note model names used across this repo
DEFAULT_DECK = "Chinese::SingleChars"
DEFAULT_TOCFL_MODEL = "TOCFL"


def anki_request(action: str, params=None) -> object:
    if params is None:
        params = {}
    payload = {"action": action, "params": params, "version": 6}
    r = requests.post(ANKI_URL, json=payload, timeout=180)
    r.raise_for_status()
    data = r.json()
    if data.get("error"):
        raise RuntimeError(data["error"])
    return data.get("result")


def is_single_cjk_traditional(s: str) -> bool:
    t = (s or "").strip()
    if len(t) != 1:
        return False
    return bool(re.match(r"^[\u4e00-\u9fff]$", t))


def normalize_numbered_pinyin(p: str) -> str:
    """
    Pleco uses "tones=numbers" and exports like:
      zhun3bei4
      chi2//dao4
    We normalize to space-separated numbered syllables:
      zhun3 bei4
      chi2 dao4
    """
    s = (p or "").strip()
    if not s:
        return ""
    s = s.replace("//", " ")
    s = re.sub(r"\s+", " ", s)
    # Insert space between tone number and following letters, e.g. zhun3bei4 -> zhun3 bei4
    s = re.sub(r"([1-5])([a-zA-ZüÜ])", r"\1 \2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def numbered_to_accented(pinyin_numbered: str) -> str:
    """
    Convert numbered pinyin (with spaces) to tone marks using dragonmapper.
    """
    s = (pinyin_numbered or "").strip()
    if not s:
        return ""
    try:
        return dragonmapper.transcriptions.numbered_to_accented(s)
    except Exception:
        # Fallback: return the raw numbered if conversion fails
        return s


def clean_defn(defn_text: str) -> str:
    """
    Extract meanings from Pleco <defn> while ignoring sample sentences.

    We capture each numbered sense (e.g. "1 English meaning ...") and take
    only the English meaning up to the first CJK character after the number,
    then join all meanings using semicolons (no numbering, no examples).
    """
    s = (defn_text or "").strip()
    s = re.sub(r"\bL\d+\s*:\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""

    meanings: list[str] = []
    markers = list(re.finditer(r"(?<!\w)(\d+)\s+", s))
    if markers:
        for i, m in enumerate(markers):
            start = m.end()
            next_start = markers[i + 1].start() if i + 1 < len(markers) else len(s)
            first_cjk = re.search(r"[\u4e00-\u9fff]", s[start:])
            end_candidates = [next_start]
            if first_cjk:
                end_candidates.append(start + first_cjk.start())
            end = min(end_candidates)

            part = s[start:end].strip()
            part = part.strip(" ;")
            if not part:
                continue
            if not re.search(r"[A-Za-z]", part):
                continue
            meanings.append(part)

    if meanings:
        return ("; ".join(meanings))[:220].strip()

    first_cjk = re.search(r"[\u4e00-\u9fff]", s)
    eng = s[: first_cjk.start()].strip() if first_cjk else s
    eng = re.sub(r"^[A-Za-z]+\s*", "", eng).strip()
    return eng[:220].strip()


def first_pos_guess(defn_text: str) -> str:
    """
    Best-effort POS guess: take the first alphabetic word at the start.
    """
    s = (defn_text or "").strip()
    if not s:
        return ""
    m = re.match(r"^([A-Za-z]+)", s)
    return m.group(1).lower() if m else ""


@dataclass(frozen=True)
class PlecoChar:
    traditional: str
    simplified: str
    pinyin_numbered: str
    meaning: str
    pos: str


def iter_pleco_cards(xml_path: Path) -> Iterable[ET.Element]:
    """
    Stream <card> elements to avoid loading huge XML in memory.
    """
    # ElementTree iterparse is streaming and works fine for this file format.
    context = ET.iterparse(str(xml_path), events=("end",))
    for event, elem in context:
        if elem.tag == "card":
            yield elem
            elem.clear()


def parse_card(elem: ET.Element) -> PlecoChar | None:
    entry = elem.find("entry")
    if entry is None:
        return None

    headword_sc = ""
    headword_tc = ""
    for hw in entry.findall("headword"):
        charset = hw.attrib.get("charset")
        txt = (hw.text or "").strip()
        if charset == "sc":
            headword_sc = txt
        elif charset == "tc":
            headword_tc = txt

    if not is_single_cjk_traditional(headword_tc):
        return None

    pron_el = entry.find("pron")
    pinyin_numbered = (pron_el.text or "").strip() if pron_el is not None else ""
    pinyin_numbered = pinyin_numbered.replace(" ", "")
    pinyin_numbered_norm = normalize_numbered_pinyin(pinyin_numbered)
    pinyin_accented = numbered_to_accented(pinyin_numbered_norm)

    defn_el = entry.find("defn")
    defn_text = "".join(defn_el.itertext()) if defn_el is not None else ""
    meaning = clean_defn(defn_text)
    pos = first_pos_guess(defn_text)

    return PlecoChar(
        traditional=headword_tc,
        simplified=headword_sc or headword_tc,
        pinyin_numbered=pinyin_accented,
        meaning=meaning,
        pos=pos,
    )


def load_existing_tocfl_singlechars(deck: str, note_model: str) -> dict[str, dict]:
    """
    Returns map: traditional_char -> {noteId, cardIds, suspended:boolean, tags}
    """
    query = f'deck:"{deck}" note:{note_model}'
    note_ids = anki_request("findNotes", {"query": query}) or []
    if not note_ids:
        return {}

    # Chunk because AnkiConnect can be sensitive to large payloads.
    out: dict[str, dict] = {}
    card_ids: list[int] = []
    note_cards: dict[int, list[int]] = {}
    batch = 200
    for chunk in chunked(note_ids, batch):
        notes = anki_request("notesInfo", {"notes": chunk}) or []
        for n in notes:
            fields = n.get("fields") or {}
            trad = (fields.get("Traditional", {}).get("value") or "").strip()
            if not is_single_cjk_traditional(trad):
                continue
            cards = n.get("cards") or []
            note_cards[n.get("noteId")] = cards
            card_ids.extend(cards)
            out[trad] = {
                "noteId": n.get("noteId"),
                "tags": n.get("tags") or [],
                "cardIds": cards,
                "suspended": False,  # fill later
            }

    if not card_ids:
        return out

    # Determine suspended cards by queue < 0 (matches other scripts' "active" logic)
    suspended_card_set = set()
    for chunk in chunked(card_ids, 500):
        cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
        for c in cards_info:
            if c.get("queue", 0) < 0:
                suspended_card_set.add(c.get("card"))

    for trad, entry in out.items():
        entry["suspended"] = any(cid in suspended_card_set for cid in entry["cardIds"])

    return out


def chunked(it: list, n: int) -> Iterable[list]:
    for i in range(0, len(it), n):
        yield it[i : i + n]


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Pleco flash.xml single characters into TOCFL.")
    parser.add_argument("--xml-path", default=str(Path.home() / "Dropbox/Pleco/flash.xml"))
    parser.add_argument("--deck", default=DEFAULT_DECK)
    parser.add_argument("--tocfl-note-model", default=DEFAULT_TOCFL_MODEL)
    parser.add_argument("--apply", action="store_true", help="Actually add notes and unsuspend duplicates.")
    parser.add_argument("--print-limit", type=int, default=200)
    args = parser.parse_args()

    xml_path = Path(args.xml_path).expanduser()
    if not xml_path.exists():
        raise FileNotFoundError(f"flash.xml not found: {xml_path}")

    pleco_chars: dict[str, PlecoChar] = {}
    total_cards = 0
    parsed_kept = 0
    for card_elem in iter_pleco_cards(xml_path):
        total_cards += 1
        pc = parse_card(card_elem)
        if not pc:
            continue
        parsed_kept += 1
        pleco_chars[pc.traditional] = pc  # dedupe within XML

    print(f"Pleco XML: {total_cards} <card> elements")
    print(f"Pleco kept: {parsed_kept} single Traditional CJK character(s) (deduped to {len(pleco_chars)})\n")

    print(f"Loading existing TOCFL single characters from deck: {args.deck}")
    existing = load_existing_tocfl_singlechars(args.deck, args.tocfl_note_model)
    print(f"Existing in deck: {len(existing)} single-character TOCFL note(s)\n")

    to_add: list[PlecoChar] = []
    to_unsuspend: list[str] = []
    already_active: list[str] = []

    for ch, pc in pleco_chars.items():
        if ch not in existing:
            to_add.append(pc)
            continue
        # Exists -> skip adding; in --apply mode we unsuspend only if needed.
        if existing[ch].get("suspended"):
            to_unsuspend.append(ch)
        else:
            already_active.append(ch)

    to_add.sort(key=lambda x: x.traditional)
    to_unsuspend.sort()
    already_active.sort()

    print("=" * 80)
    print(f"Dry-run mode: {'OFF (apply enabled)' if args.apply else 'ON'}")
    print(f"Will ADD: {len(to_add)} character(s)")
    print(f"Will UNSUSPEND existing duplicates: {len(to_unsuspend)} character(s)")
    print(f"Already present & active (skip): {len(already_active)} character(s)")
    print("=" * 80)

    def print_chars(title: str, chars: list[str]) -> None:
        print(f"\n{title} ({len(chars)}):")
        if not chars:
            return
        if len(chars) <= args.print_limit:
            print("".join(chars))
        else:
            print("".join(chars[: args.print_limit]))
            print(f"... and {len(chars) - args.print_limit} more")

    print_chars("ADD", [pc.traditional for pc in to_add])
    print_chars("UNSUSPEND", to_unsuspend)
    print_chars("SKIP (already active)", already_active)

    if not args.apply:
        print("\nNo changes made (dry run). Re-run with --apply to add/unsuspend.")
        return

    # --- APPLY ---
    print("\nApplying changes...")

    # 1) Unsuspend existing duplicates
    if to_unsuspend:
        card_ids_to_unsuspend: list[int] = []
        for ch in to_unsuspend:
            card_ids_to_unsuspend.extend(existing[ch].get("cardIds") or [])
        # filter suspended cards only (avoid errors)
        if card_ids_to_unsuspend:
            # chunk to avoid huge payloads
            for chunk in chunked(card_ids_to_unsuspend, 200):
                cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
                suspended_cards = [c.get("card") for c in cards_info if c.get("queue", 0) < 0]
                if suspended_cards:
                    anki_request("cardUnsuspend", {"cards": suspended_cards})

    # 2) Add new notes (leave them unsuspended/new)
    # Determine timestamp-based IDs similar to other scripts.
    import time

    timestamp = int(time.time())
    for i, pc in enumerate(to_add):
        note = {
            "deckName": args.deck,
            "modelName": args.tocfl_note_model,
            "fields": {
                "ID": f"PLECOCHAR-{timestamp}-{i+1}",
                "Traditional": pc.traditional,
                "Simplified": pc.simplified,
                "Pinyin": pc.pinyin_numbered or "?",
                "POS": pc.pos or "",
                "Meaning": pc.meaning or "",
                "Meaning 2": "",
                "Variants": "",
                "Audio": "",
                "Pleco": "",
                "Mnemonic": "",
            },
            "tags": ["pleco::flash"],
        }
        note_id = anki_request("addNote", {"note": note})
        # Ensure cards are unsuspended if Anki deck rules auto-suspended them.
        if note_id is not None:
            card_ids = anki_request("findCards", {"query": f"nid:{note_id}"}) or []
            if card_ids:
                for chunk in chunked(card_ids, 200):
                    cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
                    suspended_cards = [
                        c.get("card") for c in cards_info if c.get("queue", 0) < 0
                    ]
                    if suspended_cards:
                        anki_request("cardUnsuspend", {"cards": suspended_cards})

    print("Done.")


if __name__ == "__main__":
    main()

