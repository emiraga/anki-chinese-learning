#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "chinese-english-lookup",
#   "pypinyin",
# ]
# ///

"""
Fill Pinyin and Meaning for TOCFL single-character notes in deck Chinese::SingleChars.
Run this before the TTS script so audio can use the Pinyin hint.

Usage: uv run utils/fill_single_chars_tocfl.py
       uv run utils/fill_single_chars_tocfl.py --dry-run
"""

import argparse
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from chinese_english_lookup import Dictionary
from pypinyin import pinyin as get_pinyin, Style

# Use 127.0.0.1 to avoid IPv6 (::1) if Anki only listens on IPv4
ANKI_URL = "http://127.0.0.1:8765"
SINGLECHARS_DECK = "Chinese::SingleChars"
NOTE_TYPE = "TOCFL"
ANKI_BATCH_SIZE = 50
ANKI_RETRIES = 5
ANKI_RETRY_BACKOFF = 3
BATCH_DELAY_SEC = 0.5


def _make_session():
    retry = Retry(
        total=ANKI_RETRIES,
        backoff_factor=ANKI_RETRY_BACKOFF,
        status_forcelist=(500, 502, 503),
        allowed_methods=["POST"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=1, pool_maxsize=1)
    s = requests.Session()
    s.mount("http://", adapter)
    return s


def anki_connect_request(action, params=None, session=None):
    if params is None:
        params = {}
    payload = {"action": action, "params": params, "version": 6}
    sess = session or _make_session()
    last_error = None
    for attempt in range(ANKI_RETRIES):
        try:
            resp = sess.post(ANKI_URL, json=payload, timeout=180)
            resp.raise_for_status()
            data = resp.json()
            if data.get("error"):
                raise RuntimeError(data["error"])
            return data.get("result")
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, requests.exceptions.ChunkedEncodingError) as e:
            last_error = e
            if attempt < ANKI_RETRIES - 1:
                delay = ANKI_RETRY_BACKOFF * (2 ** attempt)
                time.sleep(delay)
                continue
            raise RuntimeError(
                f"Could not reach Anki (AnkiConnect at {ANKI_URL}). "
                "Is Anki open with AnkiConnect installed? Try using 127.0.0.1 in AnkiConnect config."
            ) from last_error
    raise RuntimeError("AnkiConnect request failed") from last_error


def anki_ping(session):
    """Lightweight check that AnkiConnect is reachable."""
    anki_connect_request("deckNames", session=session)


def find_notes_to_fill(session):
    """Find TOCFL notes in SingleChars deck where Traditional is one char and Pinyin/Meaning need filling."""
    query = f'deck:"{SINGLECHARS_DECK}" note:{NOTE_TYPE}'
    note_ids = anki_connect_request("findNotes", {"query": query}, session=session)
    if not note_ids:
        return []
    infos = []
    for i in range(0, len(note_ids), ANKI_BATCH_SIZE):
        batch = note_ids[i : i + ANKI_BATCH_SIZE]
        infos.extend(anki_connect_request("notesInfo", {"notes": batch}, session=session))
        if i + ANKI_BATCH_SIZE < len(note_ids):
            time.sleep(BATCH_DELAY_SEC)
    to_fill = []
    for info in infos:
        trad = (info.get("fields") or {}).get("Traditional", {}).get("value", "").strip()
        pinyin_val = (info.get("fields") or {}).get("Pinyin", {}).get("value", "").strip()
        meaning_val = (info.get("fields") or {}).get("Meaning", {}).get("value", "").strip()
        if len(trad) != 1:
            continue
        needs_pinyin = not pinyin_val or pinyin_val == "?"
        needs_meaning = not meaning_val
        if needs_pinyin or needs_meaning:
            to_fill.append({
                "noteId": info["noteId"],
                "traditional": trad,
                "pinyin": pinyin_val,
                "meaning": meaning_val,
                "needs_pinyin": needs_pinyin,
                "needs_meaning": needs_meaning,
            })
    return to_fill


def get_pinyin_for_char(char: str) -> str:
    try:
        result = get_pinyin(char, style=Style.TONE)
        if result and len(result) > 0 and result[0]:
            return result[0][0]
    except Exception:
        pass
    return ""


def get_meaning_for_char(char: str, dictionary: Dictionary) -> str:
    try:
        entry = dictionary.lookup(char)
        if entry and entry.definition_entries:
            defs = entry.definition_entries[0].definitions[:3]
            return "; ".join(defs)
    except Exception:
        pass
    return ""


def update_note_fields(note_id: int, fields: dict, session=None) -> None:
    anki_connect_request("updateNoteFields", {
        "note": {"id": note_id, "fields": fields},
    }, session=session)


def main():
    parser = argparse.ArgumentParser(description="Fill Pinyin and Meaning for Chinese::SingleChars TOCFL notes")
    parser.add_argument("--dry-run", action="store_true", help="Only print what would be updated")
    args = parser.parse_args()

    session = _make_session()
    print("Checking AnkiConnect at", ANKI_URL, "...")
    anki_ping(session)
    print("Connected.\n")

    notes = find_notes_to_fill(session)
    if not notes:
        print("No SingleChars TOCFL notes need Pinyin/Meaning filling.")
        return

    print(f"Found {len(notes)} note(s) to fill in deck {SINGLECHARS_DECK}.")
    dictionary = Dictionary()

    for i, n in enumerate(notes):
        note_id = n["noteId"]
        char = n["traditional"]
        pinyin = n["pinyin"] if not n["needs_pinyin"] else get_pinyin_for_char(char)
        meaning = n["meaning"] if not n["needs_meaning"] else get_meaning_for_char(char, dictionary)

        if args.dry_run:
            print(f"  [dry-run] {char}  Pinyin: {pinyin or '(none)'}  Meaning: {meaning[:50] + '...' if len(meaning or '') > 50 else meaning or '(none)'}")
            continue

        fields = {}
        if n["needs_pinyin"] and pinyin:
            fields["Pinyin"] = pinyin
        if n["needs_meaning"] and meaning:
            fields["Meaning"] = meaning

        if fields:
            update_note_fields(note_id, fields, session=session)
            print(f"  [{i+1}/{len(notes)}] {char}  Pinyin: {pinyin or '-'}  Meaning: {(meaning[:40] + '...') if len(meaning or '') > 40 else (meaning or '-')}")

    if not args.dry_run:
        print("Done. Run TTS to add audio: utils/tts/fill_audio_anki.py --use-pinyin-hint --deck 'Chinese::SingleChars'")
    else:
        print("Dry run complete. Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
