#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "google-genai",
# ]
# ///

"""
Fill the "Sample Sentences" field for TOCFL notes in deck Chinese::SingleChars
with 3 short, simple sentences that use the character. Uses Google Gemini.

Usage:
  uv run utils/fill_single_chars_sample_sentences.py
  uv run utils/fill_single_chars_sample_sentences.py --limit 10 --dry-run

API key (pick one): GEMINI_API_KEY env, or gemini_api_key in utils/tts/gcloud_account.json, or utils/tts/gcloud_api_key.txt
"""

import argparse
import json
import os
import time
from pathlib import Path

import requests
from google import genai

ANKI_URL = "http://127.0.0.1:8765"
DECK = "Chinese::SingleChars"
NOTE_TYPE = "TOCFL"
SAMPLE_FIELD = "Sample Sentences"
ANKI_RETRIES = 3
ANKI_BACKOFF = 2
BATCH_DELAY = 0.3


def anki_request(action, params=None):
    if params is None:
        params = {}
    payload = {"action": action, "params": params, "version": 6}
    last_err = None
    for attempt in range(ANKI_RETRIES):
        try:
            r = requests.post(ANKI_URL, json=payload, timeout=120)
            r.raise_for_status()
            data = r.json()
            if data.get("error"):
                raise RuntimeError(data["error"])
            return data.get("result")
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            last_err = e
            if attempt < ANKI_RETRIES - 1:
                time.sleep(ANKI_BACKOFF * (2**attempt))
    raise RuntimeError(f"Cannot reach Anki at {ANKI_URL}") from last_err


def find_notes_missing_sample_sentences(limit=None):
    # Anki search doesn't handle "field name with space": for empty, so fetch deck and filter in code
    query = f'deck:"{DECK}" note:{NOTE_TYPE}'
    note_ids = anki_request("findNotes", {"query": query})
    if not note_ids:
        return []
    infos = get_notes_info(note_ids)
    need_fill = [
        n
        for n in infos
        if len((n.get("fields") or {}).get("Traditional", {}).get("value", "").strip()) == 1
        and not (n.get("fields") or {}).get(SAMPLE_FIELD, {}).get("value", "").strip()
    ]
    if limit is not None:
        need_fill = need_fill[:limit]
    return need_fill


def get_notes_info(note_ids):
    infos = []
    for i in range(0, len(note_ids), 50):
        chunk = note_ids[i : i + 50]
        infos.extend(anki_request("notesInfo", {"notes": chunk}))
        if i + 50 < len(note_ids):
            time.sleep(BATCH_DELAY)
    return infos


def update_note_field(note_id, field_name, value):
    anki_request("updateNoteFields", {"note": {"id": note_id, "fields": {field_name: value}}})


def _get_response_text(response) -> str:
    """Get generated text from Gemini response; handle different SDK shapes."""
    text = getattr(response, "text", None)
    if text and isinstance(text, str):
        return text.strip()
    # Fallback: candidates[0].content.parts[0].text
    try:
        candidates = getattr(response, "candidates", None) or []
        if candidates:
            part = candidates[0].content.parts[0]
            return (getattr(part, "text", None) or "").strip()
    except (IndexError, AttributeError, TypeError):
        pass
    return ""


def generate_three_sentences(char: str, client: genai.Client, verbose: bool = False) -> str:
    prompt = f"""Generate exactly 3 short, simple sentences in Traditional Chinese that each use the character "{char}".
Each sentence should be easy (beginner level), short (under 10 characters if possible), and natural.
Output format: one sentence per line. After each sentence add a space and the English translation in parentheses.
Example format:
你好嗎？ (How are you?)
我很好。 (I'm fine.)

Character: {char}
Sentences:"""
    models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"]
    last_err = None
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    max_output_tokens=256,
                    temperature=0.3,
                ),
            )
            text = _get_response_text(response)
            if verbose and text:
                print(f"    [verbose] model={model_name} raw (first 200 chars): {repr(text[:200])}")
            if not text:
                continue
            # Strip markdown code blocks if present
            if text.startswith("```"):
                lines = text.split("\n")
                lines = [ln for ln in lines if not ln.strip().startswith("```")][:3]
            else:
                lines = [ln.strip() for ln in text.split("\n") if ln.strip()][:3]
            html_parts = [f"<p>{ln}</p>" for ln in lines if ln]
            return "\n".join(html_parts) if html_parts else ""
        except Exception as e:
            last_err = e
            if verbose:
                print(f"    [verbose] model={model_name} failed: {e}")
            continue
    if last_err and verbose:
        print(f"    [verbose] all models failed; last: {last_err}")
    return ""


def main():
    ap = argparse.ArgumentParser(description="Fill Sample Sentences for Chinese::SingleChars using Gemini")
    ap.add_argument("--limit", type=int, default=None, help="Max notes to process")
    ap.add_argument("--dry-run", action="store_true", help="Only print, do not update")
    ap.add_argument("--verbose", "-v", action="store_true", help="Print first API response and errors")
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        tts_dir = Path(__file__).resolve().parent / "tts"
        gcloud_path = tts_dir / "gcloud_account.json"
        if gcloud_path.exists():
            try:
                creds = json.loads(gcloud_path.read_text())
                api_key = creds.get("gemini_api_key") or creds.get("GEMINI_API_KEY") or ""
            except Exception:
                api_key = ""
        if not api_key:
            key_path = tts_dir / "gcloud_api_key.txt"
            if key_path.exists():
                api_key = key_path.read_text().strip()
    if not api_key:
        raise SystemExit(
            "Set GEMINI_API_KEY env, or add 'gemini_api_key' to utils/tts/gcloud_account.json, or create utils/tts/gcloud_api_key.txt"
        )

    client = genai.Client(api_key=api_key)

    infos = find_notes_missing_sample_sentences(limit=args.limit)
    if not infos:
        print("No notes with empty Sample Sentences found.")
        return

    print(f"Found {len(infos)} note(s) to fill.")

    for i, info in enumerate(infos):
        trad = (info.get("fields") or {}).get("Traditional", {}).get("value", "").strip()
        if len(trad) != 1:
            continue
        note_id = info["noteId"]
        n_total = len(infos)
        if args.dry_run:
            print(f"  [dry-run] {trad} (note {note_id})")
            continue
        try:
            html = generate_three_sentences(trad, client, verbose=(args.verbose and i == 0))
            if html:
                update_note_field(note_id, SAMPLE_FIELD, html)
                print(f"  [{i+1}/{n_total}] {trad}")
            else:
                print(f"  [{i+1}/{n_total}] {trad} (no output from Gemini)")
        except Exception as e:
            print(f"  [{i+1}/{n_total}] {trad} error: {e}")
        time.sleep(0.2)

    print("Done.")


if __name__ == "__main__":
    main()
