#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
#   "google-cloud-translate>=3.15.0",
# ]
# ///

import requests
import dragonmapper.transcriptions
import dragonmapper.hanzi
import argparse
import sys
import os
from pathlib import Path
import time


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
        raise Exception(f"Error connecting to anki-connect: {e}")


def pinyin_to_zhuyin(pinyin_text):
    """
    Convert pinyin to zhuyin (bopomofo)

    Args:
        pinyin_text (str): Pinyin text with tone marks

    Returns:
        str: Zhuyin representation
    """
    try:
        zhuyin = dragonmapper.transcriptions.pinyin_to_zhuyin(pinyin_text)
        return zhuyin
    except Exception as e:
        raise ValueError(f"Failed to convert pinyin '{pinyin_text}' to zhuyin: {e}")


def translate_with_google(traditional_text, client, max_retries=3):
    """
    Use Google Cloud Translation API to translate Chinese text to English
    Uses zh-TW (Taiwan) as source language

    Args:
        traditional_text (str): Traditional Chinese text
        client: Google Cloud Translation client
        max_retries (int): Maximum number of retry attempts

    Returns:
        str: English translation
    """
    if not traditional_text or not traditional_text.strip():
        raise ValueError("Text cannot be empty")

    for attempt in range(max_retries):
        try:
            result = client.translate(
                traditional_text,
                source_language='zh-TW',  # Taiwan Traditional Chinese
                target_language='en'
            )
            translated_text = result['translatedText']
            return translated_text
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Translation attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(2)
            else:
                raise Exception(f"Translation failed after {max_retries} attempts: {e}")


def get_pinyin_and_zhuyin(traditional_text):
    """
    Get pinyin and zhuyin for traditional Chinese text using dragonmapper

    Args:
        traditional_text (str): Traditional Chinese text

    Returns:
        tuple: (pinyin, zhuyin) both with tone marks
    """
    try:
        # Convert Han characters directly to pinyin with tone marks
        pinyin = dragonmapper.hanzi.to_pinyin(traditional_text, accented=True)

        # Convert Han characters directly to zhuyin
        zhuyin = dragonmapper.hanzi.to_zhuyin(traditional_text)

        return pinyin, zhuyin
    except Exception as e:
        raise ValueError(f"Failed to generate pinyin/zhuyin for '{traditional_text}': {e}")


def check_traditional_exists(traditional):
    """
    Check if a note with the given Traditional field value already exists

    Args:
        traditional (str): Traditional Chinese text to check

    Returns:
        bool: True if exists, False otherwise

    Raises:
        Exception: If the check fails
    """
    # Search for notes with this exact Traditional field value
    # Using quotes for exact match
    response = anki_connect_request("findNotes", {
        "query": f'Traditional:"{traditional}"'
    })

    if response and response.get("result") is not None:
        note_ids = response["result"]
        return len(note_ids) > 0
    else:
        error = response.get("error", "Unknown error") if response else "No response"
        raise Exception(f"Failed to check if Traditional field exists: {error}")


def create_my_words_note(traditional, pinyin, zhuyin, meaning, deck_name="Chinese::Phrases", set_due_today=True):
    """
    Create a new MyWords note

    Args:
        traditional (str): Traditional Chinese text
        pinyin (str): Pinyin pronunciation
        zhuyin (str): Zhuyin (bopomofo) pronunciation
        meaning (str): English meaning
        deck_name (str): Name of the deck to add the note to
        set_due_today (bool): Whether to set cards due today (default: True)

    Returns:
        int: Note ID if successful

    Raises:
        Exception: If note creation fails or if Traditional field already exists
    """
    # Check if Traditional field already exists
    if check_traditional_exists(traditional):
        raise Exception(f"A note with Traditional field '{traditional}' already exists")

    response = anki_connect_request("addNote", {
        "note": {
            "deckName": deck_name,
            "modelName": "MyWords",
            "fields": {
                "Traditional": traditional,
                "Pinyin": pinyin,
                "Zhuyin": zhuyin,
                "Meaning": meaning,
                "Mnemonic": "",
                "Audio": ""
            },
            "tags": ["auto-generated"]
        }
    })

    if response and response.get("result"):
        note_id = response["result"]
        print(f"✓ Created note {note_id} for '{traditional}'")

        # Get cards for this note
        cards_response = anki_connect_request("findCards", {
            "query": f"nid:{note_id}"
        })

        if cards_response and cards_response.get("result"):
            card_ids = cards_response["result"]

            if set_due_today:
                # Set cards due today (due = 0 means due today)
                for card_id in card_ids:
                    set_due_response = anki_connect_request("setSpecificValueOfCard", {
                        "card": card_id,
                        "keys": ["due"],
                        "newValues": [0]
                    })

                    if set_due_response and set_due_response.get("error") is None:
                        print(f"✓ Set card {card_id} due today")
                    else:
                        print(f"⚠ Warning: Failed to set card {card_id} due today")
            else:
                # Suspend the cards
                suspend_response = anki_connect_request("suspend", {
                    "cards": card_ids
                })

                if suspend_response and suspend_response.get("error") is None:
                    print(f"✓ Suspended {len(card_ids)} card(s) for note {note_id}")
                else:
                    print(f"⚠ Warning: Failed to suspend cards for note {note_id}")

        return note_id
    else:
        error = response.get("error", "Unknown error") if response else "No response"
        raise Exception(f"Failed to create note for '{traditional}': {error}")


def main():
    """
    Main function to add a word to Anki MyWords note type
    """
    parser = argparse.ArgumentParser(
        description="Add a Chinese word to Anki MyWords note type with automatic translation and pinyin generation"
    )
    parser.add_argument(
        "traditional",
        help="Traditional Chinese text to add"
    )
    parser.add_argument(
        "--note",
        default="MyWords",
        help="Note type to use (default: MyWords)"
    )
    parser.add_argument(
        "--deck",
        default="Chinese::Phrases",
        help="Deck name to add the note to (default: Chinese::Phrases)"
    )
    parser.add_argument(
        "--no-due-today",
        action="store_true",
        help="Don't set cards due today (will suspend them instead)"
    )
    parser.add_argument(
        "--pinyin",
        help="Manual pinyin (optional, will be auto-generated if not provided)"
    )
    parser.add_argument(
        "--meaning",
        help="Manual meaning/translation (optional, will be auto-generated if not provided)"
    )
    parser.add_argument(
        "--credentials",
        type=str,
        help="Path to Google Cloud credentials JSON file (default: utils/tts/gcloud_account.json)"
    )

    args = parser.parse_args()

    if args.note != "MyWords":
        print("⚠ Warning: This script is designed for MyWords note type. Other note types may not work correctly.")

    print(f"=== Adding word to Anki ({args.note}) ===")
    print(f"Traditional: {args.traditional}")

    try:
        # Step 1: Get or generate pinyin and zhuyin
        if args.pinyin:
            pinyin = args.pinyin
            print(f"✓ Using provided pinyin: {pinyin}")
            # Still need to generate zhuyin from provided pinyin
            print("⋯ Converting to zhuyin...")
            zhuyin = pinyin_to_zhuyin(pinyin)
            print(f"✓ Generated zhuyin: {zhuyin}")
        else:
            print("⋯ Generating pinyin and zhuyin...")
            pinyin, zhuyin = get_pinyin_and_zhuyin(args.traditional)
            print(f"✓ Generated pinyin: {pinyin}")
            print(f"✓ Generated zhuyin: {zhuyin}")

        # Step 2: Get or generate meaning
        if args.meaning:
            meaning = args.meaning
            print(f"✓ Using provided meaning: {meaning}")
        else:
            # Set up Google Cloud credentials
            credentials_path = args.credentials
            if not credentials_path:
                script_dir = Path(__file__).resolve().parent
                project_root = script_dir.parent.parent
                credentials_path = project_root / 'utils' / 'tts' / 'gcloud_account.json'
            else:
                credentials_path = Path(credentials_path)

            if not credentials_path.exists():
                raise Exception(
                    f"Credentials file not found: {credentials_path}. "
                    "Provide --credentials path or use --meaning to provide translation manually."
                )

            # Set environment variable for Google Cloud credentials
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(credentials_path)

            # Initialize translation client
            print("⋯ Initializing Google Cloud Translation client...")
            from google.cloud import translate_v2 as translate
            client = translate.Client()

            # Translate
            print("⋯ Translating with Google Cloud Translation API...")
            meaning = translate_with_google(args.traditional, client)
            print(f"✓ Translated: {meaning}")

        # Step 3: Create the note
        print(f"\n⋯ Creating note in deck '{args.deck}'...")
        note_id = create_my_words_note(
            traditional=args.traditional,
            pinyin=pinyin,
            zhuyin=zhuyin,
            meaning=meaning,
            deck_name=args.deck,
            set_due_today=not args.no_due_today
        )

        print(f"\n=== Success! ===")
        print(f"Note ID: {note_id}")
        print(f"Traditional: {args.traditional}")
        print(f"Pinyin: {pinyin}")
        print(f"Zhuyin: {zhuyin}")
        print(f"Meaning: {meaning}")
        print(f"Deck: {args.deck}")
        print(f"Due today: {not args.no_due_today}")

    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
