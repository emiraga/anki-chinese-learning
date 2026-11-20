#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "google.cloud.texttospeech",
#   "dragonmapper",
# ]
# ///

from __future__ import annotations

import argparse
import base64
import random
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, cast
from xml.sax.saxutils import escape as xml_escape

import dragonmapper.transcriptions
import requests
from google.cloud import texttospeech

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    AnkiNoteInfo,
    find_notes_by_query,
    get_field_value,
    get_note_info,
    remove_tags,
    store_media_file,
    update_note_audio_field,
)
from shared.gemini_utils import STRONG_GEMINI_MODEL, get_gemini_api_key
from shared.google_credentials import setup_google_credentials

# Anki limits media filenames to 120 bytes (UTF-8), and a CJK character takes 3
# bytes, so a long word or sentence plus pinyin used to go over it. Keep a
# margin below the limit.
_MAX_AUDIO_FILENAME_BYTES = 100

# Wavenet rather than Standard: the Standard voices do not compress the first
# falling tone in a tone4+tone4 pair, so they fully realize both falls and reset
# the pitch in between. In 請把錢放進錢包裡 that puts a +5.4 semitone jump between
# 放 and 進, which is heard as a break mid-word. Wavenet-C keeps the same reset
# down to +1.4 semitones. cmn-TW only offers Standard and Wavenet - the Chirp3-HD
# and Neural2 voices are cmn-CN (Mainland) only.
_WAVENET_VOICES = ("cmn-TW-Wavenet-A", "cmn-TW-Wavenet-B", "cmn-TW-Wavenet-C")

# Gemini TTS has no Taiwan voices as such; the accent comes from written director's
# notes sent ahead of the text. In a side-by-side listening test of the (since
# shut down) 2.5 preview models, Kore, Aoede and Charon were kept and Puck
# dropped. Puck was retried on gemini-3.8-flash-lite-tts and dropped again: it
# garbled the start of 2 of 29 sentences, where the other voices read all 33
# word for word. Gemini voices take no SSML and no speaking rate, so a pinned
# reading (pinyin hint, _PRONUNCIATION_OVERRIDES) is written into the text as
# pinyin in brackets, which _GEMINI_PINYIN_NOTE tells it to follow.
#
# The 3.8 models read a plain-text instruction aloud (and reject
# systemInstruction), which is why the notes and the transcript are in separate
# headed sections.
#
# Models are tried in order, each up to its number of attempts. The flagship
# sounds the most natural but ad-libs even when told not to - in a test of 18
# sentence/voice pairs it added 欸/呢/嗯 three times and once swapped 只好 for 就要 -
# so each clip is transcribed back (gemini_transcribe) and a clip that does not
# say the text is thrown away. Flash-lite read all 18 word for word, so it is the
# fallback.
_GEMINI_TTS_MODELS = (("gemini-3.8-flash-tts", 2), ("gemini-3.8-flash-lite-tts", 2))
# The model that transcribes a clip to check it, see gemini_transcribe.
_GEMINI_CHECK_MODEL = STRONG_GEMINI_MODEL
_GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_GEMINI_VOICE_PREFIX = "gemini-"
_GEMINI_VOICES = tuple(f"{_GEMINI_VOICE_PREFIX}{speaker}" for speaker in ("Kore", "Aoede", "Charon"))
_GEMINI_DIRECTOR_NOTES = (
    "## DIRECTOR'S NOTES\n"
    "Voice: a native speaker from Taiwan, speaking Taiwanese Mandarin (國語) with a natural Taiwanese accent and"
    " intonation, not Mainland Putonghua. Pace: normal.\n"
    "Script: read the transcript exactly as written, word for word. Do not add, drop or change any word, and do"
    " not add interjections or sentence-final particles."
)
_GEMINI_PINYIN_NOTE = (
    "Pronunciation: pinyin in parentheses gives the correct reading of the characters right before it."
    " Pronounce those characters that way; never read the parentheses or the pinyin aloud."
)

# The Taiwanese voices this script uses, i.e. the ones a generated filename can name.
_TW_VOICES = _WAVENET_VOICES + _GEMINI_VOICES

# Unless --voice names one, each audio file gets a voice picked at random from
# these, so that cards are not all heard in the same voice. Only the Gemini
# voices: they sound more natural than Wavenet, which is kept for a speaking
# rate other than 1.0 and as the fallback when Gemini returns no audio.
_RANDOM_VOICES = _GEMINI_VOICES

# Words the voice misreads when it is given plain text, most often in sentences,
# which have no pinyin field to pass as a hint. Each entry has one numbered pinyin
# per character; None leaves that character to the voice's own reading.
_PRONUNCIATION_OVERRIDES: dict[str, tuple[str | None, ...]] = {
    # The voice reads 了 as le, but as a potential complement it is liǎo.
    "受得了": (None, None, "liao3"),
    # 都會 meaning "metropolis" is dūhuì, but the voice reads it as dōu huì
    # ("all will"). Keyed on 都會生活 because bare 都會 is usually dōu huì.
    "都會生活": ("du1", "hui4", None, None),
    # 還 meaning "to return (something)" is huán, but the voice reads it as hái
    # ("still"), e.g. in 我要還書. Keyed on 還書 because bare 還 is usually hái.
    "還書": ("huan2", None),
    # The voice reads 個 as de in sentences such as 這是一個很大的負擔. Keyed on
    # 個 alone so that 這個, 那個, 幾個 etc. are covered too; Taiwan reads it gè.
    "個": ("ge4",),
    # Taiwan reads 酪 as luò (酪梨, 乳酪, 奶酪), but the voice uses the Mainland
    # reading lào. Keyed on 酪 alone: it has no other reading in Taiwan.
    "酪": ("luo4",),
}


def short_voice_name(voice_name: str) -> str:
    """
    Shorten a voice name for use in a filename.

    cmn-TW-Wavenet-A -> TWWA, cmn-CN-Standard-D -> CNSD, gemini-Kore -> Kore.
    """
    if voice_name.startswith(_GEMINI_VOICE_PREFIX):
        return voice_name.removeprefix(_GEMINI_VOICE_PREFIX)
    _, region, kind, letter = voice_name.split("-")
    return f"{region}{kind[0]}{letter}"


def voice_of_audio_field(field_value: str) -> str | None:
    """
    Tell which of _TW_VOICES spoke the [sound:] file in an audio field, from its build_audio_filename name.

    Returns:
        str | None: The voice name, or None if the field has no file named by one of _TW_VOICES.
    """
    match = re.search(r"\[sound:[^\]]*_([^_\]]+)_\d+\.mp3\]", field_value, re.IGNORECASE)
    if not match:
        return None
    short_name = match.group(1).lower()
    return next((voice for voice in _TW_VOICES if short_voice_name(voice).lower() == short_name), None)


def build_audio_filename(text: str, voice_name: str, note_id: int) -> str:
    """
    Name an audio file emir_tts_<text>_<voice>_<note id>.mp3, within _MAX_AUDIO_FILENAME_BYTES.

    The text keeps only word characters (CJK, letters, digits, underscores) and
    is cut short to fit the byte limit; the note id keeps the name unique.

    All lowercase, because AnkiConnect's storeMediaFile lowercases the name it
    writes. A [sound:] tag in any other case still plays on macOS and Windows,
    whose filesystems ignore case, but AnkiDroid reports the file as missing.
    """
    suffix = f"_{short_voice_name(voice_name)}_{note_id}.mp3"
    prefix = "emir_tts_"
    budget = _MAX_AUDIO_FILENAME_BYTES - len(prefix.encode()) - len(suffix.encode())
    clean_text = re.sub(r"[^\w]", "", text)
    while len(clean_text.encode()) > budget:
        clean_text = clean_text[:-1]
    return f"{prefix}{clean_text}{suffix}".lower()


# Generate API key via https://console.cloud.google.com/apis/credentials


def convert_pinyin_to_numbered(pinyin_text: str) -> str:
    """
    Convert pinyin with tone marks to space-separated numbered format.
    Handles both accented and numbered pinyin as input.

    Args:
        pinyin_text (str): Pinyin with tone marks (e.g., "děi yào") or numbered ("xiao3xue2")

    Returns:
        str: Pinyin with numbers and spaces (e.g., "dei3 yao4", "xiao3 xue2")
    """
    # If there are no numbers, assume it's accented and convert.
    numbered: str
    if not any(char.isdigit() for char in pinyin_text):
        numbered = cast("str", dragonmapper.transcriptions.accented_to_numbered(pinyin_text))
    else:
        # It's already numbered, just use it as is.
        numbered = pinyin_text

    # Add spaces between syllables if they are not there.
    # This regex finds a number followed by a letter and inserts a space.
    return re.sub(r"(\d)([a-zA-Z])", r"\1 \2", numbered)


# A span of text and the numbered pinyin it must be read with, or None to leave
# the span to the voice's own reading.
Reading = tuple[str, str | None]


def _is_hanzi(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff"


def pinyin_hint_readings(text: str, pinyin_hint: str) -> list[Reading]:
    """Pin every character of text to its syllable from pinyin_hint."""
    # Convert pinyin to numbered format
    numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
    syllables = numbered_pinyin.split()
    print(f"Original pinyin: {pinyin_hint}")
    print(f"Converted to numbered: {numbered_pinyin}")

    hanzi_count = sum(map(_is_hanzi, text))
    if len(syllables) != hanzi_count:
        # Pin the whole text to the whole pinyin if they cannot be aligned
        print(f"Warning: Syllable count ({len(syllables)}) doesn't match character count ({hanzi_count}). Using fallback method.")
        return [(text, numbered_pinyin)]

    remaining = iter(syllables)
    return [(char, next(remaining) if _is_hanzi(char) else None) for char in text]


def pronunciation_override_readings(text: str) -> list[Reading] | None:
    """
    Pin the reading of every _PRONUNCIATION_OVERRIDES word in text.

    Returns:
        list[Reading] | None: The readings, or None if text contains no override word.
    """
    # Longest first, so a longer override wins over one it contains.
    words = sorted(_PRONUNCIATION_OVERRIDES, key=len, reverse=True)
    pattern = re.compile("|".join(map(re.escape, words)))
    if not pattern.search(text):
        return None

    readings: list[Reading] = []
    pos = 0
    for match in pattern.finditer(text):
        readings.append((text[pos : match.start()], None))
        readings.extend(zip(match.group(), _PRONUNCIATION_OVERRIDES[match.group()], strict=True))
        pos = match.end()
    readings.append((text[pos:], None))
    return [reading for reading in readings if reading[0]]


def readings_to_ssml(readings: list[Reading]) -> str:
    """Render readings as SSML, with a phoneme tag on every pinned span."""
    parts = (
        f'<phoneme alphabet="pinyin" ph="{pinyin}">{xml_escape(span)}</phoneme>' if pinyin else xml_escape(span)
        for span, pinyin in readings
    )
    return f"<speak>{''.join(parts)}</speak>"


def readings_to_annotated_text(readings: list[Reading]) -> str:
    """
    Render readings as text with the pinyin of each pinned run in brackets after it.

    Consecutive pinned spans are merged so that a word keeps together, e.g.
    臺北市(tái běi shì) rather than 臺(tái)北(běi)市(shì). Tone marks rather than
    tone numbers, as that is how pinyin is normally written.
    """
    annotated: list[str] = []
    run_text: list[str] = []
    run_pinyin: list[str] = []
    for span, pinyin in [*readings, ("", None)]:
        if pinyin:
            run_text.append(span)
            run_pinyin.append(pinyin)
            continue
        if run_text:
            accented = cast(
                "str", dragonmapper.transcriptions.numbered_to_accented(" ".join(run_pinyin).replace("u:", "ü").replace("v", "ü"))
            )
            annotated.append(f"{''.join(run_text)}({accented})")
            run_text.clear()
            run_pinyin.clear()
        annotated.append(span)
    return "".join(annotated)


def gemini_transcript(text: str, readings: list[Reading] | None) -> str:
    """The transcript section of the Gemini TTS prompt: text, annotated with its readings if any."""
    return text if readings is None else readings_to_annotated_text(readings)


def build_gemini_prompt(text: str, readings: list[Reading] | None) -> str:
    """Build the Gemini TTS prompt: the director's notes, then the gemini_transcript."""
    notes = _GEMINI_DIRECTOR_NOTES if readings is None else f"{_GEMINI_DIRECTOR_NOTES}\n{_GEMINI_PINYIN_NOTE}"
    return f"{notes}\n\n## TRANSCRIPT\n{gemini_transcript(text, readings)}"


def pick_voice(speaking_rate: float) -> str:
    """
    Pick a voice at random from _RANDOM_VOICES.

    For a speaking rate other than 1.0, which the Gemini voices do not support,
    a Wavenet voice is picked instead.
    """
    if speaking_rate != 1.0:
        return random.choice(_WAVENET_VOICES)
    return random.choice(_RANDOM_VOICES)


class GeminiTTSFailedError(RuntimeError):
    """No Gemini TTS model gave a clip that says the text: each attempt had no audio or failed says_text."""


def gemini_generate_content(model: str, body: dict[str, Any]) -> dict[str, Any]:
    """POST a generateContent request to the Gemini API and return the first part of the first candidate ({} if none)."""
    response = requests.post(
        _GEMINI_API_URL.format(model=model),
        headers={"x-goog-api-key": get_gemini_api_key()},
        json=body,
        timeout=180,
    )
    response.raise_for_status()
    candidates = response.json().get("candidates") or [{}]
    parts = candidates[0].get("content", {}).get("parts") or [{}]
    first_part: dict[str, Any] = parts[0]
    return first_part


def gemini_synthesize(model: str, prompt: str, speaker: str) -> bytes | None:
    """
    Synthesize a prompt from build_gemini_prompt with one Gemini TTS model and speaker, and return it as MP3.

    Returns:
        bytes | None: The MP3, or None if the model answered with no audio, which
            the TTS models now and then do (finishReason OTHER).
    """
    part = gemini_generate_content(
        model,
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": speaker}}},
            },
        },
    )
    inline_data = part.get("inlineData")
    if not inline_data:
        return None
    return gemini_audio_to_mp3(base64.b64decode(inline_data["data"]), inline_data["mimeType"])


def hanzi_only(text: str) -> str:
    """Keep only the CJK characters of text, dropping punctuation, spaces and pinyin."""
    return re.sub(r"[^\u3400-\u9fff\uf900-\ufaff]", "", text)


# Fillers the flagship TTS model likes to add, which only colour the tone of a
# sentence and so are allowed in a clip although the text does not have them.
# Not allowed, as they change the meaning: 嗎 (makes a yes/no question), 吧
# (suggestion or guess), 了/囉 (change of state), 呢 (question or ongoing), 嘛
# (obviousness, pushback), 的 (assertion, structure). 啦 is allowed although it
# can be 了+啊, since in Taiwan it is mostly a softener. 欸/誒/耶 are the same
# Taiwanese softener as the transcriber variously writes it.
_ALLOWED_TRAILING_FILLERS = frozenset("啊呀哇啦喔哦噢欸誒耶嗯")
_MAX_TRAILING_FILLERS = 2
# Hesitation sounds before the sentence.
_ALLOWED_LEADING_FILLERS = frozenset("嗯欸誒")
_MAX_LEADING_FILLERS = 1


def says_text(transcript: str, text: str) -> bool:
    """
    Tell whether a transcript of a clip says text, allowing for added fillers.

    Compares only the Hanzi. The transcript may add up to _MAX_LEADING_FILLERS of
    _ALLOWED_LEADING_FILLERS before text and up to _MAX_TRAILING_FILLERS of
    _ALLOWED_TRAILING_FILLERS after it, but text itself must be said in full and
    unchanged, so a dropped particle of text still fails.
    """
    heard, expected = hanzi_only(transcript), hanzi_only(text)
    for start in range(_MAX_LEADING_FILLERS + 1):
        leading, trailing = heard[:start], heard[start + len(expected) :]
        if (
            heard[start:].startswith(expected)
            and set(leading) <= _ALLOWED_LEADING_FILLERS
            and len(trailing) <= _MAX_TRAILING_FILLERS
            and set(trailing) <= _ALLOWED_TRAILING_FILLERS
        ):
            return True
    return False


def gemini_transcribe(mp3: bytes, text: str) -> str:
    """
    Transcribe a clip with _GEMINI_CHECK_MODEL, to check with says_text that it says text.

    The transcriber is given text as a reference so that it writes homophones and
    variant forms (他/她, 台/臺, 裡/裏) the way text does; it is told to write what
    is actually said, so added particles and changed words still show.
    """
    part = gemini_generate_content(
        _GEMINI_CHECK_MODEL,
        {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Transcribe this Mandarin audio in Traditional Chinese characters. The speaker was asked to"
                                f" read: {text}\nWrite exactly what is actually said, including any added, missing or"
                                " changed words, interjections and sentence-final particles. Where a word is said as in"
                                " the reference, write it with the same characters as the reference. Output only the"
                                " transcript."
                            )
                        },
                        {"inlineData": {"mimeType": "audio/mp3", "data": base64.b64encode(mp3).decode()}},
                    ]
                }
            ]
        },
    )
    return str(part.get("text", "")).strip()


def gemini_tts(text: str, readings: list[Reading] | None, voice_name: str) -> bytes:
    """
    Synthesize text with a Gemini TTS voice and return MP3, trying _GEMINI_TTS_MODELS in order.

    Each clip is transcribed back (gemini_transcribe) and kept only if it says
    text (says_text), and every attempt is logged with what was heard; an
    attempt with no audio or a failed check moves on to the next attempt. Some
    prompts get no audio on every attempt - with the 2.5 preview models, the
    repeated character of a multi-pronunciation Hanzi note (得, 得, 得 pinned to
    dé, de, děi) mostly did, for all three voices.

    Raises:
        GeminiTTSFailedError: If no attempt of any model gave a clip that passed the check
    """
    speaker = voice_name.removeprefix(_GEMINI_VOICE_PREFIX)
    prompt = build_gemini_prompt(text, readings)
    print(f"Gemini TTS target: {gemini_transcript(text, readings)}")
    for model, attempts in _GEMINI_TTS_MODELS:
        for attempt in range(1, attempts + 1):
            label = f"  {model} #{attempt}"
            mp3 = gemini_synthesize(model, prompt, speaker)
            if mp3 is None:
                print(f"{label}: no audio -> retry")
                continue
            heard = gemini_transcribe(mp3, text)
            if not says_text(heard, text):
                print(f"{label} heard: {heard}  -> rejected")
                continue
            exact = hanzi_only(heard) == hanzi_only(text)
            print(f"{label} heard: {heard}  -> accepted{'' if exact else ' (allowed fillers)'}")
            return mp3

    raise GeminiTTSFailedError(f"No Gemini TTS model in {_GEMINI_TTS_MODELS} gave a clip that says {text!r}")


def gemini_audio_to_mp3(audio: bytes, mime_type: str) -> bytes:
    """
    Encode the audio Gemini TTS returns as MP3.

    The 3.8 TTS models return a WAV file (audio/wav); the older preview models
    returned raw 16-bit mono PCM (e.g. audio/L16;codec=pcm;rate=24000).

    Raises:
        ValueError: If the audio is in neither format
    """
    if mime_type == "audio/wav":
        input_format = ["-f", "wav"]
    else:
        rate_match = re.search(r"rate=(\d+)", mime_type)
        if not mime_type.startswith("audio/L16") or not rate_match:
            raise ValueError(f"Unexpected Gemini TTS audio format: {mime_type}")
        input_format = ["-f", "s16le", "-ar", rate_match.group(1), "-ac", "1"]
    result = subprocess.run(
        ["ffmpeg", "-loglevel", "error", *input_format, "-i", "-", "-f", "mp3", "-"],
        input=audio,
        capture_output=True,
        check=True,
    )
    return result.stdout


def cloud_tts(text: str, readings: list[Reading] | None, voice_name: str, speaking_rate: float) -> bytes:
    """Synthesize with a Google Cloud TTS voice (cmn-TW-* or cmn-CN-*) and return MP3, as SSML if readings are pinned."""
    client: Any = texttospeech.TextToSpeechClient()
    synthesis_input: Any
    if readings is not None:
        ssml_text = readings_to_ssml(readings)
        print(f"SSML: {ssml_text}")
        synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
    else:
        synthesis_input = texttospeech.SynthesisInput(text=text)

    # Determine language code from voice name (cmn-TW-* or cmn-CN-*)
    language_code = "cmn-CN" if voice_name.startswith("cmn-CN") else "cmn-TW"

    # Build the voice request. No ssml_gender: it is only a hint used to pick a
    # voice when none is named, and naming one (as we always do) makes the API
    # ignore it.
    voice: Any = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name,
    )

    # Select the type of audio file
    audio_config: Any = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,  # Speed (0.25 to 4.0)
        pitch=0.0,  # Pitch (-20.0 to 20.0)
        volume_gain_db=0.0,  # Volume (-96.0 to 16.0)
    )

    response: Any = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
    audio_content: bytes = response.audio_content
    return audio_content


def chinese_tts(
    text: str,
    voice_name: str | None = None,
    pinyin_hint: str | None = None,
    speaking_rate: float = 1.0,
) -> tuple[bytes, str]:
    """
    Convert text to speech using Chinese Mandarin voice (Taiwanese or Mainland)

    Args:
        text (str): Text to convert (Chinese characters)
        voice_name (str | None): Voice to use - cmn-TW-* (Taiwanese), cmn-CN-* (Mainland) or one of
            _GEMINI_VOICES. None picks one at random, see pick_voice.
        pinyin_hint (str): Optional pinyin pronunciation hint
        speaking_rate (float): Speed of speech (0.25 to 4.0, default 1.0). Slower rates may improve clarity.

    Returns:
        tuple[bytes, str]: The MP3 audio and the voice that actually spoke it, which
            differs from the picked one if a Gemini voice fell back to Wavenet.

    Raises:
        ValueError: If a Gemini voice is requested with a speaking rate other than 1.0
        GeminiTTSFailedError: If a Gemini voice named in voice_name gave no usable audio. A
            randomly picked one falls back to a Wavenet voice instead.
    """
    # Readings to pin: from the pinyin hint, else from any override word in the text
    readings = pinyin_hint_readings(text, pinyin_hint) if pinyin_hint else pronunciation_override_readings(text)

    voice_is_random = voice_name is None
    if voice_name is None:
        voice_name = pick_voice(speaking_rate)
    print(f"Voice: {voice_name}")

    audio_content: bytes | None = None
    if voice_name in _GEMINI_VOICES:
        if speaking_rate != 1.0:
            raise ValueError(f"{voice_name} does not support a speaking rate, got {speaking_rate}")
        try:
            audio_content = gemini_tts(text, readings, voice_name)
        except GeminiTTSFailedError:
            if not voice_is_random:
                raise
            voice_name = random.choice(_WAVENET_VOICES)
            print(f"Gemini gave no usable audio, falling back to {voice_name}")

    if audio_content is None:
        audio_content = cloud_tts(text, readings, voice_name=voice_name, speaking_rate=speaking_rate)

    return audio_content, voice_name


def save_audio(note_id: int, audio_filename: str, audio_data: bytes, field_name: str = "Audio") -> None:
    """Write a local copy of the audio to the script directory, store it in Anki's media and point the note's field at it."""
    output_path = Path(__file__).resolve().parent / audio_filename
    output_path.write_bytes(audio_data)
    print(f'Audio generated: "{output_path}"')

    # Reference the file by the name Anki stored it under, which can differ from audio_filename
    stored_filename = store_media_file(audio_filename, audio_data)
    update_note_audio_field(note_id, stored_filename, field_name=field_name)


def find_note_by_traditional(note_type: str, traditional_text: str) -> int | None:
    """
    Find note with specific Traditional field value

    Args:
        traditional_text (str): Text to search for in Traditional field

    Returns:
        int: Note ID if found, None otherwise
    """
    # Search for notes with the specific Traditional field value
    note_ids = find_notes_by_query(f'note:{note_type} Traditional:"{traditional_text}"')

    if note_ids:
        print(f"Found {len(note_ids)} note(s) with Traditional field '{traditional_text}'")
        return note_ids[0]  # Return the first matching note

    print(f"No notes found with Traditional field '{traditional_text}'")
    return None


def update_audio_on_a_note(note_type: str, target_text: str, pinyin_hint: str | None = None) -> None:
    """
    Main function to find note and update audio (legacy interface)
    """
    # Find the note
    note_id = find_note_by_traditional(note_type, target_text)
    if not note_id:
        return

    # Get note information
    note_info = get_note_info(note_id)
    if not note_info:
        return

    # Use the more efficient version
    update_audio_for_note(note_id, note_info, target_text, pinyin_hint)


def update_audio_for_note(
    note_id: int,
    note_info: AnkiNoteInfo,
    target_text: str,
    pinyin_hint: str | None = None,
    voice_name: str | None = None,
    speaking_rate: float = 1.0,
) -> None:
    """
    Update audio for a specific note using existing note info

    Args:
        note_id (int): The note ID
        note_info (dict): Existing note information from get_note_info
        target_text (str): Traditional Chinese text to generate audio for
        pinyin_hint (str): Optional pinyin pronunciation hint (e.g., "de2 dao4")
        voice_name (str): Voice to use for TTS
        speaking_rate (float): Speed of speech (0.25 to 4.0)
    """

    print(f"Found note: {note_info['fields'].get('Traditional', {}).get('value', 'N/A')}")

    # Generate TTS audio
    if pinyin_hint:
        print(f"Generating TTS audio for: {target_text} with pinyin hint: {pinyin_hint}")
    else:
        print(f"Generating TTS audio for: {target_text}")
    audio_data, used_voice = chinese_tts(target_text, voice_name=voice_name, pinyin_hint=pinyin_hint, speaking_rate=speaking_rate)

    # Generate audio filename, after synthesis so that it names the voice actually used
    save_audio(note_id, build_audio_filename(target_text, used_voice, note_id), audio_data)
    print("Successfully updated note with new audio!")


def find_note_by_empty_audio(note_type: str) -> list[int]:
    """Find unsuspended notes that have a Traditional field but no audio yet."""
    note_ids = find_notes_by_query(f"note:{note_type} Traditional:_* Audio: -is:suspended")

    if note_ids:
        print(f"Found {len(note_ids)} note(s) with empty audio")
    else:
        print("No notes found with empty audio")
    return note_ids


def find_notes_with_empty_sentence_audio() -> list[int]:
    """Find TOCFL notes where Sentence Traditional is filled but Sentence Audio is empty."""
    note_ids = find_notes_by_query('note:TOCFL "Sentence Traditional:_*" "Sentence Audio:"')

    if note_ids:
        print(f"Found {len(note_ids)} TOCFL note(s) with Sentence Traditional but empty Sentence Audio")
    else:
        print("No TOCFL notes found with empty sentence audio")
    return note_ids


def process_sentence_audio(
    note_id: int,
    note_info: AnkiNoteInfo,
    voice_name: str | None = None,
    speaking_rate: float = 1.0,
) -> bool:
    """
    Generate and store TTS audio for a note's Sentence Traditional field,
    updating the Sentence Audio field and removing _SENTENCE_OUTDATED_VOICE_TAG.

    Args:
        note_id: The note ID
        note_info: Note information from get_note_info
        voice_name: Voice to use for TTS
        speaking_rate: Speed of speech (0.25 to 4.0)

    Returns:
        bool: True if audio was generated, False otherwise
    """
    sentence = get_clean_field_value(note_info, "Sentence Traditional")
    if not sentence:
        print(f"No Sentence Traditional found for note {note_id}, skipping")
        return False

    print(f"Generating sentence TTS audio for: {sentence}")
    audio_data, used_voice = chinese_tts(sentence, voice_name=voice_name, pinyin_hint=None, speaking_rate=speaking_rate)

    save_audio(note_id, build_audio_filename(sentence, used_voice, note_id), audio_data, field_name="Sentence Audio")
    print("Successfully updated note with new sentence audio!")

    # The new audio is in a current voice, so the note no longer needs flagging
    if _SENTENCE_OUTDATED_VOICE_TAG in (tag.lower() for tag in note_info.get("tags", [])):
        remove_tag_from_note(note_id, _SENTENCE_OUTDATED_VOICE_TAG)
    return True


def find_notes_by_tag(note_type: str, tag: str) -> list[int]:
    """Find notes with a specific tag."""
    note_ids = find_notes_by_query(f'note:{note_type} tag:"{tag}" -is:suspended')

    if note_ids:
        print(f"Found {len(note_ids)} note(s) with tag '{tag}'")
    else:
        print(f"No notes found with tag '{tag}'")
    return note_ids


def remove_tag_from_note(note_id: int, tag: str) -> None:
    """Remove a tag from a note."""
    remove_tags([note_id], tag)
    print(f"Removed tag '{tag}' from note {note_id}")


def get_clean_field_value(note_info: AnkiNoteInfo, field_name: str) -> str:
    """Read a field, stripping the divs Anki wraps a multi-line field's value in."""
    return get_field_value(note_info, field_name).replace("<div>", "").replace("</div>", "").strip()


def build_multi_pronunciation_audio(note_info: AnkiNoteInfo, traditional: str) -> tuple[str | None, str | None]:
    """
    Build text and pinyin for notes with multiple pronunciations.

    Returns:
        tuple: (text_to_speak, combined_pinyin) or (None, None) if not applicable
    """
    pinyin_main = get_clean_field_value(note_info, "Pinyin")
    pinyin_others = get_clean_field_value(note_info, "Pinyin others")

    if not pinyin_main or not pinyin_others:
        return None, None

    # Combine all pinyins: "de2" + "de5, děi" -> ["de2", "de5", "děi"]
    all_pinyins = [pinyin_main]
    for p in pinyin_others.split(","):
        p = p.strip()
        if p:
            all_pinyins.append(p)

    # Create text with repeated character separated by Chinese commas for natural pauses
    repeated_text = "，".join([traditional] * len(all_pinyins))  # noqa: RUF001
    combined_pinyin = " ".join(all_pinyins)

    return repeated_text, combined_pinyin


_REBUILD_AUDIO_TAG = "chinese::rebuild-audio-field"
_MULTI_PRONUNCIATION_TAG = "chinese::multiple-pronounciation-character"
# Marks a note whose Sentence Audio is in a voice no longer used; process_sentence_audio removes it.
_SENTENCE_OUTDATED_VOICE_TAG = "chinese::sentence-outdated-tts-voice"


def process_note_audio(
    note_id: int,
    note_info: AnkiNoteInfo,
    note_type: str,
    voice_name: str | None = None,
    speaking_rate: float = 1.0,
) -> bool:
    """
    Process audio for a single note.

    Args:
        note_id: The note ID
        note_info: Note information from get_note_info
        note_type: The note type (e.g., "TOCFL", "Hanzi")
        voice_name: Voice to use for TTS
        speaking_rate: Speed of speech (0.25 to 4.0)

    Returns:
        bool: True if audio was generated, False otherwise
    """
    traditional = get_field_value(note_info, "Traditional")
    if len(traditional) == 0:
        print("No traditional found", note_info)
        return False

    tags = note_info.get("tags", [])

    # Check for Hanzi notes with multiple pronunciations
    if note_type == "Hanzi" and _MULTI_PRONUNCIATION_TAG in tags:
        repeated_text, combined_pinyin = build_multi_pronunciation_audio(note_info, traditional)
        if repeated_text and combined_pinyin:
            print(f"Multi-pronunciation character: {traditional}")
            print(f"  Text to speak: {repeated_text}")
            print(f"  Combined pinyin: {combined_pinyin}")
            update_audio_for_note(note_id, note_info, repeated_text, combined_pinyin, voice_name=voice_name, speaking_rate=speaking_rate)
            return True

    # Pin the reading to the note's Pinyin field, if it has one
    pinyin_hint = get_clean_field_value(note_info, "Pinyin")
    if pinyin_hint:
        print(f"Using Pinyin field from note: {pinyin_hint}")

    # Use the more efficient version that reuses note_info
    update_audio_for_note(note_id, note_info, traditional, pinyin_hint or None, voice_name=voice_name, speaking_rate=speaking_rate)
    return True


def rebuild_note_audio(
    note_id: int,
    note_info: AnkiNoteInfo,
    note_type: str,
    voice_name: str | None = None,
    speaking_rate: float = 1.0,
) -> bool:
    """
    Rebuild every audio field on a note tagged with _REBUILD_AUDIO_TAG.

    Always rebuilds the Audio field, and additionally rebuilds Sentence Audio
    when the note carries a sentence. Unlike the empty-field passes this
    overwrites existing audio, which is the point of the tag.

    Returns:
        bool: True only if every applicable field was regenerated, so that a
        partial rebuild keeps the tag and gets retried on the next run.
    """
    rebuilt = process_note_audio(note_id, note_info, note_type, voice_name=voice_name, speaking_rate=speaking_rate)

    # Note types without a sentence (e.g. Hanzi) yield an empty value here and are skipped.
    if get_clean_field_value(note_info, "Sentence Traditional"):
        rebuilt = process_sentence_audio(note_id, note_info, voice_name=voice_name, speaking_rate=speaking_rate) and rebuilt

    return rebuilt


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TTS audio for Anki notes")
    parser.add_argument(
        "--voice",
        type=str,
        default=None,
        choices=[
            # Taiwanese Mandarin voices
            "cmn-TW-Standard-A",
            "cmn-TW-Standard-B",
            "cmn-TW-Standard-C",
            "cmn-TW-Wavenet-A",
            "cmn-TW-Wavenet-B",
            "cmn-TW-Wavenet-C",
            # Mainland Mandarin voices
            "cmn-CN-Standard-A",
            "cmn-CN-Standard-B",
            "cmn-CN-Standard-C",
            "cmn-CN-Standard-D",
            "cmn-CN-Wavenet-A",
            "cmn-CN-Wavenet-B",
            "cmn-CN-Wavenet-C",
            "cmn-CN-Wavenet-D",
            # Gemini TTS voices, Taiwanese accent by style instruction
            *_GEMINI_VOICES,
        ],
        help=(
            "Voice to use for TTS. TW=Taiwanese, CN=Mainland. Wavenet voices are higher quality. "
            f"Default: a random pick per audio file from {', '.join(_RANDOM_VOICES)}; "
            "with a speaking rate other than 1.0 it picks from the Wavenet voices instead."
        ),
    )
    parser.add_argument(
        "--speaking-rate",
        type=float,
        default=1.0,
        help="Speaking rate (0.25 to 4.0). Slower rates (e.g., 0.85) may improve consonant clarity",
    )
    args = parser.parse_args()

    print(f"Using voice: {args.voice or 'random from ' + ', '.join(_RANDOM_VOICES)}, speaking rate: {args.speaking_rate}")

    # Setup Google Cloud credentials
    setup_google_credentials()

    for note_type in ["TOCFL", "Hanzi"]:
        # First, process notes tagged for audio rebuild
        for note_id in find_notes_by_tag(note_type, _REBUILD_AUDIO_TAG):
            note_info = get_note_info(note_id)
            print(f"Rebuilding audio for note {note_id} (tagged with {_REBUILD_AUDIO_TAG})")
            if rebuild_note_audio(note_id, note_info, note_type, voice_name=args.voice, speaking_rate=args.speaking_rate):
                # Remove the rebuild tag after successful audio generation
                remove_tag_from_note(note_id, _REBUILD_AUDIO_TAG)

        # Then, process notes with empty audio
        for note_id in find_note_by_empty_audio(note_type)[0:100]:
            note_info = get_note_info(note_id)
            process_note_audio(note_id, note_info, note_type, voice_name=args.voice, speaking_rate=args.speaking_rate)

    # Finally, fill empty Sentence Audio on TOCFL notes that have a sentence
    print("\n=== Filling Sentence Audio for TOCFL notes ===")
    for note_id in find_notes_with_empty_sentence_audio():
        note_info = get_note_info(note_id)
        process_sentence_audio(note_id, note_info, voice_name=args.voice, speaking_rate=args.speaking_rate)


if __name__ == "__main__":
    main()
