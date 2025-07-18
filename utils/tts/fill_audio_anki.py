import os
import requests
import base64
from google.cloud import texttospeech


# Generate API key via https://console.cloud.google.com/apis/credentials

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


def taiwanese_tts(text, output_file="output.mp3", voice_name="cmn-TW-Standard-A"):
    """
    Convert text to speech using Taiwanese Mandarin voice

    Args:
        text (str): Text to convert (Traditional Chinese characters)
        output_file (str): Output audio file path
        voice_name (str): Voice to use (see available voices below)
    """
    # Initialize the client
    client = texttospeech.TextToSpeechClient()

    # Set the text input
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
        speaking_rate=0.8,  # Speed (0.25 to 4.0)
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


def update_audio_on_a_note(note_type, target_text):
    """
    Main function to find note and update audio
    """

    # Text to search for
    voice_name = "cmn-TW-Standard-C"

    # Find the note
    note_id = find_note_by_traditional(note_type, target_text)
    if not note_id:
        return

    # Get note information
    note_info = get_note_info(note_id)
    if not note_info:
        return

    print(f"Found note: {note_info['fields'].get('Traditional', {}).get('value', 'N/A')}")

    # Generate audio filename
    audio_filename = f"emir_tts_{target_text.replace("?", "").replace("*", "")}_{note_id}.mp3"

    # Generate TTS audio
    print(f"Generating TTS audio for: {target_text}")
    audio_data = taiwanese_tts(target_text, output_file=audio_filename, voice_name=voice_name)

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
    search_query = f'note:{note_type} Traditional:_* Audio:'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with empty audio")
            return note_ids

    print(f"No notes found with empty audio")
    return []


def main():
    # Setup Google Cloud credentials
    setup_credentials()

    for noteType in ["TOCFL", "MyWords", "Hanzi"]:
        for note_id in find_note_by_empty_audio(noteType)[0:100]:
            note_info = get_note_info(note_id)
            traditional = note_info['fields']['Traditional']['value']
            if len(traditional) > 0:
                update_audio_on_a_note(noteType, traditional)
            else:
                print("No traditional found", note_info)


if __name__ == "__main__":
    main()
