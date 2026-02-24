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

import os
import requests
import base64
import argparse
import re
from typing import Any, TypedDict
from google.cloud import texttospeech  # type: ignore[attr-defined]
import dragonmapper.transcriptions  # type: ignore[import-untyped]


class FieldValue(TypedDict):
    value: str
    order: int


class NoteInfo(TypedDict):
    noteId: int
    modelName: str
    tags: list[str]
    fields: dict[str, FieldValue]


# Define maximum lengths for filename components to keep them reasonable
_MAX_TEXT_FILENAME_LEN = 50
_MAX_PINYIN_FILENAME_LEN = 50

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
    if not any(char.isdigit() for char in pinyin_text):
        numbered: str = dragonmapper.transcriptions.accented_to_numbered(pinyin_text)
    else:
        # It's already numbered, just use it as is.
        numbered = pinyin_text

    # Add spaces between syllables if they are not there.
    # This regex finds a number followed by a letter and inserts a space.
    return re.sub(r'(\d)([a-zA-Z])', r'\1 \2', numbered)

def setup_credentials() -> None:
    """
    Set up Google Cloud credentials by locating gcloud_account.json
    relative to the script's path.
    """
    script_dir = os.path.dirname(os.path.realpath(__file__))
    credentials_path = os.path.join(script_dir, "gcloud_account.json")

    if not os.path.exists(credentials_path):
        raise FileNotFoundError(
            f"Credentials file not found at {credentials_path}. "
            "Please ensure 'gcloud_account.json' is in the same directory as the script."
        )

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path


def taiwanese_tts(text: str, output_file: str = "output.mp3", voice_name: str = "cmn-TW-Standard-A", pinyin_hint: str | None = None, speaking_rate: float = 1.0) -> bytes:
    """
    Convert text to speech using Taiwanese Mandarin voice

    Args:
        text (str): Text to convert (Traditional Chinese characters)
        output_file (str): Output audio file path (will be saved in script directory)
        voice_name (str): Voice to use (see available voices below)
        pinyin_hint (str): Optional pinyin pronunciation hint
        speaking_rate (float): Speed of speech (0.25 to 4.0, default 1.0). Slower rates may improve clarity.
    """
    # Get script directory and ensure output file is saved there
    script_dir = os.path.dirname(os.path.realpath(__file__))
    output_file = os.path.join(script_dir, os.path.basename(output_file))

    # Initialize the client
    client = texttospeech.TextToSpeechClient()

    # Set the text input - use SSML if pinyin hint provided
    if pinyin_hint:
        # Convert pinyin to numbered format
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
        syllables = numbered_pinyin.split()

        # Remove non-Chinese characters from text for alignment
        chinese_chars = [char for char in text if '\u4e00' <= char <= '\u9fff']

        # Build SSML with individual phoneme tags per character
        if len(syllables) == len(chinese_chars):
            ssml_parts = ['<speak>']
            char_idx = 0
            for char in text:
                if '\u4e00' <= char <= '\u9fff':
                    # This is a Chinese character, wrap with phoneme tag
                    ssml_parts.append(f'<phoneme alphabet="pinyin" ph="{syllables[char_idx]}">{char}</phoneme>')
                    char_idx += 1
                else:
                    # Non-Chinese character, add as-is
                    ssml_parts.append(char)
            ssml_parts.append('</speak>')
            ssml_text = ''.join(ssml_parts)
        else:
            # Fallback to old method if syllable count doesn't match
            print(f"Warning: Syllable count ({len(syllables)}) doesn't match character count ({len(chinese_chars)}). Using fallback method.")
            ssml_text = f'<speak><phoneme alphabet="pinyin" ph="{numbered_pinyin}">{text}</phoneme></speak>'

        synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
        print(f"Original pinyin: {pinyin_hint}")
        print(f"Converted to numbered: {numbered_pinyin}")
        print(f"SSML: {ssml_text}")
    else:
        synthesis_input = texttospeech.SynthesisInput(text=text)

    # Build the voice request
    voice = texttospeech.VoiceSelectionParams(
        language_code="cmn-TW",  # Taiwanese Mandarin
        name=voice_name,
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE  # or MALE
    )

    # Select the type of audio file
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,  # Speed (0.25 to 4.0)
        pitch=0.0,          # Pitch (-20.0 to 20.0)
        volume_gain_db=0.0  # Volume (-96.0 to 16.0)
    )

    # Perform the text-to-speech request
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    # Write the response to an audio file
    with open(output_file, "wb") as out:
        out.write(response.audio_content)
        print(f'Audio generated: "{output_file}"')

    return response.audio_content


def anki_connect_request(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Send a request to anki-connect

    Args:
        action (str): The action to perform
        params (dict): Parameters for the action

    Returns:
        dict: Response from anki-connect
    """
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    try:
        response = requests.post("http://localhost:8765", json=request_data)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to anki-connect: {e}")
        raise


def find_note_by_traditional(note_type: str, traditional_text: str) -> int | None:
    """
    Find note with specific Traditional field value

    Args:
        traditional_text (str): Text to search for in Traditional field

    Returns:
        int: Note ID if found, None otherwise
    """
    # Search for notes with the specific Traditional field value
    search_query = f'note:{note_type} Traditional:"{traditional_text}"'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with Traditional field '{traditional_text}'")
            return note_ids[0]  # Return the first matching note

    print(f"No notes found with Traditional field '{traditional_text}'")
    return None


def get_note_info(note_id: int) -> NoteInfo:
    """
    Get detailed information about a note

    Args:
        note_id (int): The note ID

    Returns:
        dict: Note information
    """
    response = anki_connect_request("notesInfo", {"notes": [note_id]})

    if response and response.get("result"):
        return response["result"][0]  # type: ignore[return-value]

    raise Exception("No note found")


def store_media_file(filename: str, audio_data: bytes) -> bool:
    """
    Store audio file in Anki media collection

    Args:
        filename (str): Name of the file
        audio_data (bytes): Audio file data

    Returns:
        bool: True if successful, False otherwise
    """
    # Convert audio data to base64
    audio_b64 = base64.b64encode(audio_data).decode('utf-8')

    response = anki_connect_request("storeMediaFile", {
        "filename": filename,
        "data": audio_b64
    })

    if response and response.get("result"):
        print(f"Audio file '{filename}' stored in Anki media collection")
        return True
    else:
        raise Exception(f"Failed to store audio file '{filename}'")


def update_note_audio(note_id: int, audio_filename: str) -> bool:
    """
    Update the Audio field of a note

    Args:
        note_id (int): The note ID
        audio_filename (str): Name of the audio file

    Returns:
        bool: True if successful, False otherwise
    """
    # Update the Audio field with the new filename
    audio_field_value = f"[sound:{audio_filename}]"

    # Prepare the update
    fields = {"Audio": audio_field_value}

    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": fields
        }
    })

    print(response)

    if response and response.get("error") is None:  # anki-connect returns None on success
        print(f"Updated Audio field for note {note_id}")
        return True
    else:
        raise Exception(f"Failed to update Audio field for note {note_id}")
        return False


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


def update_audio_for_note(note_id: int, note_info: NoteInfo, target_text: str, pinyin_hint: str | None = None, voice_name: str = "cmn-TW-Standard-C", speaking_rate: float = 1.0) -> None:
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
    clean_text = target_text.replace('?', '').replace('*', '')
    # Truncate clean_text
    if len(clean_text) > _MAX_TEXT_FILENAME_LEN:
        clean_text = clean_text[:_MAX_TEXT_FILENAME_LEN]

    if pinyin_hint:
        # Convert pinyin to numbered format and clean for filename
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
        clean_pinyin = numbered_pinyin.replace(' ', '_').replace(':', '').replace('*', '').replace('?', '')
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
    audio_data = taiwanese_tts(target_text, output_file=audio_filename, voice_name=voice_name, pinyin_hint=pinyin_hint, speaking_rate=speaking_rate)

    # Store audio file in Anki media collection
    if store_media_file(audio_filename, audio_data):
        # Update the note's Audio field
        if update_note_audio(note_id, audio_filename):
            print("Successfully updated note with new audio!")
        else:
            raise Exception("Failed to update note audio field")
    else:
        raise Exception("Failed to store audio file")


def find_note_by_empty_audio(note_type: str) -> list[int]:
    # Search for notes with the specific Traditional field value
    search_query = f'note:{note_type} Traditional:_* Audio: -is:suspended'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with empty audio")
            return note_ids

    print("No notes found with empty audio")
    return []


def find_notes_by_tag(note_type: str, tag: str) -> list[int]:
    """Find notes with a specific tag."""
    search_query = f'note:{note_type} tag:"{tag}" -is:suspended'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with tag '{tag}'")
            return note_ids

    print(f"No notes found with tag '{tag}'")
    return []


def remove_tag_from_note(note_id: int, tag: str) -> bool:
    """Remove a tag from a note."""
    response = anki_connect_request("removeTags", {
        "notes": [note_id],
        "tags": tag
    })

    if response and response.get("error") is None:
        print(f"Removed tag '{tag}' from note {note_id}")
        return True
    else:
        raise Exception(f"Failed to remove tag '{tag}' from note {note_id}")


def get_clean_field_value(note_info: NoteInfo, field_name: str) -> str:
    """Extract and clean a field value from note info, stripping HTML tags."""
    return (note_info['fields'].get(field_name, {'value': '', 'order': 0}).get('value', '')
            .replace('<div>', '').replace('</div>', '').strip())


def build_multi_pronunciation_audio(note_info: NoteInfo, traditional: str) -> tuple[str | None, str | None]:
    """
    Build text and pinyin for notes with multiple pronunciations.

    Returns:
        tuple: (text_to_speak, combined_pinyin) or (None, None) if not applicable
    """
    pinyin_main = get_clean_field_value(note_info, 'Pinyin')
    pinyin_others = get_clean_field_value(note_info, 'Pinyin others')

    if not pinyin_main or not pinyin_others:
        return None, None

    # Combine all pinyins: "de2" + "de5, děi" -> ["de2", "de5", "děi"]
    all_pinyins = [pinyin_main]
    for p in pinyin_others.split(','):
        p = p.strip()
        if p:
            all_pinyins.append(p)

    # Create text with repeated character separated by Chinese commas for natural pauses
    repeated_text = '，'.join([traditional] * len(all_pinyins))
    combined_pinyin = ' '.join(all_pinyins)

    return repeated_text, combined_pinyin


_REBUILD_AUDIO_TAG = "chinese::rebuild-audio-field"
_MULTI_PRONUNCIATION_TAG = "chinese::multiple-pronounciation-character"


def process_note_audio(note_id: int, note_info: NoteInfo, note_type: str, use_pinyin_hint: bool, voice_name: str = "cmn-TW-Standard-C", speaking_rate: float = 1.0) -> bool:
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
    traditional = note_info['fields']['Traditional']['value']
    if len(traditional) == 0:
        print("No traditional found", note_info)
        return False

    tags = note_info.get('tags', [])

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
        pinyin_hint = get_clean_field_value(note_info, 'Pinyin')
        if pinyin_hint:
            print(f"Using Pinyin field from note: {pinyin_hint}")

    # Use the more efficient version that reuses note_info
    update_audio_for_note(note_id, note_info, traditional, pinyin_hint or None, voice_name=voice_name, speaking_rate=speaking_rate)
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate TTS audio for Anki notes')
    parser.add_argument('--use-pinyin-hint', action='store_true',
                       help='Use Pinyin field from notes as pronunciation hints')
    parser.add_argument('--voice', type=str, default='cmn-TW-Standard-C',
                       choices=[
                           'cmn-TW-Standard-A', 'cmn-TW-Standard-B', 'cmn-TW-Standard-C',
                           'cmn-TW-Wavenet-A', 'cmn-TW-Wavenet-B', 'cmn-TW-Wavenet-C',
                       ],
                       help='Voice to use for TTS (Wavenet voices are higher quality)')
    parser.add_argument('--speaking-rate', type=float, default=1.0,
                       help='Speaking rate (0.25 to 4.0). Slower rates (e.g., 0.85) may improve consonant clarity')
    args = parser.parse_args()

    print(f"Using voice: {args.voice}, speaking rate: {args.speaking_rate}")

    # Setup Google Cloud credentials
    setup_credentials()

    for note_type in ["TOCFL", "Hanzi"]:
        # First, process notes tagged for audio rebuild
        for note_id in find_notes_by_tag(note_type, _REBUILD_AUDIO_TAG):
            note_info = get_note_info(note_id)
            print(f"Rebuilding audio for note {note_id} (tagged with {_REBUILD_AUDIO_TAG})")
            if process_note_audio(note_id, note_info, note_type, args.use_pinyin_hint, voice_name=args.voice, speaking_rate=args.speaking_rate):
                # Remove the rebuild tag after successful audio generation
                remove_tag_from_note(note_id, _REBUILD_AUDIO_TAG)

        # Then, process notes with empty audio
        for note_id in find_note_by_empty_audio(note_type)[0:100]:
            note_info = get_note_info(note_id)
            process_note_audio(note_id, note_info, note_type, args.use_pinyin_hint, voice_name=args.voice, speaking_rate=args.speaking_rate)


if __name__ == "__main__":
    main()
