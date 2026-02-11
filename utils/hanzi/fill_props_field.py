#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.1"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))
from anki_utils import anki_connect_request
from pinyin_utils import remove_tone_marks


def load_pos_mapping():
    """
    Load POS mapping from pos.json file

    Returns:
        dict: Dictionary mapping POS codes to [name, chinese_name, examples]
    """
    # Get the path to pos.json relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pos_json_path = os.path.join(script_dir, '..', '..', 'app', 'data', 'pos.json')

    with open(pos_json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def format_pos_description(pos_value, pos_mapping):
    """
    Format POS value into a description with name and examples

    Args:
        pos_value (str): The POS field value (may contain multiple values separated by "/")
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions

    Returns:
        tuple: (formatted_description, list of unknown POS codes)
    """
    if not pos_value or not pos_value.strip():
        return "", []

    pos_codes = [code.strip() for code in pos_value.split('/')]
    descriptions = []
    unknown_codes = []

    for code in pos_codes:
        if not code:
            continue

        if code in pos_mapping:
            entry = pos_mapping[code]
            name = entry[0]  # English name
            examples = entry[2]  # Chinese examples
            descriptions.append(f"{name} ({examples})")
        else:
            unknown_codes.append(code)

    return "\n".join(descriptions), unknown_codes


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
        "Dangdai::Lesson::",
        "Dangdai::Name",
        "chinese::repeated-duplicated-prop",
        "chinese::not-learning-sound-yet",
        "chinese::multiple-pronounciation-character",
        "card-listening-ignored-on-purpose",
        "card-meaning-ignored-on-purpose",
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


def load_pinyin_mappings():
    """
    Load all enabled Hanzi notes and create mappings from pinyin/syllable to traditional characters

    Returns:
        tuple: (pinyin_to_chars, syllable_to_chars) - dictionaries mapping to lists of traditional characters
    """
    # Search for all enabled (non-suspended) Hanzi notes
    response = anki_connect_request("findNotes", {"query": "note:Hanzi -is:suspended"})

    if not response or not response.get("result"):
        print("No Hanzi notes found")
        return {}, {}

    note_ids = response["result"]
    print(f"Found {len(note_ids)} enabled Hanzi notes")

    # Get detailed information about all Hanzi notes
    notes_info = get_notes_info(note_ids)

    # Create both mappings
    pinyin_to_chars = {}
    syllable_to_chars = {}

    for note_info in notes_info:
        traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
        pinyin_accented = note_info['fields'].get('Pinyin', {}).get('value', '').strip()

        if not traditional or not pinyin_accented:
            continue

        pinyin_lower = pinyin_accented.lower()
        syllable = remove_tone_marks(pinyin_accented)

        # Add to pinyin mapping (exact match including tone)
        if pinyin_lower not in pinyin_to_chars:
            pinyin_to_chars[pinyin_lower] = []
        pinyin_to_chars[pinyin_lower].append(traditional)

        # Add to syllable mapping (without tone)
        if syllable not in syllable_to_chars:
            syllable_to_chars[syllable] = []
        syllable_to_chars[syllable].append(traditional)

    print(f"Created pinyin mapping for {len(pinyin_to_chars)} pinyin values")
    print(f"Created syllable mapping for {len(syllable_to_chars)} syllables")
    return pinyin_to_chars, syllable_to_chars


def find_notes_with_tags(note_type):
    """
    Find notes that have prop::, actor::, place::, tone:: tags, non-empty POS field,
    empty ID, or need Same Syllable Traditional field filled

    Args:
        note_type (str): The note type to search

    Returns:
        list: List of note IDs
    """
    # Build the base conditions for all note types
    base_conditions = '(tag:prop::* OR tag:actor::* OR tag:place::* OR tag:tone::* OR tag:chinese::category::* OR (POS:_* "POS Description:") OR "ID:")'

    # For Hanzi notes, also include notes that need Same Pinyin/Syllable Traditional fields filled
    if note_type == "Hanzi":
        search_query = f'note:{note_type} -is:suspended ({base_conditions} OR "Same Pinyin Traditional:" OR "Same Syllable Traditional:")'
    else:
        search_query = f'note:{note_type} {base_conditions}'

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


def get_same_chars_field_value(traditional, key, char_mapping):
    """
    Get the value for a "Same X Traditional" field by looking up other characters with the same key.

    Args:
        traditional (str): The current character
        key (str): The lookup key (pinyin or syllable)
        char_mapping (dict): Dictionary mapping keys to lists of traditional characters

    Returns:
        str: Sorted string of other characters with the same key
    """
    same_chars = char_mapping.get(key, [])
    other_chars = [c for c in same_chars if c != traditional]
    return ''.join(sorted(other_chars))


def update_fields_for_note(note_info, prop_hanzi_map, pos_mapping, pinyin_to_chars, syllable_to_chars):
    """
    Update Props, Mnemonic pegs, Anki Tags, POS Description, Same Pinyin Traditional, and Same Syllable Traditional fields for a single note

    Args:
        note_info (dict): Note information dictionary
        prop_hanzi_map (dict): Dictionary mapping prop names to Hanzi characters
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        pinyin_to_chars (dict): Dictionary mapping pinyin to lists of traditional characters
        syllable_to_chars (dict): Dictionary mapping syllables to lists of traditional characters

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
    if current_anki_tags != new_anki_tags:
        fields_to_update['Anki Tags'] = new_anki_tags

    # Process POS Description field
    if 'POS' in note_info['fields'] and 'POS Description' in note_info['fields']:
        current_pos = note_info['fields'].get('POS', {}).get('value', '').strip()
        current_pos_desc = note_info['fields'].get('POS Description', {}).get('value', '').strip()
        new_pos_desc, unknown_codes = format_pos_description(current_pos, pos_mapping)

        if unknown_codes:
            note_identifier = note_info['fields'].get('Traditional', {}).get('value', '') or \
                              note_info['fields'].get('Hanzi', {}).get('value', '') or \
                              str(note_id)
            raise ValueError(f"Unknown POS codes in note {note_identifier}: {unknown_codes}")

        if current_pos_desc != new_pos_desc:
            fields_to_update['POS Description'] = new_pos_desc

    # Process ID field - only if empty, set to "my_" + Traditional
    if 'ID' in note_info['fields'] and 'Traditional' in note_info['fields']:
        current_id = note_info['fields'].get('ID', {}).get('value', '').strip()
        traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()

        if not current_id and traditional:
            fields_to_update['ID'] = f"my_{traditional}"

    # Process Same Pinyin Traditional and Same Syllable Traditional fields - only for Hanzi notes
    if 'Traditional' in note_info['fields'] and 'Pinyin' in note_info['fields']:
        traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
        pinyin_accented = note_info['fields'].get('Pinyin', {}).get('value', '').strip()

        if traditional and pinyin_accented:
            pinyin_lower = pinyin_accented.lower()
            syllable = remove_tone_marks(pinyin_accented)

            # Process Same Pinyin Traditional field (exact pinyin match including tone)
            if 'Same Pinyin Traditional' in note_info['fields']:
                current_value = note_info['fields'].get('Same Pinyin Traditional', {}).get('value', '').strip()
                new_value = get_same_chars_field_value(traditional, pinyin_lower, pinyin_to_chars)
                if current_value != new_value:
                    fields_to_update['Same Pinyin Traditional'] = new_value

            # Process Same Syllable Traditional field (syllable match without tone)
            if 'Same Syllable Traditional' in note_info['fields']:
                current_value = note_info['fields'].get('Same Syllable Traditional', {}).get('value', '').strip()
                new_value = get_same_chars_field_value(traditional, syllable, syllable_to_chars)
                if current_value != new_value:
                    fields_to_update['Same Syllable Traditional'] = new_value

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
    Main function to process all note types and update Props, Mnemonic pegs, Anki Tags, POS Description, and Same Syllable Traditional fields
    """
    # Load the prop to Hanzi mapping first
    print("=== Loading Props mapping ===")
    prop_hanzi_map = load_prop_hanzi_mapping()

    if not prop_hanzi_map:
        raise Exception("Failed to load prop to Hanzi mapping")

    # Load the POS mapping
    print("=== Loading POS mapping ===")
    pos_mapping = load_pos_mapping()
    print(f"Loaded {len(pos_mapping)} POS codes")

    # Load the pinyin and syllable to characters mappings
    print("=== Loading Pinyin mappings ===")
    pinyin_to_chars, syllable_to_chars = load_pinyin_mappings()

    note_types = ["Hanzi", "TOCFL"]
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
                    if update_fields_for_note(note_info, prop_hanzi_map, pos_mapping, pinyin_to_chars, syllable_to_chars):
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
