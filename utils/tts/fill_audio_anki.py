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
import re
import sys
from pathlib import Path
from typing import Any, cast

import dragonmapper.transcriptions
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
from shared.google_credentials import setup_google_credentials

# Define maximum lengths for filename components to keep them reasonable
_MAX_TEXT_FILENAME_LEN = 50
_MAX_PINYIN_FILENAME_LEN = 50

# Wavenet rather than Standard: the Standard voices do not compress the first
# falling tone in a tone4+tone4 pair, so they fully realize both falls and reset
# the pitch in between. In 請把錢放進錢包裡 that puts a +5.4 semitone jump between
# 放 and 進, which is heard as a break mid-word. Wavenet-C keeps the same reset
# down to +1.4 semitones. cmn-TW only offers Standard and Wavenet - the Chirp3-HD
# and Neural2 voices are cmn-CN (Mainland) only.
_DEFAULT_VOICE = "cmn-TW-Wavenet-C"


def clean_text_for_filename(text: str, max_len: int = _MAX_TEXT_FILENAME_LEN) -> str:
    """Clean a text snippet so it is safe to use inside an audio filename."""
    clean_text = text.replace("?", "").replace("*", "")
    if len(clean_text) > max_len:
        clean_text = clean_text[:max_len]
    return clean_text


def clean_sentence_for_filename(sentence: str, max_len: int = _MAX_TEXT_FILENAME_LEN) -> str:
    """Clean a sentence for filenames by keeping only word characters (CJK, letters, digits, underscores)."""
    clean_text = re.sub(r"[^\w]", "", sentence)
    if len(clean_text) > max_len:
        clean_text = clean_text[:max_len]
    return clean_text


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


def chinese_tts(
    text: str,
    output_file: str = "output.mp3",
    voice_name: str = _DEFAULT_VOICE,
    pinyin_hint: str | None = None,
    speaking_rate: float = 1.0,
) -> bytes:
    """
    Convert text to speech using Chinese Mandarin voice (Taiwanese or Mainland)

    Args:
        text (str): Text to convert (Chinese characters)
        output_file (str): Output audio file path (will be saved in script directory)
        voice_name (str): Voice to use - supports both cmn-TW-* (Taiwanese) and cmn-CN-* (Mainland) voices
        pinyin_hint (str): Optional pinyin pronunciation hint
        speaking_rate (float): Speed of speech (0.25 to 4.0, default 1.0). Slower rates may improve clarity.
    """
    # Get script directory and ensure output file is saved there
    script_dir = Path(__file__).resolve().parent
    output_path = script_dir / Path(output_file).name

    # Initialize the client
    client: Any = texttospeech.TextToSpeechClient()

    # Set the text input - use SSML if pinyin hint provided
    synthesis_input: Any
    if pinyin_hint:
        # Convert pinyin to numbered format
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
        syllables = numbered_pinyin.split()

        # Remove non-Chinese characters from text for alignment
        chinese_chars = [char for char in text if "\u4e00" <= char <= "\u9fff"]

        # Build SSML with individual phoneme tags per character
        if len(syllables) == len(chinese_chars):
            ssml_parts = ["<speak>"]
            char_idx = 0
            for char in text:
                if "\u4e00" <= char <= "\u9fff":
                    # This is a Chinese character, wrap with phoneme tag
                    ssml_parts.append(f'<phoneme alphabet="pinyin" ph="{syllables[char_idx]}">{char}</phoneme>')
                    char_idx += 1
                else:
                    # Non-Chinese character, add as-is
                    ssml_parts.append(char)
            ssml_parts.append("</speak>")
            ssml_text = "".join(ssml_parts)
        else:
            # Fallback to old method if syllable count doesn't match
            print(
                f"Warning: Syllable count ({len(syllables)}) doesn't match character count ({len(chinese_chars)}). Using fallback method."
            )
            ssml_text = f'<speak><phoneme alphabet="pinyin" ph="{numbered_pinyin}">{text}</phoneme></speak>'

        synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
        print(f"Original pinyin: {pinyin_hint}")
        print(f"Converted to numbered: {numbered_pinyin}")
        print(f"SSML: {ssml_text}")
    else:
        synthesis_input = texttospeech.SynthesisInput(text=text)

    # Determine language code from voice name (cmn-TW-* or cmn-CN-*)
    language_code = "cmn-CN" if voice_name.startswith("cmn-CN") else "cmn-TW"

    # Build the voice request. No ssml_gender: it is only a hint used to pick a
    # voice when none is named, and naming one (as we always do) makes the API
    # ignore it. Setting it here just invited the reader to believe the default
    # cmn-TW-Wavenet-C was female.
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

    # Perform the text-to-speech request
    response: Any = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)

    # Write the response to an audio file
    with output_path.open("wb") as out:
        out.write(response.audio_content)
        print(f'Audio generated: "{output_path}"')

    audio_content: bytes = response.audio_content
    return audio_content


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
    voice_name: str = _DEFAULT_VOICE,
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

    # Generate audio filename
    clean_text = clean_text_for_filename(target_text)

    if pinyin_hint:
        # Convert pinyin to numbered format and clean for filename
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
        clean_pinyin = numbered_pinyin.replace(" ", "_").replace(":", "").replace("*", "").replace("?", "")
        # Truncate clean_pinyin
        if len(clean_pinyin) > _MAX_PINYIN_FILENAME_LEN:
            clean_pinyin = clean_pinyin[:_MAX_PINYIN_FILENAME_LEN]
        audio_filename = f"emir_tts_{clean_text}_{clean_pinyin}_{note_id}.mp3"
    else:
        audio_filename = f"emir_tts_{clean_text}_{note_id}.mp3"

    # Generate TTS audio
    if pinyin_hint:
        print(f"Generating TTS audio for: {target_text} with pinyin hint: {pinyin_hint}")
    else:
        print(f"Generating TTS audio for: {target_text}")
    audio_data = chinese_tts(
        target_text, output_file=audio_filename, voice_name=voice_name, pinyin_hint=pinyin_hint, speaking_rate=speaking_rate
    )

    # Store audio file in Anki media collection and update the note's Audio field
    store_media_file(audio_filename, audio_data)
    update_note_audio_field(note_id, audio_filename)
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
    voice_name: str = _DEFAULT_VOICE,
    speaking_rate: float = 1.0,
) -> bool:
    """
    Generate and store TTS audio for a note's Sentence Traditional field,
    updating the Sentence Audio field.

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

    clean_text = clean_sentence_for_filename(sentence)
    audio_filename = f"emir_tts_sentence_{clean_text}_{note_id}.mp3"

    print(f"Generating sentence TTS audio for: {sentence}")
    audio_data = chinese_tts(
        sentence,
        output_file=audio_filename,
        voice_name=voice_name,
        pinyin_hint=None,
        speaking_rate=speaking_rate,
    )

    store_media_file(audio_filename, audio_data)
    update_note_audio_field(note_id, audio_filename, field_name="Sentence Audio")
    print("Successfully updated note with new sentence audio!")
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


def process_note_audio(
    note_id: int,
    note_info: AnkiNoteInfo,
    note_type: str,
    use_pinyin_hint: bool,
    voice_name: str = _DEFAULT_VOICE,
    speaking_rate: float = 1.0,
) -> bool:
    """
    Process audio for a single note.

    Args:
        note_id: The note ID
        note_info: Note information from get_note_info
        note_type: The note type (e.g., "TOCFL", "Hanzi")
        use_pinyin_hint: Whether to use pinyin hints from notes
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

    # Get pinyin from note if available and flag is set
    pinyin_hint = None
    if use_pinyin_hint:
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
    use_pinyin_hint: bool,
    voice_name: str = _DEFAULT_VOICE,
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
    rebuilt = process_note_audio(note_id, note_info, note_type, use_pinyin_hint, voice_name=voice_name, speaking_rate=speaking_rate)

    # Note types without a sentence (e.g. Hanzi) yield an empty value here and are skipped.
    if get_clean_field_value(note_info, "Sentence Traditional"):
        rebuilt = process_sentence_audio(note_id, note_info, voice_name=voice_name, speaking_rate=speaking_rate) and rebuilt

    return rebuilt


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TTS audio for Anki notes")
    parser.add_argument("--use-pinyin-hint", action="store_true", help="Use Pinyin field from notes as pronunciation hints")
    parser.add_argument(
        "--voice",
        type=str,
        default=_DEFAULT_VOICE,
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
        ],
        help="Voice to use for TTS. TW=Taiwanese, CN=Mainland. Wavenet voices are higher quality.",
    )
    parser.add_argument(
        "--speaking-rate",
        type=float,
        default=1.0,
        help="Speaking rate (0.25 to 4.0). Slower rates (e.g., 0.85) may improve consonant clarity",
    )
    args = parser.parse_args()

    print(f"Using voice: {args.voice}, speaking rate: {args.speaking_rate}")

    # Setup Google Cloud credentials
    setup_google_credentials()

    for note_type in ["TOCFL", "Hanzi"]:
        # First, process notes tagged for audio rebuild
        for note_id in find_notes_by_tag(note_type, _REBUILD_AUDIO_TAG):
            note_info = get_note_info(note_id)
            print(f"Rebuilding audio for note {note_id} (tagged with {_REBUILD_AUDIO_TAG})")
            if rebuild_note_audio(
                note_id, note_info, note_type, args.use_pinyin_hint, voice_name=args.voice, speaking_rate=args.speaking_rate
            ):
                # Remove the rebuild tag after successful audio generation
                remove_tag_from_note(note_id, _REBUILD_AUDIO_TAG)

        # Then, process notes with empty audio
        for note_id in find_note_by_empty_audio(note_type)[0:100]:
            note_info = get_note_info(note_id)
            process_note_audio(note_id, note_info, note_type, args.use_pinyin_hint, voice_name=args.voice, speaking_rate=args.speaking_rate)

    # Finally, fill empty Sentence Audio on TOCFL notes that have a sentence
    print("\n=== Filling Sentence Audio for TOCFL notes ===")
    for note_id in find_notes_with_empty_sentence_audio():
        note_info = get_note_info(note_id)
        process_sentence_audio(note_id, note_info, voice_name=args.voice, speaking_rate=args.speaking_rate)


if __name__ == "__main__":
    main()
