import requests
from pypinyin import pinyin, Style


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


def pinyin_to_bopomofo(chinese_text):
    """
    Convert Chinese text to bopomofo (zhuyin) using pypinyin

    Args:
        chinese_text (str): Chinese characters to convert

    Returns:
        str: Bopomofo/Zhuyin representation
    """
    if not chinese_text or chinese_text.strip() == "":
        return ""

    # Use pypinyin to convert Chinese characters directly to bopomofo
    bopomofo_list = pinyin(chinese_text, style=Style.BOPOMOFO)

    # Join the bopomofo syllables with spaces
    return " ".join([syllable[0] for syllable in bopomofo_list])


def find_notes_with_empty_zhuyin(note_type):
    """
    Find notes with empty Zhuyin field but non-empty Traditional field

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    # Search for notes with non-empty Traditional but empty Zhuyin field
    search_query = f'note:{note_type} Traditional:_* Zhuyin:'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with empty Zhuyin field in {note_type}")
            return note_ids

    print(f"No notes found with empty Zhuyin field in {note_type}")
    return []


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


def update_note_zhuyin(note_id, zhuyin_text):
    """
    Update the Zhuyin field of a note

    Args:
        note_id (int): The note ID
        zhuyin_text (str): The zhuyin text to set

    Returns:
        bool: True if successful, False otherwise
    """
    # Prepare the update
    fields = {"Zhuyin": zhuyin_text}

    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": fields
        }
    })

    if response and response.get("error") is None:  # anki-connect returns None on success
        print(f"Updated Zhuyin field for note {note_id} with: {zhuyin_text}")
        return True
    else:
        print(f"Failed to update Zhuyin field for note {note_id}: {response}")
        return False


def update_zhuyin_for_note(note_type, note_id):
    """
    Update Zhuyin field for a single note based on its Traditional field

    Args:
        note_type (str): The note type
        note_id (int): The note ID
    """
    # Get note information
    note_info = get_note_info(note_id)
    if not note_info:
        return

    # Get the Traditional field value (Chinese characters)
    traditional_field = note_info['fields'].get('Traditional', {})
    traditional_value = traditional_field.get('value', '').strip()

    # Get the current Zhuyin field value
    zhuyin_field = note_info['fields'].get('Zhuyin', {})
    current_zhuyin = zhuyin_field.get('value', '').strip()

    # Only update if Zhuyin is empty and Traditional has content
    if current_zhuyin:
        print(f"Skipping note {note_id}: Zhuyin field already has content: '{current_zhuyin}'")
        return

    if not traditional_value:
        print(f"Skipping note {note_id}: No Traditional content found")
        return

    print(f"Processing note {note_id}: Traditional='{traditional_value}'")

    # Convert Chinese characters to Bopomofo
    zhuyin_text = pinyin_to_bopomofo(traditional_value)

    if zhuyin_text:
        # Update the note's Zhuyin field
        if update_note_zhuyin(note_id, zhuyin_text):
            print(f"Successfully updated note {note_id} with Zhuyin: {zhuyin_text}")
        else:
            print(f"Failed to update note {note_id}")
    else:
        print(f"Failed to convert Traditional to Zhuyin for note {note_id}")


def main():
    """
    Main function to process all note types and update Zhuyin fields
    """
    note_types = ["TOCFL", "MyWords", "Hanzi", "Dangdai"]

    for note_type in note_types:
        print(f"\n=== Processing {note_type} ===")
        note_ids = find_notes_with_empty_zhuyin(note_type)

        # Limit to first 1000 notes for safety
        for note_id in note_ids[:1000]:
            try:
                update_zhuyin_for_note(note_type, note_id)
            except Exception as e:
                print(f"Error processing note {note_id}: {e}")
                continue

        print(f"Completed processing {note_type}")

    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
