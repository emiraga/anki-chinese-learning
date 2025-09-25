#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "google.cloud.texttospeech",
#   "pypinyin",
# ]
# ///

import os
import requests
import base64
import argparse
from google.cloud import texttospeech
from pypinyin import lazy_pinyin, Style


# Generate API key via https://console.cloud.google.com/apis/credentials

def convert_pinyin_to_numbered(pinyin_text):
    """
    Convert pinyin with tone marks to numbered format

    Args:
        pinyin_text (str): Pinyin with tone marks (e.g., "děi yào")

    Returns:
        str: Pinyin with numbers (e.g., "dei3 yao4")
    """
    # Break up into syllables
    syllables = pinyin_text.split()
    result_syllables = []

    # Tone detection maps
    tone_chars = {
        1: 'āēīōūǖ',
        2: 'áéíóúǘ',
        3: 'ǎěǐǒǔǚ',
        4: 'àèìòùǜ'
    }

    # Diacritic removal map
    remove_diacritics = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v'
    }

    for syllable in syllables:
        # Find tone for this syllable
        tone_number = None
        for tone, chars in tone_chars.items():
            if any(char in chars for char in syllable):
                tone_number = tone
                break

        # Remove diacritics
        clean_syllable = ""
        for char in syllable:
            clean_syllable += remove_diacritics.get(char, char)

        # Add tone number at end
        if tone_number:
            clean_syllable += str(tone_number)

        result_syllables.append(clean_syllable)

    return ' '.join(result_syllables)

def setup_credentials():
    """
    Set up Google Cloud credentials
    You need to:
    1. Create a Google Cloud project
    2. Enable Text-to-Speech API
    3. Create a service account and download JSON key
    4. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
    """
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcloud_account.json"


def taiwanese_tts(text, output_file="output.mp3", voice_name="cmn-TW-Standard-A", pinyin_hint=None):
    """
    Convert text to speech using Taiwanese Mandarin voice

    Args:
        text (str): Text to convert (Traditional Chinese characters)
        output_file (str): Output audio file path
        voice_name (str): Voice to use (see available voices below)
        pinyin_hint (str): Optional pinyin pronunciation hint
    """
    # Initialize the client
    client = texttospeech.TextToSpeechClient()

    # Set the text input - use SSML if pinyin hint provided
    if pinyin_hint:
        # Convert pinyin to numbered format and use phoneme tags
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
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
        speaking_rate=1.0,  # Speed (0.25 to 4.0)
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


def anki_connect_request(action, params=None):
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


def find_note_by_traditional(note_type, traditional_text):
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


def get_note_info(note_id):
    """
    Get detailed information about a note

    Args:
        note_id (int): The note ID

    Returns:
        dict: Note information
    """
    response = anki_connect_request("notesInfo", {"notes": [note_id]})

    if response and response.get("result"):
        return response["result"][0]

    raise Exception("No note found")


def store_media_file(filename, audio_data):
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


def update_note_audio(note_id, audio_filename):
    """
    Update the Audio field of a note

    Args:
        note_id (int): The note ID
        audio_filename (str): Name of the audio file

    Returns:
        bool: True if successful, False otherwise
    """
    # Update the Audio field with the new filename
    # Format: [sound:filename.mp3]
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


def update_audio_on_a_note(note_type, target_text, pinyin_hint=None):
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


def update_audio_for_note(note_id, note_info, target_text, pinyin_hint=None):
    """
    Update audio for a specific note using existing note info

    Args:
        note_id (int): The note ID
        note_info (dict): Existing note information from get_note_info
        target_text (str): Traditional Chinese text to generate audio for
        pinyin_hint (str): Optional pinyin pronunciation hint (e.g., "de2 dao4")
    """
    voice_name = "cmn-TW-Standard-C"

    print(f"Found note: {note_info['fields'].get('Traditional', {}).get('value', 'N/A')}")

    # Generate audio filename
    clean_text = target_text.replace('?', '').replace('*', '')
    if pinyin_hint:
        # Convert pinyin to numbered format and clean for filename
        numbered_pinyin = convert_pinyin_to_numbered(pinyin_hint)
        clean_pinyin = numbered_pinyin.replace(' ', '_').replace(':', '').replace('*', '').replace('?', '')
        audio_filename = f"emir_tts_{clean_text}_{clean_pinyin}_{note_id}.mp3"
    else:
        audio_filename = f"emir_tts_{clean_text}_{note_id}.mp3"

    # Generate TTS audio
    if pinyin_hint:
        print(f"Generating TTS audio for: {target_text} with pinyin hint: {pinyin_hint}")
    else:
        print(f"Generating TTS audio for: {target_text}")
    audio_data = taiwanese_tts(target_text, output_file=audio_filename, voice_name=voice_name, pinyin_hint=pinyin_hint)

    # Store audio file in Anki media collection
    if store_media_file(audio_filename, audio_data):
        # Update the note's Audio field
        if update_note_audio(note_id, audio_filename):
            print("Successfully updated note with new audio!")
        else:
            raise Exception("Failed to update note audio field")
    else:
        raise Exception("Failed to store audio file")


def find_note_by_empty_audio(note_type):
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


def main():
    parser = argparse.ArgumentParser(description='Generate TTS audio for Anki notes')
    parser.add_argument('--use-pinyin-hint', action='store_true',
                       help='Use Pinyin field from notes as pronunciation hints')
    args = parser.parse_args()

    # Setup Google Cloud credentials
    setup_credentials()

    for noteType in ["TOCFL", "MyWords", "Hanzi", "Dangdai"]:
        for note_id in find_note_by_empty_audio(noteType)[0:100]:
            note_info = get_note_info(note_id)
            traditional = note_info['fields']['Traditional']['value']
            if len(traditional) > 0:
                # Get pinyin from note if available and flag is set
                pinyin_hint = None
                if args.use_pinyin_hint:
                    pinyin_hint = note_info['fields'].get('Pinyin', {}).get('value', '').strip()
                    if pinyin_hint:
                        print(f"Using Pinyin field from note: {pinyin_hint}")

                # Use the more efficient version that reuses note_info
                update_audio_for_note(note_id, note_info, traditional, pinyin_hint or None)
            else:
                print("No traditional found", note_info)


if __name__ == "__main__":
    main()
