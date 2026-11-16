#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "google.cloud.texttospeech",
#   "dragonmapper",
# ]
# ///
"""
Regenerate the Sentence Audio of the TOCFL card currently shown in Anki's reviewer, in a different voice.

Unless --voice names one, the new voice is picked at random from the same voices
fill_audio_anki.py picks from, leaving out the voice that spoke the current audio.
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fill_audio_anki import (
    _GEMINI_VOICES,
    _RANDOM_VOICES,
    _TW_VOICES,
    _WAVENET_VOICES,
    get_clean_field_value,
    process_sentence_audio,
    voice_of_audio_field,
)

from shared.anki_utils import anki_connect_request, cards_to_notes, get_field_value, get_note_info
from shared.google_credentials import setup_google_credentials

_NOTE_TYPE = "TOCFL"


def current_note_id() -> int:
    """
    Return the note id of the card shown in Anki's reviewer.

    Raises:
        RuntimeError: If no card is being reviewed, or it is not a TOCFL card
    """
    card = anki_connect_request("guiCurrentCard")["result"]
    if not card:
        raise RuntimeError("No card is being reviewed in Anki - open the reviewer on a TOCFL card first")
    if card["modelName"] != _NOTE_TYPE:
        raise RuntimeError(f"The current card is a {card['modelName']} card, not {_NOTE_TYPE}")
    return cards_to_notes([card["cardId"]])[0]


def pick_other_voice(current_voice: str | None, speaking_rate: float) -> str:
    """Pick a voice other than current_voice at random, from the same voices as fill_audio_anki.pick_voice."""
    voices = _WAVENET_VOICES if speaking_rate != 1.0 else _RANDOM_VOICES
    return random.choice([voice for voice in voices if voice != current_voice])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--voice",
        choices=_TW_VOICES,
        default=None,
        help="Voice to use. Default: a random one other than the voice of the current audio.",
    )
    parser.add_argument("--speaking-rate", type=float, default=1.0, help="Speaking rate (0.25 to 4.0), Wavenet voices only")
    args = parser.parse_args()

    if args.voice in _GEMINI_VOICES and args.speaking_rate != 1.0:
        parser.error(f"{args.voice} does not support a speaking rate")

    note_id = current_note_id()
    note_info = get_note_info(note_id)
    sentence = get_clean_field_value(note_info, "Sentence Traditional")
    if not sentence:
        raise RuntimeError(f"Note {note_id} ({get_field_value(note_info, 'Traditional')}) has no Sentence Traditional")

    current_audio = get_field_value(note_info, "Sentence Audio")
    current_voice = voice_of_audio_field(current_audio)
    voice = args.voice or pick_other_voice(current_voice, args.speaking_rate)
    print(f"Note {note_id}: {get_field_value(note_info, 'Traditional')} - {sentence}")
    print(f"Current Sentence Audio: {current_audio or '(empty)'} (voice: {current_voice or 'unknown'})")
    print(f"New voice: {voice}")

    setup_google_credentials()
    if not process_sentence_audio(note_id, note_info, voice_name=voice, speaking_rate=args.speaking_rate):
        raise RuntimeError(f"Failed to regenerate Sentence Audio for note {note_id}")


if __name__ == "__main__":
    main()
