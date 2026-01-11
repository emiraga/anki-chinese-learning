#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.1"
# dependencies = [
#   "requests",
# ]
# ///

import requests


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


def extract_tagged_values(tags, prefix, suffix_map=None, separator=", ", sort=True):
    """
    Extract and process tags that start with a specific prefix

    Args:
        tags (list): List of tags from a note
        prefix (str): The prefix to filter tags by (e.g., "prop::", "actor::")
        suffix_map (dict): Optional dictionary mapping tag values to suffixes (e.g., Hanzi)
        separator (str): Separator to use when joining values
        sort (bool): Whether to sort the extracted values alphabetically

    Returns:
        str: Separated values with optional suffixes
    """
    if not tags:
        return ""

    # Filter tags that start with the prefix and strip it
    prefix_len = len(prefix)
    values = [tag[prefix_len:] for tag in tags if tag.startswith(prefix)]

    if not values:
        return ""

    if sort:
        values.sort()

    # Add suffix if mapping is provided
    if suffix_map:
        result = []
        for value in values:
            suffix = suffix_map.get(value, "")
            if suffix:
                result.append(f"{value} {suffix}")
            else:
                result.append(value)
        return separator.join(result)

    return separator.join(values)


def extract_props_from_tags(tags, prop_hanzi_map):
    """
    Extract and process tags that start with 'prop::'

    Args:
        tags (list): List of tags from a note
        prop_hanzi_map (dict): Dictionary mapping prop names to Hanzi characters

    Returns:
        str: Comma-separated props with Hanzi (sorted alphabetically)
    """
    return extract_tagged_values(tags, "prop::", prop_hanzi_map, ", ", True)


def extract_mnemonic_pegs(tags):
    """
    Extract and process actor, place, and tone tags for mnemonic pegs

    Args:
        tags (list): List of tags from a note

    Returns:
        str: Semicolon-separated mnemonic pegs (actor; place; tone)
    """
    if not tags:
        return ""

    actor = extract_tagged_values(tags, "actor::", None, ", ", False)
    place = extract_tagged_values(tags, "place::", None, ", ", False)
    tone = extract_tagged_values(tags, "tone::", None, ", ", False)

    return "; ".join(filter(None, [actor, place, tone]))


def extract_anki_tags(tags):
    """
    Extract tags that are not prop::, actor::, place::, or tone:: prefixed

    Args:
        tags (list): List of tags from a note

    Returns:
        str: Comma-separated remaining tags (sorted alphabetically)
    """
    if not tags:
        return ""

    special_prefixes = (
        "auto-generated",
        "prop::",
        "actor::",
        "place::",
        "tone::",
        "TOCFL::",
        "chinese::repeated-duplicated-prop",
        "chinese::not-learning-sound-yet",
        "chinese::multiple-pronounciation-character",
    )
    remaining_tags = [tag for tag in tags if not tag.startswith(special_prefixes)]

    if not remaining_tags:
        return ""

    remaining_tags.sort()
    return ", ".join(remaining_tags)


def load_prop_hanzi_mapping():
    """
    Load all Props notes and create a mapping from prop name to Hanzi

    Returns:
        dict: Dictionary mapping prop names to Hanzi characters
    """
    # Search for all Props notes
    response = anki_connect_request("findNotes", {"query": "note:Props"})

    if not response or not response.get("result"):
        print("No Props notes found")
        return {}

    note_ids = response["result"]
    print(f"Found {len(note_ids)} Props notes")

    # Get detailed information about all Props notes
    notes_info = get_notes_info(note_ids)

    # Create the mapping
    prop_hanzi_map = {}
    for note_info in notes_info:
        prop_name = note_info['fields'].get('Prop', {}).get('value', '').strip()
        hanzi = note_info['fields'].get('Hanzi', {}).get('value', '').strip()

        if prop_name and hanzi:
            prop_hanzi_map[prop_name] = hanzi

    print(f"Created mapping for {len(prop_hanzi_map)} props")
    return prop_hanzi_map


def find_notes_with_tags(note_type):
    """
    Find notes that have prop::, actor::, place::, or tone:: tags

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    # Search for notes with any of the relevant tags
    search_query = f'note:{note_type} (tag:prop::* OR tag:actor::* OR tag:place::* OR tag:tone::* OR tag:chinese::category::*)'

    response = anki_connect_request("findNotes", {"query": search_query})

    if response and response.get("result"):
        note_ids = response["result"]
        if note_ids:
            print(f"Found {len(note_ids)} note(s) with relevant tags in {note_type}")
            return note_ids

    print(f"No notes found with relevant tags in {note_type}")
    return []


def get_notes_info(note_ids):
    """
    Get detailed information about multiple notes

    Args:
        note_ids (list): List of note IDs

    Returns:
        list: List of note information dictionaries
    """
    response = anki_connect_request("notesInfo", {"notes": note_ids})

    if response and response.get("result"):
        return response["result"]

    raise Exception(f"No notes found for IDs {note_ids}")


def update_note_fields(note_id, fields_dict):
    """
    Update multiple fields of a note

    Args:
        note_id (int): The note ID
        fields_dict (dict): Dictionary of field names to values

    Returns:
        bool: True if successful, False otherwise
    """
    response = anki_connect_request("updateNoteFields", {
        "note": {
            "id": note_id,
            "fields": fields_dict
        }
    })

    if response and response.get("error") is None:  # anki-connect returns None on success
        fields_str = ", ".join(f"{k}='{v}'" for k, v in fields_dict.items())
        print(f"Updated note {note_id} with: {fields_str}")
        return True
    else:
        print(f"Failed to update note {note_id}: {response}")
        return False


def update_fields_for_note(note_info, prop_hanzi_map):
    """
    Update Props, Mnemonic pegs, and Anki Tags fields for a single note based on its tags

    Args:
        note_info (dict): Note information dictionary
        prop_hanzi_map (dict): Dictionary mapping prop names to Hanzi characters

    Returns:
        bool: True if updated, False if skipped or failed
    """
    note_id = note_info.get('noteId')
    tags = note_info.get('tags', [])
    fields_to_update = {}

    # Process Props field
    current_props = note_info['fields'].get('Props', {}).get('value', '').strip()
    new_props = extract_props_from_tags(tags, prop_hanzi_map)

    if new_props and current_props != new_props:
        fields_to_update['Props'] = new_props

    # Process Mnemonic pegs field
    current_pegs = note_info['fields'].get('Mnemonic pegs', {}).get('value', '').strip()
    new_pegs = extract_mnemonic_pegs(tags)

    if new_pegs and current_pegs != new_pegs:
        fields_to_update['Mnemonic pegs'] = new_pegs

    # Process Anki Tags field (remaining tags not matching special prefixes)
    current_anki_tags = note_info['fields'].get('Anki Tags', {}).get('value', '').strip()
    new_anki_tags = extract_anki_tags(tags)
    if new_anki_tags:
        print(note_info['fields'].get('Traditional', '?'), new_anki_tags)

    if current_anki_tags != new_anki_tags:
        fields_to_update['Anki Tags'] = new_anki_tags

    # Only update if there are changes
    if not fields_to_update:
        return False

    print(f"Updating note {note_id}:")
    for field_name, new_value in fields_to_update.items():
        current_value = note_info['fields'].get(field_name, {}).get('value', '').strip()
        print(f"  {field_name}: '{current_value}' -> '{new_value}'")

    # Update the note's fields
    if update_note_fields(note_id, fields_to_update):
        print(f"Successfully updated note {note_id}")
        return True
    else:
        print(f"Failed to update note {note_id}")
        return False


def main():
    """
    Main function to process all note types and update Props, Mnemonic pegs, and Anki Tags fields
    """
    # Load the prop to Hanzi mapping first
    print("=== Loading Props mapping ===")
    prop_hanzi_map = load_prop_hanzi_mapping()

    if not prop_hanzi_map:
        raise Exception("Failed to load prop to Hanzi mapping")

    note_types = ["Hanzi", "TOCFL", "Dangdai", "MyWords"]
    batch_size = 100

    for note_type in note_types:
        print(f"\n=== Processing {note_type} ===")
        note_ids = find_notes_with_tags(note_type)

        if not note_ids:
            continue

        # Process notes in batches
        total_updated = 0
        total_processed = 0

        for i in range(0, len(note_ids), batch_size):
            batch_ids = note_ids[i:i + batch_size]
            batch_num = i // batch_size + 1

            try:
                notes_info = get_notes_info(batch_ids)

                for note_info in notes_info:
                    if update_fields_for_note(note_info, prop_hanzi_map):
                        total_updated += 1
                    total_processed += 1

            except Exception as e:
                print(f"Error processing batch {batch_num}: {e}")
                continue

        print(f"\nCompleted processing {note_type}")
        print(f"Total processed: {total_processed}, Updated: {total_updated}")

    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
