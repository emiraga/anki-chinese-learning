#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///
"""
Import single characters and/or phrases from Pleco flashcards export (flash.xml)
into Anki TOCFL notes in the specified deck.

Dry-run is the default: no changes are made.

Rules:
- Parse <entry> from flash.xml and read:
  - Traditional headword (charset="tc")
  - Simplified headword (charset="sc"), fallback to Traditional
  - Pinyin from <pron ... tones="numbers">...</pron> (normalized + numbered->accented)
  - Meaning from <defn> (cleaned/trimmed)
  - POS guess from the first alphabetic token of the defn
- If an entry already exists in the target deck's TOCFL model (exact Traditional match):
  - In --apply mode: unsuspend existing note cards (only if currently suspended)
  - Otherwise: skip
- If it does not exist:
  - In --apply mode: add the note, then ensure its cards are unsuspended

Usage:
  uv run utils/import_pleco_flash_to_tocfl.py --deck "Chinese::tocfl"
  uv run utils/import_pleco_flash_to_tocfl.py --deck "Chinese::tocfl" --mode all --dry-run
  uv run utils/import_pleco_flash_to_tocfl.py --deck "Chinese::tocfl" --mode phrases --apply

Options:
  --xml-path "/path/to/flash.xml"
  --deck "Chinese::tocfl"
  --tocfl-note-model "TOCFL"
  --mode {singles,phrases,all}  (default: all)
  --only-cjk-headword           (default: true) require headword be only CJK chars
  --min-phrase-len 2
  --print-limit 80
"""

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

import requests
import dragonmapper.transcriptions

ANKI_URL = "http://127.0.0.1:8765"

DEFAULT_XML_PATH = str(Path.home() / "Dropbox/Pleco/flash.xml")
DEFAULT_DECK = "Chinese::tocfl"
DEFAULT_TOCFL_MODEL = "TOCFL"

CJK_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
CJK_ONLY_FULLMATCH_RE = re.compile(r"^[\u4e00-\u9fff]+$")


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


def iter_pleco_cards(xml_path: Path) -> Iterable[ET.Element]:
    # Stream cards (Pleco export can be large).
    context = ET.iterparse(str(xml_path), events=("end",))
    for _event, elem in context:
        if elem.tag == "card":
            yield elem
            elem.clear()


def normalize_numbered_pinyin(p: str) -> str:
    """
    Pleco export example: zhun3bei4, chi2//dao4
    Normalize to space-separated numbered syllables so dragonmapper can convert.
    """
    s = (p or "").strip()
    if not s:
        return ""
    s = s.replace("//", " ")
    s = re.sub(r"\s+", " ", s).strip()
    # Insert a space between a tone digit and the next syllable's leading letter.
    s = re.sub(r"([1-5])([a-zA-ZüÜ])", r"\1 \2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def numbered_to_accented(pinyin_numbered: str) -> str:
    s = (pinyin_numbered or "").strip()
    if not s:
        return ""
    try:
        return dragonmapper.transcriptions.numbered_to_accented(s)
    except Exception:
        return s


def clean_defn(defn_text: str) -> str:
    """
    Extract meanings from Pleco <defn> while ignoring sample sentences.

    Pleco defn format often looks like:
      (POS) 1 English meaning [English... ] <Chinese example sentence(s)> ... 2 English meaning ...

    We want to save:
    - Only the English meaning parts for each numbered sense (1,2,3,...)
    - Stop as soon as we hit the first CJK character after each number
    - Join multiple meanings using semicolons, without any numbering
    """
    s = (defn_text or "").strip()
    # Remove Pleco Lx: markers.
    s = re.sub(r"\bL\d+\s*:\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""

    meanings: list[str] = []
    # Find numbered sense markers: "1 ", "2 ", "3 ", ...
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
        joined = "; ".join(meanings)
        return joined[:240].strip()

    # Fallback: take the leading English portion before the first CJK character,
    # and drop a leading POS word if it exists (e.g. "verb ...").
    first_cjk = re.search(r"[\u4e00-\u9fff]", s)
    eng = s[: first_cjk.start()].strip() if first_cjk else s
    eng = re.sub(r"^[A-Za-z]+\s*", "", eng).strip()
    return eng[:240].strip()


def first_pos_guess(defn_text: str) -> str:
    s = (defn_text or "").strip()
    if not s:
        return ""
    m = re.match(r"^([A-Za-z]+)", s)
    return m.group(1).lower() if m else ""


def cjk_count(s: str) -> int:
    return len(CJK_CHAR_RE.findall(s or ""))


def is_single_cjk_traditional(trad: str) -> bool:
    t = (trad or "").strip()
    return len(t) == 1 and bool(re.match(r"^[\u4e00-\u9fff]$", t))


def in_mode(trad: str, mode: str, only_cjk_headword: bool, min_phrase_len: int) -> bool:
    t = (trad or "").strip()
    if not t:
        return False
    if only_cjk_headword and not CJK_ONLY_FULLMATCH_RE.fullmatch(t):
        return False
    if mode == "singles":
        return is_single_cjk_traditional(t)
    if mode == "phrases":
        return cjk_count(t) >= min_phrase_len
    if mode == "all":
        return is_single_cjk_traditional(t) or cjk_count(t) >= min_phrase_len
    raise ValueError(f"Unknown mode: {mode}")


@dataclass(frozen=True)
class PlecoEntry:
    traditional: str
    simplified: str
    pinyin: str  # accented, space separated between syllables when possible
    meaning: str
    pos: str


def parse_card(elem: ET.Element) -> PlecoEntry | None:
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

    if not headword_tc:
        return None

    pron_el = entry.find("pron")
    pinyin_raw = (pron_el.text or "").strip() if pron_el is not None else ""
    pinyin_numbered = normalize_numbered_pinyin(pinyin_raw.replace(" ", ""))
    pinyin = numbered_to_accented(pinyin_numbered)

    defn_el = entry.find("defn")
    defn_text = "".join(defn_el.itertext()) if defn_el is not None else ""
    meaning = clean_defn(defn_text)
    pos = first_pos_guess(defn_text)

    simplified = headword_sc or headword_tc
    return PlecoEntry(
        traditional=headword_tc,
        simplified=simplified,
        pinyin=pinyin or "?",
        meaning=meaning,
        pos=pos,
    )


def chunked(xs: list[int], n: int) -> Iterable[list[int]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def chunked_list(xs: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def anki_query_escape(s: str) -> str:
    # Escape backslashes + quotes for Anki query string literals.
    return (s or "").replace("\\", "\\\\").replace('"', '\\"')


def load_existing_tocfl_for_traditionals(
    deck: str, model: str, traditionals: list[str], with_suspension: bool
) -> dict[str, dict]:
    """
    Load matching TOCFL notes in a deck for given Traditional values only.
    This is much faster than scanning the whole deck.
    """
    if not traditionals:
        return {}

    note_id_set: set[int] = set()
    query_batch_size = 30
    for t_chunk in chunked_list(sorted(set(traditionals)), query_batch_size):
        trad_q = " OR ".join(f'Traditional:"{anki_query_escape(t)}"' for t in t_chunk)
        q = f'deck:"{deck}" note:{model} ({trad_q})'
        note_ids = anki_request("findNotes", {"query": q}) or []
        for nid in note_ids:
            note_id_set.add(nid)
    if not note_id_set:
        return {}

    notes = []
    note_ids = list(note_id_set)
    for chunk in chunked(note_ids, 200):
        notes.extend(anki_request("notesInfo", {"notes": chunk}) or [])

    card_ids: list[int] = []
    out: dict[str, dict] = {}
    for n in notes:
        fields = n.get("fields") or {}
        trad = (fields.get("Traditional", {}).get("value") or "").strip()
        if not trad:
            continue
        cards = n.get("cards") or []
        if with_suspension:
            card_ids.extend(cards)
        out[trad] = {
            "noteId": n.get("noteId"),
            "tags": n.get("tags") or [],
            "cardIds": cards,
            "suspended": False,  # filled when with_suspension=True
        }

    if with_suspension and card_ids:
        suspended_card_set = set()
        for chunk in chunked(card_ids, 500):
            cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
            for c in cards_info:
                if c.get("queue", 0) < 0:
                    suspended_card_set.add(c.get("card"))

        for _trad, entry in out.items():
            entry["suspended"] = any(cid in suspended_card_set for cid in entry["cardIds"])
    return out


def ensure_deck(deck: str) -> None:
    try:
        anki_request("createDeck", {"deck": deck})
    except Exception:
        # If it already exists, AnkiConnect may raise. That's fine.
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Pleco flash.xml entries into TOCFL deck")
    parser.add_argument("--xml-path", default=DEFAULT_XML_PATH)
    parser.add_argument("--deck", default=DEFAULT_DECK)
    parser.add_argument("--tocfl-note-model", default=DEFAULT_TOCFL_MODEL)
    parser.add_argument("--mode", choices=["singles", "phrases", "all"], default="all")
    parser.add_argument("--only-cjk-headword", action="store_true", default=True)
    parser.add_argument("--no-only-cjk-headword", action="store_false", dest="only_cjk_headword")
    parser.add_argument("--min-phrase-len", type=int, default=2)
    parser.add_argument("--print-limit", type=int, default=80)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    xml_path = Path(args.xml_path).expanduser()
    if not xml_path.exists():
        raise FileNotFoundError(f"flash.xml not found: {xml_path}")

    ensure_deck(args.deck)

    # Parse + dedupe
    pleco_by_trad: dict[str, PlecoEntry] = {}
    total_cards = 0
    kept = 0
    for card_elem in iter_pleco_cards(xml_path):
        total_cards += 1
        pc = parse_card(card_elem)
        if not pc:
            continue
        if not in_mode(pc.traditional, args.mode, args.only_cjk_headword, args.min_phrase_len):
            continue
        pleco_by_trad[pc.traditional] = pc
        kept += 1

    # Existing: only load TOCFL notes that match extracted Pleco headwords.
    # In dry-run we don't need suspension state for speed.
    existing = load_existing_tocfl_for_traditionals(
        args.deck,
        args.tocfl_note_model,
        list(pleco_by_trad.keys()),
        with_suspension=args.apply,
    )

    to_add: list[PlecoEntry] = []
    to_unsuspend: list[str] = []
    already_active: list[str] = []
    for trad, pc in pleco_by_trad.items():
        if trad not in existing:
            to_add.append(pc)
            continue
        if args.apply and existing[trad].get("suspended"):
            to_unsuspend.append(trad)
        else:
            already_active.append(trad)

    to_add.sort(key=lambda x: x.traditional)
    to_unsuspend.sort()
    already_active.sort()

    print(f"Pleco XML: {total_cards} <card> elements")
    print(f"Kept (after mode filter): {len(pleco_by_trad)} unique Traditional headword(s)\n")
    print(f"Target: deck={args.deck} model={args.tocfl_note_model} mode={args.mode} only_cjk={args.only_cjk_headword}\n")

    print("=" * 80)
    print(f"Dry-run mode: {'OFF (apply enabled)' if args.apply else 'ON'}")
    print(f"Will ADD: {len(to_add)}")
    print(f"Will UNSUSPEND existing duplicates: {len(to_unsuspend)}")
    print(f"Already present & active (skip): {len(already_active)}")
    print("=" * 80)

    def print_list(title: str, items: list[str]) -> None:
        print(f"\n{title} ({len(items)}):")
        if not items:
            return
        if len(items) <= args.print_limit:
            print("".join(items))
        else:
            print("".join(items[: args.print_limit]))
            print(f"... and {len(items) - args.print_limit} more")

    print_list("ADD", [pc.traditional for pc in to_add])
    print_list("UNSUSPEND", to_unsuspend)
    print_list("SKIP (already active)", already_active)

    if not args.apply:
        print("\nNo changes made. Re-run with --apply to add/unsuspend.")
        return

    print("\nApplying changes...")

    # Unsuspend duplicates
    if to_unsuspend:
        card_ids_to_unsuspend: list[int] = []
        for trad in to_unsuspend:
            card_ids_to_unsuspend.extend(existing[trad].get("cardIds") or [])

        if card_ids_to_unsuspend:
            for chunk in chunked(card_ids_to_unsuspend, 200):
                cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
                suspended_cards = [c.get("card") for c in cards_info if c.get("queue", 0) < 0]
                if suspended_cards:
                    anki_request("unsuspend", {"cards": suspended_cards})

    # Add new notes
    timestamp = int(time.time())
    for i, pc in enumerate(to_add):
        note = {
            "deckName": args.deck,
            "modelName": args.tocfl_note_model,
            "fields": {
                "ID": f"PLECOFLASH-{timestamp}-{i+1}",
                "Traditional": pc.traditional,
                "Simplified": pc.simplified,
                "Pinyin": pc.pinyin,
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
        if note_id is not None:
            card_ids = anki_request("findCards", {"query": f"nid:{note_id}"}) or []
            if card_ids:
                for chunk in chunked(card_ids, 200):
                    cards_info = anki_request("cardsInfo", {"cards": chunk}) or []
                    suspended_cards = [
                        c.get("card") for c in cards_info if c.get("queue", 0) < 0
                    ]
                    if suspended_cards:
                        anki_request("unsuspend", {"cards": suspended_cards})

    print("Done.")


if __name__ == "__main__":
    main()

