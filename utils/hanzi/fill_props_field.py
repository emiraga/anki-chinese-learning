#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.1"
# dependencies = [
#   "requests",
#   "dragonmapper",
#   "google-genai",
# ]
# ///

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))
from anki_utils import anki_connect_request
from pinyin_utils import remove_tone_marks
from gemini_utils import create_gemini_client, gemini_generate


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


def build_pos_name_to_code_mapping(pos_mapping):
    """
    Build a reverse mapping from POS English names to their codes.

    Args:
        pos_mapping (dict): Dictionary mapping POS codes to [name, chinese_name, examples]

    Returns:
        dict: Dictionary mapping English names (lowercase) to POS codes
    """
    name_to_code = {}
    for code, entry in pos_mapping.items():
        name = entry[0].lower()  # English name, lowercase for matching
        name_to_code[name] = code
    return name_to_code


def suggest_pos_with_gemini(traditional, meaning, pos_mapping, gemini_client):
    """
    Use Gemini AI to suggest the appropriate POS(s) for a Chinese phrase.
    A single phrase may have multiple POS values.

    Args:
        traditional (str): Traditional Chinese text
        meaning (str): English meaning of the phrase
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        gemini_client: The Gemini client instance

    Returns:
        str: The suggested POS code(s) separated by "/", or empty string if unable to determine
    """
    # Build list of POS options with English names and examples
    pos_options = []
    for code, entry in pos_mapping.items():
        name = entry[0]  # English name
        examples = entry[2]  # Chinese examples
        if examples:
            pos_options.append(f"- {name} (e.g., {examples})")
        else:
            pos_options.append(f"- {name}")

    pos_list = "\n".join(pos_options)

    prompt = f"""You are a Chinese language expert. Determine the part(s) of speech (POS) for the following Chinese word/phrase.

Chinese (Traditional): {traditional}
English meaning: {meaning}

Choose from this list (a word can have multiple POS if it's commonly used in different ways):
{pos_list}

Reply with ONLY the part of speech name(s), separated by commas if multiple (e.g., "noun" or "noun, verb"). Nothing else."""

    try:
        response = gemini_generate(prompt, client=gemini_client, max_retries=2)
        suggested_names = [name.strip().lower() for name in response.strip().split(',')]

        # Build reverse mapping
        name_to_code = build_pos_name_to_code_mapping(pos_mapping)

        # Find codes for each suggested name
        codes = []
        for suggested_name in suggested_names:
            # Try exact match first
            if suggested_name in name_to_code:
                codes.append(name_to_code[suggested_name])
                continue

            # Try partial match (in case AI returns slightly different format)
            matched = False
            for name, code in name_to_code.items():
                if suggested_name in name or name in suggested_name:
                    codes.append(code)
                    matched = True
                    break

            if not matched:
                raise Exception(f"  Warning: AI suggested '{suggested_name}' which doesn't match any POS")

        if codes:
            return "/".join(codes)

        return ""

    except Exception as e:
        raise Exception(f"  Error getting POS suggestion from Gemini: {e}")


def generate_examples_json_with_gemini(traditional, pos_codes, pos_mapping, gemini_client):
    """
    Use Gemini AI to generate example sentences for each POS of a Chinese phrase.

    Args:
        traditional (str): Traditional Chinese text
        pos_codes (str): POS codes separated by "/" (e.g., "N/V")
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        gemini_client: The Gemini client instance

    Returns:
        dict: Dictionary mapping POS codes to lists of example objects
              {<POS>: [{"Traditional": <sentence>, "English": <translation>}]}
    """
    if not pos_codes or not pos_codes.strip():
        return {}

    # Parse POS codes and build descriptions for the prompt
    codes = [code.strip() for code in pos_codes.split('/') if code.strip()]
    pos_descriptions = []
    code_to_name = {}

    for code in codes:
        if code in pos_mapping:
            entry = pos_mapping[code]
            name = entry[0]  # English name
            code_to_name[code] = name
            pos_descriptions.append(f"- {code} ({name})")

    if not pos_descriptions:
        return {}

    # Build list of all available POS for AI to suggest additional ones
    all_pos_options = []
    for code, entry in pos_mapping.items():
        name = entry[0]
        all_pos_options.append(f"- {code} ({name})")

    all_pos_list = "\n".join(all_pos_options)
    pos_list = "\n".join(pos_descriptions)

    prompt = f"""You are a Chinese language expert specializing in Taiwan Mandarin.

Generate example sentences for the word/phrase "{traditional}".

The phrase has these parts of speech:
{pos_list}

Available POS codes (you MUST use ONLY these exact codes as JSON keys):
{all_pos_list}

IMPORTANT: This system uses Taiwan TOCFL grammar categories. There is NO "A", "Adj", or "Adjective" code.
What English calls "adjectives" are classified as "Vs" (intransitive state verbs) in this system.

Requirements:
1. Generate at least ONE example sentence for each POS listed above
2. If a POS has importantly different usages, generate multiple examples
3. You MAY add examples for additional POS codes from the list above if the phrase is commonly used that way
4. Sentences should reflect casual Taiwan Mandarin conversation
5. Use Traditional Chinese characters
6. CRITICAL: Use ONLY the exact codes shown above as JSON keys (e.g., "N", "V", "Vs", "Adv"). Never use "A", "Adj", "Noun", "Verb", or any other abbreviations not in the list.

CRITICAL - Sentence length:
- Sentences MUST be very short and simple
- Use basic vocabulary and simple grammar (casual conversation in Taiwan)
- Each sentence should demonstrate ONE clear usage
- NO complex or compound sentences, unless it's absolutely necessary
- Think "flashcard example" not "textbook paragraph"

Reply in this EXACT JSON format (no markdown, no code blocks):
{{"POS_CODE": [{{"Traditional": "example sentence", "English": "translation"}}]}}

Example response format:
{{"V": [{{"Traditional": "我要吃飯。", "English": "I want to eat."}}], "N": [{{"Traditional": "這是我的飯。", "English": "This is my rice."}}]}}"""

    try:
        response = gemini_generate(prompt, client=gemini_client, max_retries=2)

        # Clean up response - remove markdown code blocks if present
        response = response.strip()
        if response.startswith('```'):
            # Remove opening code block
            first_newline = response.find('\n')
            if first_newline != -1:
                response = response[first_newline + 1:]
            # Remove closing code block
            if response.endswith('```'):
                response = response[:-3].strip()

        # Parse JSON response
        examples_dict = json.loads(response)

        # Validate structure and filter to only valid POS codes
        validated_dict = {}
        for pos_code, examples in examples_dict.items():
            if pos_code not in pos_mapping:
                raise ValueError(f"AI suggested unknown POS '{pos_code}'")

            if not isinstance(examples, list):
                continue

            validated_examples = []
            for example in examples:
                if isinstance(example, dict) and 'Traditional' in example and 'English' in example:
                    validated_examples.append({
                        'Traditional': example['Traditional'],
                        'English': example['English']
                    })

            if validated_examples:
                validated_dict[pos_code] = validated_examples

        return validated_dict

    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse AI response as JSON: {e}\nResponse: {response}")
    except Exception as e:
        raise Exception(f"Error generating examples from Gemini: {e}")


def format_examples_as_html(examples_json_str, pos_mapping):
    """
    Format Examples JSON as HTML with POS name as heading, Chinese sentence,
    and gray English translation.

    Args:
        examples_json_str (str): JSON string with examples per POS
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions

    Returns:
        str: HTML formatted examples
    """
    if not examples_json_str or not examples_json_str.strip():
        return ""

    try:
        examples_dict = json.loads(examples_json_str)
    except json.JSONDecodeError:
        return ""

    if not examples_dict:
        return ""

    pos_sections = []

    for pos_code, examples in examples_dict.items():
        if not examples:
            continue

        # Get POS English name
        if pos_code in pos_mapping:
            pos_name = pos_mapping[pos_code][0]  # English name
        else:
            pos_name = pos_code

        # Build section for this POS
        section_parts = [f"<b>{pos_name}</b>"]

        # Add each example
        for example in examples:
            if isinstance(example, dict) and 'Traditional' in example and 'English' in example:
                chinese = example['Traditional']
                english = example['English']
                section_parts.append(f"{chinese}<br><span style=\"color: gray;\">{english}</span>")

        # Join examples within a POS with single line break
        pos_sections.append("<br>".join(section_parts))

    # Join different POS sections with double line break
    return "<br><br>".join(pos_sections)


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
        "prop-top::",
        "prop-bottom::",
        "prop-left::",
        "prop-right::",
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
        raise Exception("No Props notes found")

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
        raise Exception("No Hanzi notes found")

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


def find_notes_with_tags(note_type, include_empty_pos=False, include_empty_examples=False):
    """
    Find notes that have prop::, actor::, place::, tone:: tags, non-empty POS field,
    empty ID, need Same Syllable Traditional field filled, have empty POS field,
    or need Examples JSON field filled

    Args:
        note_type (str): The note type to search
        include_empty_pos (bool): Whether to include notes with empty POS field
        include_empty_examples (bool): Whether to include notes with empty Examples JSON field

    Returns:
        list: List of note IDs
    """
    # Build the base conditions for all note types
    base_conditions = '(tag:prop::* OR tag:actor::* OR tag:place::* OR tag:tone::* OR tag:chinese::category::* OR (POS:_* "POS Description:") OR "ID:")'

    # For Hanzi notes, also include notes that need Same Pinyin/Syllable Traditional fields filled
    if note_type == "Hanzi":
        search_query = f'note:{note_type} -is:suspended ({base_conditions} OR "Same Pinyin Traditional:" OR "Same Syllable Traditional:")'
    elif note_type == "TOCFL":
        conditions = [base_conditions]
        if include_empty_pos:
            # Include unsuspended TOCFL notes with empty POS field for AI suggestion
            conditions.append('(-is:suspended "POS:")')
        if include_empty_examples:
            # Include unsuspended TOCFL notes with empty Examples JSON/Examples field, due today or tomorrow
            conditions.append('(-is:suspended prop:due<=5 ("Examples JSON:" OR "Examples:"))')
        search_query = f'note:{note_type} ({" OR ".join(conditions)})'
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

    if not response or response.get("error") is not None:
        raise Exception(f"Failed to update note {note_id}: {response}")

    fields_str = ", ".join(f"{k}='{v}'" for k, v in fields_dict.items())
    print(f"Updated note {note_id} with: {fields_str}")
    return True


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


def update_fields_for_note(note_info, prop_hanzi_map, pos_mapping, pinyin_to_chars, syllable_to_chars, gemini_client=None):
    """
    Update Props, Mnemonic pegs, Anki Tags, POS, POS Description, Examples JSON, Same Pinyin Traditional, and Same Syllable Traditional fields for a single note

    Args:
        note_info (dict): Note information dictionary
        prop_hanzi_map (dict): Dictionary mapping prop names to Hanzi characters
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        pinyin_to_chars (dict): Dictionary mapping pinyin to lists of traditional characters
        syllable_to_chars (dict): Dictionary mapping syllables to lists of traditional characters
        gemini_client: Optional Gemini client for AI-based POS and examples suggestions

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

    # Process POS field - suggest using AI if empty and Traditional ≤ 5 characters
    if 'POS' in note_info['fields'] and 'POS Description' in note_info['fields']:
        current_pos = note_info['fields'].get('POS', {}).get('value', '').strip()
        traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
        meaning = note_info['fields'].get('Meaning', {}).get('value', '').strip()

        # Use AI to suggest POS if empty, Traditional ≤ 5 chars, and Gemini client available
        if not current_pos and traditional and len(traditional) <= 5 and meaning and gemini_client:
            print(f"  Suggesting POS for '{traditional}' ({meaning})...")
            suggested_pos = suggest_pos_with_gemini(traditional, meaning, pos_mapping, gemini_client)
            if suggested_pos:
                fields_to_update['POS'] = suggested_pos
                current_pos = suggested_pos  # Use for POS Description processing below

        current_pos_desc = note_info['fields'].get('POS Description', {}).get('value', '').strip()
        new_pos_desc, unknown_codes = format_pos_description(current_pos, pos_mapping)

        if unknown_codes:
            note_identifier = traditional or \
                              note_info['fields'].get('Hanzi', {}).get('value', '') or \
                              str(note_id)
            raise ValueError(f"Unknown POS codes in note {note_identifier}: {unknown_codes}")

        if current_pos_desc != new_pos_desc:
            fields_to_update['POS Description'] = new_pos_desc

    # Process Examples JSON field - generate examples for each POS if empty and Traditional ≤ 3 chars
    if 'Examples JSON' in note_info['fields'] and 'POS' in note_info['fields']:
        current_examples_json = note_info['fields'].get('Examples JSON', {}).get('value', '').strip()
        traditional = note_info['fields'].get('Traditional', {}).get('value', '').strip()
        # Use the potentially updated POS value
        pos_value = fields_to_update.get('POS') or note_info['fields'].get('POS', {}).get('value', '').strip()

        # Generate examples if empty, Traditional ≤ 3 chars, has POS, and Gemini client available
        if not current_examples_json and traditional and len(traditional) <= 6 and pos_value and gemini_client:
            print(f"  Generating examples for '{traditional}' with POS: {pos_value}...")
            examples_dict = generate_examples_json_with_gemini(traditional, pos_value, pos_mapping, gemini_client)
            if examples_dict:
                fields_to_update['Examples JSON'] = json.dumps(examples_dict, ensure_ascii=False)

        # Process Examples field (HTML formatted) if it exists
        if 'Examples' in note_info['fields']:
            current_examples_html = note_info['fields'].get('Examples', {}).get('value', '').strip()
            # Use potentially updated Examples JSON or existing one
            examples_json_str = fields_to_update.get('Examples JSON') or current_examples_json
            new_examples_html = format_examples_as_html(examples_json_str, pos_mapping)

            if new_examples_html and current_examples_html != new_examples_html:
                fields_to_update['Examples'] = new_examples_html

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
    update_note_fields(note_id, fields_to_update)
    print(f"Successfully updated note {note_id}")
    return True


def main():
    """
    Main function to process all note types and update Props, Mnemonic pegs, Anki Tags, POS, POS Description, Examples JSON, and Same Syllable Traditional fields
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

    # Create Gemini client for AI-based POS suggestions
    print("=== Creating Gemini client ===")
    gemini_client = create_gemini_client()
    print("Gemini client created successfully")

    note_types = ["Hanzi", "TOCFL"]
    batch_size = 100

    for note_type in note_types:
        print(f"\n=== Processing {note_type} ===")
        # For TOCFL, include notes with empty POS and empty Examples JSON for AI suggestion
        include_empty_pos = (note_type == "TOCFL")
        include_empty_examples = (note_type == "TOCFL")
        note_ids = find_notes_with_tags(note_type, include_empty_pos=include_empty_pos, include_empty_examples=include_empty_examples)

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
                    try:
                        if update_fields_for_note(note_info, prop_hanzi_map, pos_mapping, pinyin_to_chars, syllable_to_chars, gemini_client):
                            total_updated += 1
                        total_processed += 1
                    except ValueError as e:
                        # Skip notes with validation errors (e.g., unknown POS codes)
                        note_id = note_info.get('noteId')
                        traditional = note_info['fields'].get('Traditional', {}).get('value', '')
                        print(f"  Skipping note {note_id} ({traditional}): {e}")
                        total_processed += 1

            except Exception as e:
                raise Exception(f"Error processing batch {batch_num}: {e}") from e

        print(f"\nCompleted processing {note_type}")
        print(f"Total processed: {total_processed}, Updated: {total_updated}")

    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
