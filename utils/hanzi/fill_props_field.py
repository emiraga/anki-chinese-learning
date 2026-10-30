#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.1"
# dependencies = [
#   "requests",
#   "dragonmapper",
#   "google-genai",
#   "google-cloud-translate>=3.15.0",
# ]
# ///

import functools
import json
import random
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    AnkiNoteInfo,
    cards_to_notes,
    find_cards_by_query,
    find_notes_by_query,
    get_field_value,
    get_notes_info,
    iter_notes_info,
    update_note_fields,
)
from shared.character_discovery import extract_all_characters
from shared.cli import parse_no_arguments
from shared.gemini_utils import STRONG_GEMINI_MODEL, create_gemini_client, gemini_generate, gemini_generate_json
from shared.google_credentials import setup_google_credentials
from shared.pinyin_utils import remove_tone_marks
from shared.project_paths import load_pos_details, load_pos_mapping, load_pos_verb_kinds
from shared.review_order import find_note_ids_in_upcoming_order
from shared.translation_utils import translate_text_with_google

# Matches an Anki cloze deletion such as "{{c1::原因}}" or "{{c1::原因::reason}}",
# capturing the answer text (without the optional hint)
CLOZE_PATTERN = re.compile(r"\{\{c\d+::(.*?)(?:::.*?)?\}\}")

# Matches Japanese kana and Korean hangul, which sometimes leak into
# AI generated "Traditional Chinese" sentences (e.g. "...插你眼。ふふ")
NON_CHINESE_SCRIPT_PATTERN = re.compile(
    "["
    "぀-ヿ"  # Hiragana and Katakana
    "ㇰ-ㇿ"  # Katakana Phonetic Extensions
    "ｦ-ﾟ"  # Halfwidth Katakana
    "ᄀ-ᇿ"  # Hangul Jamo
    "㄰-㆏"  # Hangul Compatibility Jamo
    "가-힯"  # Hangul Syllables
    "]"
)

# Number of empty Sentence Cloze Traditional fields filled per run. Kept small
# so that the generated sentences can be reviewed before generating more.
MAX_CLOZE_SENTENCES_PER_RUN = 2

# Number of existing cloze sentences shown to Gemini as style examples
CLOZE_STYLE_EXAMPLE_COUNT = 20

# Longest Traditional value that gets a cloze sentence; longer phrases are
# whole sentences themselves, and clozing them would only test the hint
MAX_CLOZE_WORD_LENGTH = 4

# Cloze cards due within this many days are filled before the new ones
CLOZE_UPCOMING_DAYS = 7


def format_pos_description(pos_value: str, pos_mapping: dict[str, Any]) -> tuple[str, list[str]]:
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

    pos_codes = [code.strip() for code in pos_value.split("/")]
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


def format_verb_kinds_table(verb_kinds: list[dict[str, Any]]) -> str:
    """
    Format the action/state/process verb kinds (the table on the app's /pos
    page) as a Markdown table.

    Args:
        verb_kinds (list): Entries of app/data/pos_verb_kinds.json

    Returns:
        str: Markdown table, one row per verb kind
    """
    rows = [
        "| Kind | Takes 很 | Completive 了 | Progressive 在 | Reduplication | Negation | Transitive | Intransitive | Separable |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    rows.extend(
        f"| {kind['name']} ({kind['meaning']}) | {kind['hen']} | {kind['le']} | {kind['zai']} | {kind['reduplication']}"
        f" | {kind['negation']} | {kind['transitive']} | {', '.join(kind['intransitive'])} | {kind['separable']} |"
        for kind in verb_kinds
    )
    return "\n".join(rows)


def format_pos_code_details(code: str, pos_entry: list[str], detail: dict[str, Any]) -> str:
    """
    Format everything the app's /pos/<code> page says about one POS code.

    Args:
        code (str): The POS code (e.g. "Vs")
        pos_entry (list): The code's [english_name, chinese_name, typical_words] from pos.json
        detail (dict): The code's entry from pos_details.json

    Returns:
        str: Markdown section describing the code
    """
    english_name, chinese_name, typical_words = pos_entry
    lines = [f"### {code}: {english_name} {chinese_name}".rstrip(), detail["summary"], detail["description"]]
    if typical_words:
        lines.append(f"Typical words: {typical_words}")

    lines.append("How to recognize it:")
    lines.extend(f"- {test}" for test in detail["tests"])

    lines.append("Examples:")
    for example in detail["examples"]:
        wrong = example.get("wrong")
        if wrong:
            lines.append(f"- INCORRECT: *{example['zh']} {example['en']}. Why: {wrong['why']} Correct: {wrong['correct']}")
        else:
            lines.append(f"- {example['zh']} ({example['en']})")

    lines.append("Don't confuse with:")
    lines.extend(f"- {contrast['pos']}: {contrast['note']}" for contrast in detail["contrasts"])
    return "\n".join(lines)


@functools.cache
def build_pos_guide() -> str:
    """
    Build the explanation of the TOCFL POS system given to the AI, from the
    same data the app's /pos pages show (pos.json, pos_details.json and
    pos_verb_kinds.json).

    Returns:
        str: Markdown guide to all POS codes

    Raises:
        KeyError: If a POS code in pos.json has no entry in pos_details.json
    """
    pos_mapping = load_pos_mapping()
    pos_details = load_pos_details()
    code_sections = "\n\n".join(format_pos_code_details(code, entry, pos_details[code]) for code, entry in pos_mapping.items())

    return f"""## The TOCFL part of speech system

The codes come from the TOCFL 8000 word list (華語八千詞表), which follows the classification of
鄧守信 (Teng Shou-hsin) used in "A Course in Contemporary Chinese". It differs from English grammar:
- There is NO adjective category. What English calls adjectives are state verbs (Vs and its variants).
- Numbers, pronouns, time words (昨天) and the question word 幾 are nouns (N).
- 把, aspect markers (了, 過, 著), resultative complements (完, 掉) and interjections are particles (Ptc).

Verbs are split by the kind of event they describe, and each kind by whether it takes an object:

{format_verb_kinds_table(load_pos_verb_kinds())}

A code without extra marking stands for the most common case:
- V is an action verb, and transitive.
- Vs and Vp are intransitive; a trailing "t" (Vst, Vpt) marks the transitive ones.
- Vs can both modify a noun and be the predicate. Vs-attr can only stand before a noun (主要道路, but
  not *這條路很主要), and Vs-pred can only be the predicate (時間夠, but not *夠時間).
- "-sep" verbs are intransitive verb+object compounds. They split to let in the target, frequency,
  duration or completion of the event: 生他的氣, 結過三次婚.

## All codes

{code_sections}"""


def suggest_pos_with_gemini(traditional: str, meaning: str, pos_mapping: dict[str, Any], gemini_client: Any) -> str:
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

    Raises:
        Exception: If Gemini fails or replies with a code that is not in pos_mapping
    """
    prompt = f"""You are a Chinese language expert specializing in Taiwan Mandarin. Determine the part(s) of speech (POS)
of a Chinese word/phrase, using the TOCFL classification explained below.

{build_pos_guide()}

## Task

Chinese (Traditional): {traditional}
English meaning: {meaning}

Apply the "How to recognize it" tests and the "Don't confuse with" notes above to decide. A word can have
multiple POS if it's commonly used in different ways (e.g. 壞 is Vs in 他很壞 and Vp in 電腦壞了), but only
list a POS that matches the given English meaning.

Reply with ONLY the POS code(s), exactly as written above, separated by commas if multiple
(e.g. "N" or "Vs, Vp"). Nothing else."""

    try:
        # The default model often confuses close codes (e.g. Vs instead of Vs-attr for 非法)
        response = gemini_generate(prompt, client=gemini_client, model_name=STRONG_GEMINI_MODEL, max_retries=2)
        # Remove markdown formatting the model sometimes adds (e.g. "**V**")
        plain_response = re.sub(r"[*`\"']", "", response)
        codes = list(dict.fromkeys(code for code in re.split(r"[,/\s]+", plain_response) if code))

        unknown_codes = [code for code in codes if code not in pos_mapping]
        if unknown_codes:
            raise Exception(f"AI suggested {unknown_codes} which don't match any POS code (reply: '{response}')")

        return "/".join(codes)

    except Exception as e:
        raise Exception(f"  Error getting POS suggestion from Gemini: {e}") from e


def generate_examples_json_with_gemini(
    traditional: str,
    pos_codes: str,
    pos_mapping: dict[str, Any],
    gemini_client: Any,
    avoid_characters: set[str] | None = None,
    existing_sentences: list[str] | None = None,
) -> dict[str, Any]:
    """
    Use Gemini AI to generate example sentences for each POS of a Chinese phrase.

    Args:
        traditional (str): Traditional Chinese text
        pos_codes (str): POS codes separated by "/" (e.g., "N/V")
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        gemini_client: The Gemini client instance
        avoid_characters (set): Optional characters the sentences must not use
            (e.g. characters the learner does not know yet)
        existing_sentences (list): Optional sentences that must not be repeated

    Returns:
        dict: Dictionary mapping POS codes to lists of example objects
              {<POS>: [{"Traditional": <sentence>, "English": <translation>}]}
    """
    if not pos_codes or not pos_codes.strip():
        return {}

    # Parse POS codes and build descriptions for the prompt
    codes = [code.strip() for code in pos_codes.split("/") if code.strip()]
    pos_descriptions: list[str] = []
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

    extra_instructions = ""
    if avoid_characters:
        extra_instructions += (
            "\nCRITICAL - The learner does not know these characters yet. Do NOT use any of them in any sentence:\n"
            f"{'、'.join(sorted(avoid_characters))}\n"
        )
    if existing_sentences:
        existing_list = "\n".join(f"- {sentence}" for sentence in existing_sentences)
        extra_instructions += f"\nThese sentences already exist. Write NEW sentences, do not repeat them:\n{existing_list}\n"

    prompt = f"""You are a Chinese language expert specializing in Taiwan Mandarin.

Generate example sentences for the word/phrase "{traditional}".

The phrase has these parts of speech:
{pos_list}

Available POS codes (you MUST use ONLY these exact codes as JSON keys):
{all_pos_list}

IMPORTANT: This system uses Taiwan TOCFL grammar categories. There is NO "A", "Adj", or "Adjective" code.
What English calls "adjectives" are classified as "Vs" (intransitive state verbs) in this system.

Requirements:
1. Generate at least ONE example sentence for each POS listed above, and at least TWO sentences in total
2. If a POS has importantly different usages, generate multiple examples
3. You MAY add examples for additional POS codes from the list above if the phrase is commonly used that way
4. Sentences should reflect casual Taiwan Mandarin conversation
5. Use Traditional Chinese characters
6. CRITICAL: Use ONLY the exact codes shown above as JSON keys (e.g., "N", "V", "Vs", "Adv").
   Never use "A", "Adj", "Noun", "Verb", or any other abbreviations not in the list.
{extra_instructions}
CRITICAL - Sentence length:
- Sentences MUST be very short and simple
- Use basic vocabulary and simple grammar (casual conversation in Taiwan)
- Each sentence should demonstrate ONE clear usage
- NO complex or compound sentences, unless it's absolutely necessary
- Think "flashcard example" not "textbook paragraph"

Reply in this EXACT JSON format (no markdown, no code blocks):
{{"POS_CODE": [{{"Traditional": "example sentence", "English": "translation"}}]}}

Example response format:
{{"V": [{{"Traditional": "我要吃飯。", "English": "I want to eat."}}],
 "N": [{{"Traditional": "這是我的飯。", "English": "This is my rice."}}]}}"""

    response = ""
    try:
        response = gemini_generate(prompt, client=gemini_client, max_retries=2)

        # Clean up response - remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```"):
            # Remove opening code block
            first_newline = response.find("\n")
            if first_newline != -1:
                response = response[first_newline + 1 :]
            # Remove closing code block
            if response.endswith("```"):
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

            validated_examples: list[dict[str, str]] = []
            for example in examples:
                if not (isinstance(example, dict) and "Traditional" in example and "English" in example):
                    continue
                if NON_CHINESE_SCRIPT_PATTERN.search(example["Traditional"]):
                    print(f"  Rejected example with non-Chinese script for '{traditional}': '{example['Traditional']}'")
                    continue
                validated_examples.append({"Traditional": example["Traditional"], "English": example["English"]})

            if validated_examples:
                validated_dict[pos_code] = validated_examples

        return validated_dict

    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse AI response as JSON: {e}\nResponse: {response}") from e
    except Exception as e:
        raise Exception(f"Error generating examples from Gemini: {e}") from e


def format_examples_as_html(examples_json_str: str, pos_mapping: dict[str, Any], english_only: bool = False) -> str:
    """
    Format Examples JSON as HTML with POS name as heading, Chinese sentence,
    and gray English translation.

    Args:
        examples_json_str (str): JSON string with examples per POS
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        english_only (bool): When True, emit only the English translations
            (no Chinese sentences), for the "Examples English" field

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
        pos_name = pos_mapping[pos_code][0] if pos_code in pos_mapping else pos_code

        # Build section for this POS
        section_parts = [f"<b>{pos_name}</b>"]

        # Add each example
        for example in examples:
            if isinstance(example, dict) and "Traditional" in example and "English" in example:
                chinese = example["Traditional"]
                english = example["English"]
                if english_only:
                    section_parts.append(english)
                else:
                    section_parts.append(f'{chinese}<br><span style="color: gray;">{english}</span>')

        # Join examples within a POS with single line break
        pos_sections.append("<br>".join(section_parts))

    # Join different POS sections with double line break
    return "<br><br>".join(pos_sections)


def build_examples_html_updates(note_info: AnkiNoteInfo, examples_json_str: str, pos_mapping: dict[str, Any]) -> dict[str, str]:
    """
    Build the updates for the HTML formatted Examples fields that the note has.
    "Examples" holds Chinese + English, "Examples English" only the translations.

    Args:
        note_info (dict): Note information dictionary
        examples_json_str (str): The (possibly updated) Examples JSON value
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions

    Returns:
        dict: Field name mapped to its new value, only for fields that change
    """
    updates: dict[str, str] = {}
    for field_name, english_only in (("Examples", False), ("Examples English", True)):
        if field_name not in note_info["fields"]:
            continue

        new_examples_html = format_examples_as_html(examples_json_str, pos_mapping, english_only=english_only)
        if new_examples_html and get_field_value(note_info, field_name) != new_examples_html:
            updates[field_name] = new_examples_html

    return updates


def merge_examples_json(examples_json_str: str, new_examples: dict[str, Any]) -> str:
    """
    Append newly generated examples to an existing Examples JSON value,
    skipping sentences that are already present.

    Existing examples are kept, so a Sentence Traditional picked from them
    stays valid (and keeps its Sentence Audio).

    Args:
        examples_json_str (str): Existing Examples JSON value (may be empty)
        new_examples (dict): {<POS>: [{"Traditional": ..., "English": ...}]}

    Returns:
        str: The merged Examples JSON value
    """
    merged: dict[str, list[dict[str, str]]] = {}
    if examples_json_str.strip():
        merged = json.loads(examples_json_str)

    existing_sentences = set(extract_example_sentences(examples_json_str))
    for pos_code, examples in new_examples.items():
        for example in examples:
            if example["Traditional"].strip() in existing_sentences:
                continue
            merged.setdefault(pos_code, []).append(example)
            existing_sentences.add(example["Traditional"].strip())

    return json.dumps(merged, ensure_ascii=False)


def extract_tagged_values(
    tags: list[str], prefix: str, suffix_map: dict[str, str] | None = None, separator: str = ", ", sort: bool = True
) -> str:
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


def extract_props_from_tags(tags: list[str], prop_hanzi_map: dict[str, str]) -> str:
    """
    Extract and process tags that start with 'prop::'

    Args:
        tags (list): List of tags from a note
        prop_hanzi_map (dict): Dictionary mapping prop names to Hanzi characters

    Returns:
        str: Comma-separated props with Hanzi (sorted alphabetically)
    """
    return extract_tagged_values(tags, "prop::", prop_hanzi_map, ", ", True)


def extract_mnemonic_pegs(tags: list[str]) -> str:
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


def extract_anki_tags(tags: list[str]) -> str:
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
    note_ids = find_notes_by_query("note:Props")

    if not note_ids:
        raise Exception("No Props notes found")

    print(f"Found {len(note_ids)} Props notes")

    # Get detailed information about all Props notes
    notes_info = get_notes_info(note_ids)

    # Create the mapping
    prop_hanzi_map = {}
    for note_info in notes_info:
        prop_name = get_field_value(note_info, "Prop")
        hanzi = get_field_value(note_info, "Hanzi")

        if prop_name and hanzi:
            prop_hanzi_map[prop_name] = hanzi

    print(f"Created mapping for {len(prop_hanzi_map)} props")
    return prop_hanzi_map


def load_pinyin_mappings():
    """
    Load all enabled Hanzi notes and create mappings from pinyin/syllable to traditional characters.

    Returns:
        tuple: (pinyin_to_chars, syllable_to_chars, known_characters) - dictionaries
            mapping pinyin/syllables to lists of traditional characters, plus the set
            of all known Traditional characters from those notes
    """
    # Search for all enabled (non-suspended) Hanzi notes
    note_ids = find_notes_by_query("note:Hanzi -is:suspended")

    if not note_ids:
        raise Exception("No Hanzi notes found")

    print(f"Found {len(note_ids)} enabled Hanzi notes")

    # Get detailed information about all Hanzi notes
    notes_info = get_notes_info(note_ids)

    # Create both mappings and collect the known characters
    pinyin_to_chars: dict[str, list[str]] = {}
    syllable_to_chars: dict[str, list[str]] = {}
    known_characters: set[str] = set()

    for note_info in notes_info:
        traditional = get_field_value(note_info, "Traditional")
        pinyin_accented = get_field_value(note_info, "Pinyin")

        if traditional:
            known_characters.update(extract_all_characters(traditional))

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
    print(f"Loaded {len(known_characters)} known characters")
    return pinyin_to_chars, syllable_to_chars, known_characters


def find_notes_with_tags(note_type: str, include_empty_pos: bool = False, include_empty_examples: bool = False) -> list[int]:
    """
    Find notes that have prop::, actor::, place::, tone:: tags, non-empty POS field,
    empty ID, need Same Syllable Traditional field filled, have empty POS field,
    or need Examples JSON field filled

    Args:
        note_type (str): The note type to search
        include_empty_pos (bool): Whether to include notes with empty POS field
        include_empty_examples (bool): Whether to include notes with an empty
            Examples JSON, Examples, or Examples English field

    Returns:
        list: List of note IDs
    """
    # Build the base conditions for all note types
    base_conditions = (
        "-is:suspended (tag:prop::* OR tag:actor::* OR tag:place::* OR tag:tone::* "
        'OR tag:chinese::category::* OR (POS:_* "POS Description:") OR "ID:")'
    )

    # For Hanzi notes, also include notes that need Same Pinyin/Syllable Traditional fields filled
    if note_type == "Hanzi":
        search_query = f'note:{note_type} -is:suspended ({base_conditions} OR "Same Pinyin Traditional:" OR "Same Syllable Traditional:")'
    elif note_type == "TOCFL":
        conditions = [base_conditions]
        if include_empty_pos:
            # Include unsuspended TOCFL notes with empty POS field for AI suggestion
            conditions.append('(-is:suspended "POS:")')
        if include_empty_examples:
            # Include unsuspended TOCFL notes with an empty Examples JSON/Examples/Examples English field
            conditions.append('(-is:suspended ("Examples JSON:" OR "Examples:" OR "Examples English:"))')
        search_query = f"note:{note_type} ({' OR '.join(conditions)})"
    else:
        search_query = f"note:{note_type} {base_conditions}"

    print(search_query)
    note_ids = find_notes_by_query(search_query)

    if note_ids:
        print(f"Found {len(note_ids)} note(s) with relevant tags in {note_type}")
    else:
        print(f"No notes found with relevant tags in {note_type}")
    return note_ids


def extract_example_sentences(examples_json_str: str) -> dict[str, str]:
    """
    Extract all Traditional example sentences and their English translations
    from an Examples JSON value.

    Args:
        examples_json_str (str): JSON string in the format
            {"<POS_CODE>": [{"Traditional": <sentence>, "English": <translation>}]}

    Returns:
        dict: Every non-empty Traditional sentence mapped to its English
            translation (in order of appearance), or {} if there are none
    """
    if not examples_json_str or not examples_json_str.strip():
        return {}

    try:
        examples_dict = json.loads(examples_json_str)
    except json.JSONDecodeError:
        return {}

    sentences: dict[str, str] = {}
    if isinstance(examples_dict, dict):
        for examples in examples_dict.values():
            if not isinstance(examples, list):
                continue
            for example in examples:
                if isinstance(example, dict):
                    sentence = example.get("Traditional", "").strip()
                    if sentence and sentence not in sentences:
                        sentences[sentence] = example.get("English", "").strip()

    return sentences


def pick_random_sentence(sentences: list[str], known_characters: set[str], exclude: set[str]) -> str:
    """
    Pick one example sentence at random.

    Only sentences whose Chinese characters are all present in known_characters
    and which are not in exclude are eligible; everything else is filtered out first.

    Args:
        sentences (list): Candidate Traditional sentences
        known_characters (set): Set of Chinese characters the learner already knows
        exclude (set): Sentences that must not be picked (e.g. already used ones)

    Returns:
        str: A randomly chosen eligible sentence, or "" if none is eligible
    """
    eligible_sentences = [
        sentence for sentence in sentences if sentence not in exclude and extract_all_characters(sentence).issubset(known_characters)
    ]

    if not eligible_sentences:
        return ""

    return random.choice(eligible_sentences)


# Maximum number of times Examples JSON is regenerated for one note while
# looking for sentences that are composed entirely of known characters
MAX_EXAMPLES_REGENERATIONS = 3


def find_unknown_characters(sentences: list[str], known_characters: set[str]) -> set[str]:
    """
    Collect the Chinese characters used in the sentences that are not known.

    Args:
        sentences (list): Traditional sentences
        known_characters (set): Set of Chinese characters the learner already knows

    Returns:
        set: Characters that appear in the sentences but not in known_characters
    """
    unknown: set[str] = set()
    for sentence in sentences:
        unknown.update(extract_all_characters(sentence) - known_characters)
    return unknown


def pick_sentence_pair(sentences: list[str], known_characters: set[str], current_sentence: str, current_sentence_2: str) -> tuple[str, str]:
    """
    Pick the values for Sentence Traditional and Sentence 2 Traditional.

    A non-empty current value is kept; an empty one is picked at random with
    pick_random_sentence, always different from the other sentence.

    Args:
        sentences (list): Candidate Traditional sentences
        known_characters (set): Set of Chinese characters the learner already knows
        current_sentence (str): Current Sentence Traditional value (may be empty)
        current_sentence_2 (str): Current Sentence 2 Traditional value (may be empty)

    Returns:
        tuple: (sentence, sentence_2), each "" if no eligible sentence exists
    """
    sentence = current_sentence or pick_random_sentence(sentences, known_characters, exclude={current_sentence_2})
    sentence_2 = current_sentence_2 or pick_random_sentence(sentences, known_characters, exclude={sentence})
    return sentence, sentence_2


def build_sentence_updates(fields: dict[str, Any], sentence: str, english: str) -> dict[str, str]:
    """
    Build the updates for setting Sentence Traditional to a new sentence.

    Sentence Audio is always emptied, because it no longer matches the new
    sentence; fill_audio_anki.py fills an empty Sentence Audio.

    Args:
        fields (dict): The note's fields
        sentence (str): The new Sentence Traditional value
        english (str): The translation, stored in Sentence English

    Returns:
        dict: Field name mapped to its new value
    """
    updates = {"Sentence Traditional": sentence}
    if "Sentence English" in fields:
        updates["Sentence English"] = english
    if "Sentence Audio" in fields:
        updates["Sentence Audio"] = ""
    return updates


def fill_sentence_traditional_for_due_cards(known_characters: set[str], pos_mapping: dict[str, Any], gemini_client: Any) -> int:
    """
    Fill the Sentence Traditional and Sentence 2 Traditional fields for cards
    that are due (now or within the next 7 days) or new, whose Traditional
    field has fewer than 4 characters.

    For each matching note, every empty field of the two gets a Traditional
    example sentence from Examples JSON whose characters are all known, picked
    at random. The two fields always hold different sentences. Non-empty values
    are never changed. Sentence English and Sentence 2 English are set to the
    translations of the sentences picked for Sentence Traditional and
    Sentence 2 Traditional, and Sentence Audio is emptied whenever Sentence
    Traditional is set.

    When Examples JSON has no eligible sentence for a field, new examples are
    generated with Gemini (instructed to avoid the unknown characters found in
    the existing examples) and appended to Examples JSON, up to
    MAX_EXAMPLES_REGENERATIONS times. Examples and Examples English are
    updated to match.

    Args:
        known_characters (set): Set of Chinese characters the learner already knows
        pos_mapping (dict): Dictionary mapping POS codes to their descriptions
        gemini_client: The Gemini client instance used to regenerate examples

    Returns:
        int: Number of notes updated

    Raises:
        Exception: If a non-empty Sentence Traditional or Sentence 2 Traditional
            does not appear in Examples JSON (it was modified manually), or if
            Sentence Traditional is empty and no eligible sentence exists for it
    """
    # is:due matches cards waiting to be reviewed now (due today or overdue),
    # prop:due<=7 matches cards due within the next 7 days.
    query = "(is:due OR prop:due<=7 OR is:new) -is:suspended"
    print(f"Query: {query}")

    card_ids = find_cards_by_query(query)
    print(f"Found {len(card_ids)} due (within 7 days) or new, non-suspended card(s)")

    if not card_ids:
        return 0

    # Map cards to notes and deduplicate (multiple cards can belong to one note)
    response = cards_to_notes(card_ids)
    note_ids = list(dict.fromkeys(response))
    print(f"Found {len(note_ids)} note(s) for those cards")

    if not note_ids:
        return 0

    notes_info = get_notes_info(note_ids)

    updated = 0
    regenerated = 0
    skipped_no_sentence = 0
    skipped_traditional_too_long = 0
    skipped_sentence_already_filled = 0
    missing_sentence_2 = 0

    for note_info in notes_info:
        note_id = note_info["noteId"]
        fields = note_info.get("fields", {})

        # Only notes that have both fields can be processed
        if "Examples JSON" not in fields or "Sentence Traditional" not in fields:
            continue

        traditional = fields.get("Traditional", {}).get("value", "").strip()
        if not traditional or len(traditional) >= 4:
            skipped_traditional_too_long += 1
            continue

        current_examples_json = fields.get("Examples JSON", {}).get("value", "")
        examples_json_str = current_examples_json
        sentences = extract_example_sentences(examples_json_str)

        # The sentence fields are always picked from Examples JSON, so a value
        # that is not there anymore must have been edited by hand
        current_sentence = fields.get("Sentence Traditional", {}).get("value", "").strip()
        current_sentence_2 = fields.get("Sentence 2 Traditional", {}).get("value", "").strip()
        for field_name, value in (("Sentence Traditional", current_sentence), ("Sentence 2 Traditional", current_sentence_2)):
            if value and value not in sentences:
                raise Exception(
                    f"Note {note_id} ('{traditional}'): {field_name} '{value}' does not appear in Examples JSON (was it modified manually?)"
                )

        # Only fill the sentence fields that are empty
        needs_sentence = not current_sentence
        needs_sentence_2 = "Sentence 2 Traditional" in fields and not current_sentence_2
        if not needs_sentence and not needs_sentence_2:
            skipped_sentence_already_filled += 1
            continue

        if not sentences:
            skipped_no_sentence += 1
            continue

        sentence, sentence_2 = pick_sentence_pair(list(sentences), known_characters, current_sentence, current_sentence_2)

        # Regenerating only helps if the word itself is made of known characters,
        # since every example sentence contains it
        pos_value = fields.get("POS", {}).get("value", "").strip()
        can_regenerate = bool(pos_value) and extract_all_characters(traditional).issubset(known_characters)

        attempt = 0
        while (not sentence or (needs_sentence_2 and not sentence_2)) and can_regenerate and attempt < MAX_EXAMPLES_REGENERATIONS:
            attempt += 1
            avoid_characters = find_unknown_characters(list(sentences), known_characters)
            print(
                f"  Regenerating Examples JSON for '{traditional}' (attempt {attempt}/{MAX_EXAMPLES_REGENERATIONS}),"
                f" avoiding: {''.join(sorted(avoid_characters)) or '(none)'}"
            )
            new_examples = generate_examples_json_with_gemini(
                traditional,
                pos_value,
                pos_mapping,
                gemini_client,
                avoid_characters=avoid_characters,
                existing_sentences=list(sentences),
            )
            examples_json_str = merge_examples_json(examples_json_str, new_examples)
            sentences = extract_example_sentences(examples_json_str)
            sentence, sentence_2 = pick_sentence_pair(list(sentences), known_characters, current_sentence, current_sentence_2)

        fields_to_update: dict[str, str] = {}

        if examples_json_str != current_examples_json:
            fields_to_update["Examples JSON"] = examples_json_str
            fields_to_update.update(build_examples_html_updates(note_info, examples_json_str, pos_mapping))
            regenerated += 1

        if needs_sentence:
            if not sentence:
                raise Exception(
                    f"Note {note_id} ('{traditional}'): No example sentence for Sentence Traditional is composed entirely"
                    f" of known characters (unknown: {''.join(sorted(find_unknown_characters(list(sentences), known_characters)))})"
                )
            fields_to_update.update(build_sentence_updates(fields, sentence, sentences[sentence]))

        if needs_sentence_2:
            if sentence_2:
                fields_to_update["Sentence 2 Traditional"] = sentence_2
                if "Sentence 2 English" in fields:
                    fields_to_update["Sentence 2 English"] = sentences[sentence_2]
            else:
                print(
                    f"Warning: Note {note_id} ('{traditional}'): no second example sentence made of only known characters"
                    f" (unknown: {''.join(sorted(find_unknown_characters(list(sentences), known_characters)))})"
                )
                missing_sentence_2 += 1

        if not fields_to_update:
            continue

        update_note_fields(note_id, fields_to_update)
        for field_name, value in fields_to_update.items():
            print(f"Updated note {note_id} with {field_name}: '{value}'")
        updated += 1

    print(f"Updated {updated} note(s)")
    print(f"Regenerated Examples JSON on {regenerated} note(s)")
    print(f"Skipped {skipped_traditional_too_long} note(s) with empty/Traditional >= 4 chars")
    print(f"Skipped {skipped_sentence_already_filled} note(s) with Sentence Traditional and Sentence 2 Traditional already filled")
    print(f"Skipped {skipped_no_sentence} note(s) with no usable examples")
    print(f"Warning: {missing_sentence_2} note(s) without a suitable Sentence 2 Traditional")
    return updated


def strip_cloze_markup(text: str) -> str:
    """
    Replace every Anki cloze deletion with its answer text.

    Args:
        text (str): Text that may contain cloze markup, e.g. "{{c1::原因::reason}}"

    Returns:
        str: The text with each cloze replaced by its answer, e.g. "原因"
    """
    return CLOZE_PATTERN.sub(r"\1", text)


def strip_cloze_hints(text: str) -> str:
    """
    Remove the optional hint from every Anki cloze deletion.

    Args:
        text (str): Text that may contain cloze markup, e.g. "{{c1::原因::reason}}"

    Returns:
        str: The text with the hints removed, e.g. "{{c1::原因}}"
    """
    return CLOZE_PATTERN.sub(r"{{c1::\1}}", text)


def load_cloze_style_examples() -> list[str]:
    """
    Pick existing TOCFL cloze sentences to show Gemini the expected style and
    complexity. Their hints are removed, since a cloze without a hint is preferred.

    Returns:
        list: Randomly picked cloze sentences, e.g. "今天天氣好{{c1::熱}}。"

    Raises:
        Exception: If there are no existing cloze sentences to learn the style from
    """
    note_ids = find_notes_by_query('note:TOCFL "Sentence Cloze Traditional:_*" -is:suspended')
    candidates = [
        strip_cloze_hints(cloze)
        for note_info in get_notes_info(note_ids)
        if (cloze := get_field_value(note_info, "Sentence Cloze Traditional").strip())
    ]
    if not candidates:
        raise Exception("No existing TOCFL Sentence Cloze Traditional values to use as style examples")
    return random.sample(candidates, min(CLOZE_STYLE_EXAMPLE_COUNT, len(candidates)))


def validate_cloze_sentence(cloze: str, traditional: str) -> str:
    """
    Check a generated cloze sentence.

    Args:
        cloze (str): The generated sentence with cloze markup
        traditional (str): The word that must be clozed

    Returns:
        str: A description of the problem, or "" if the sentence is valid
    """
    answers = CLOZE_PATTERN.findall(cloze)
    if not answers:
        return "the sentence has no {{c1::...}} cloze"
    # Either every cloze is the whole word, or the clozes are the parts of a
    # separable word in order (e.g. "{{c1::看}}了兩次{{c1::病}}" for 看病)
    if not (all(answer == traditional for answer in answers) or "".join(answers) == traditional):
        return f"the cloze answers {answers} are not the word '{traditional}'"
    sentence = strip_cloze_markup(cloze)
    if "{{" in sentence or "}}" in sentence:
        return "the cloze markup is malformed"
    if NON_CHINESE_SCRIPT_PATTERN.search(sentence):
        return "the sentence contains Japanese or Korean script"
    return ""


def generate_cloze_sentence_with_gemini(note_info: AnkiNoteInfo, style_examples: list[str], gemini_client: Any) -> str:
    """
    Use Gemini to write a cloze sentence for a TOCFL note, matching the style
    and complexity of the existing cloze sentences.

    The word should be guessable from the context alone; a hint is only added
    when the context cannot disambiguate it. An invalid sentence (see
    validate_cloze_sentence) is discarded; the note stays empty and is picked
    again in a later run.

    Args:
        note_info (dict): The TOCFL note
        style_examples (list): Existing cloze sentences to imitate
        gemini_client: The Gemini client instance

    Returns:
        str: The cloze sentence, or "" if the generated sentence was invalid
    """
    traditional = get_field_value(note_info, "Traditional")
    avoid_sentences = [s for s in (get_field_value(note_info, f) for f in ("Sentence Traditional", "Sentence 2 Traditional")) if s]
    examples_list = "\n".join(f"- {example}" for example in style_examples)
    avoid_list = "\n".join(f"- {sentence}" for sentence in avoid_sentences) or "(none)"

    prompt = f"""You are a Chinese teacher in Taiwan writing cloze flashcards for a TOCFL learner.

Word: {traditional}
Pinyin: {get_field_value(note_info, "Pinyin")}
Part of speech: {get_field_value(note_info, "POS Description") or get_field_value(note_info, "POS")}
Meaning: {get_field_value(note_info, "Meaning")}

Write ONE natural Taiwan Mandarin sentence in Traditional Chinese that uses this word, with the word
marked as an Anki cloze: {{{{c1::{traditional}}}}}.

Match the style and complexity of these existing cards (about 12-30 characters; a short two-clause
sentence or a short "A:... B:..." dialogue is fine):
{examples_list}

Requirements:
1. The context must make the hidden word guessable WITHOUT a hint: a learner who sees the sentence
   with the word blanked out should be able to tell which word is missing. Prefer contexts where
   near-synonyms would not fit.
2. Do NOT add a hint by default. Only as a last resort, when no natural context can single out the
   word, add a short English hint: {{{{c1::{traditional}::hint}}}}. Most cards should have no hint.
3. If the word is a separable verb, you may split it, clozing each part: {{{{c1::看}}}}了兩次{{{{c1::病}}}}.
4. Use common, everyday vocabulary around the word.
5. Do not reuse these sentences, which the learner has already seen:
{avoid_list}

Reply in this EXACT JSON format (no markdown, no code blocks):
{{"Cloze": "sentence with cloze markup"}}"""

    result = gemini_generate_json(prompt, client=gemini_client, model_name=STRONG_GEMINI_MODEL)
    cloze = result.get("Cloze", "").strip() if isinstance(result, dict) else ""
    problem = validate_cloze_sentence(cloze, traditional) if cloze else "the reply has no Cloze value"
    if problem:
        print(f"  Rejected cloze for '{traditional}': '{cloze}': {problem}")
        return ""
    return cloze


def fill_sentence_cloze_traditional(gemini_client: Any) -> int:
    """
    Fill an empty Sentence Cloze Traditional field on unsuspended TOCFL notes
    whose Traditional is at most MAX_CLOZE_WORD_LENGTH characters long, with a
    sentence generated by Gemini, at most MAX_CLOZE_SENTENCES_PER_RUN notes
    per run. Sentence Cloze English is left empty, to be filled by
    fill_sentence_cloze_english.

    Notes are filled in the order their cloze card comes up in Anki: due now,
    then due within CLOZE_UPCOMING_DAYS days, then new cards in the order they
    are introduced, and finally the rest (e.g. with a suspended cloze card).

    Args:
        gemini_client: The Gemini client instance

    Returns:
        int: Number of notes updated
    """
    query = 'note:TOCFL "Sentence Cloze Traditional:" "Traditional:_*" -is:suspended'
    print(f"Query: {query}")

    notes_info = [
        note_info
        for note_info in get_notes_info(find_notes_by_query(query))
        if len(get_field_value(note_info, "Traditional")) <= MAX_CLOZE_WORD_LENGTH
    ]
    upcoming_note_ids = find_note_ids_in_upcoming_order(f"{query} card:cloze", CLOZE_UPCOMING_DAYS, include_new=True)
    position = {note_id: index for index, note_id in enumerate(upcoming_note_ids)}
    notes_info.sort(key=lambda note_info: position.get(note_info["noteId"], len(position)))
    print(
        f"Found {len(notes_info)} note(s) with empty Sentence Cloze Traditional and Traditional <= {MAX_CLOZE_WORD_LENGTH} chars,"
        f" filling up to {MAX_CLOZE_SENTENCES_PER_RUN}"
    )
    if not notes_info:
        return 0

    style_examples = load_cloze_style_examples()

    updated = 0
    for note_info in notes_info[:MAX_CLOZE_SENTENCES_PER_RUN]:
        note_id = note_info["noteId"]
        traditional = get_field_value(note_info, "Traditional")
        cloze = generate_cloze_sentence_with_gemini(note_info, style_examples, gemini_client)
        if not cloze:
            print(f"Warning: Note {note_id} ('{traditional}'): no valid cloze sentence generated")
            continue

        update_note_fields(note_id, {"Sentence Cloze Traditional": cloze})
        print(f"Updated note {note_id} with Sentence Cloze Traditional: '{cloze}'")
        updated += 1

    return updated


def fill_sentence_cloze_english() -> int:
    """
    Fill an empty Sentence Cloze English field with the Google Translate
    translation of Sentence Cloze Traditional (with the cloze markup removed).

    Returns:
        int: Number of notes updated
    """
    query = '"Sentence Cloze Traditional:_*" "Sentence Cloze English:"'
    print(f"Query: {query}")

    note_ids = find_notes_by_query(query)
    print(f"Found {len(note_ids)} note(s) with Sentence Cloze Traditional but empty Sentence Cloze English")

    updated = 0
    for note_info in iter_notes_info(note_ids):
        note_id = note_info["noteId"]
        sentence = strip_cloze_markup(get_field_value(note_info, "Sentence Cloze Traditional")).strip()
        if not sentence or get_field_value(note_info, "Sentence Cloze English"):
            continue

        translation = translate_text_with_google(sentence)
        update_note_fields(note_id, {"Sentence Cloze English": translation})
        print(f"Updated note {note_id} with Sentence Cloze English: '{sentence}' -> '{translation}'")
        updated += 1

    return updated


def get_same_chars_field_value(traditional: str, key: str, char_mapping: dict[str, list[str]]) -> str:
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
    return "".join(sorted(other_chars))


def update_fields_for_note(
    note_info: AnkiNoteInfo,
    prop_hanzi_map: dict[str, str],
    pos_mapping: dict[str, Any],
    pinyin_to_chars: dict[str, list[str]],
    syllable_to_chars: dict[str, list[str]],
    gemini_client: Any | None = None,
) -> bool:
    """
    Update Props, Mnemonic pegs, Anki Tags, POS, POS Description, Examples JSON,
    Examples, Examples English, Same Pinyin Traditional, and Same Syllable
    Traditional fields for a single note

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
    note_id = note_info["noteId"]
    tags = note_info.get("tags", [])
    fields_to_update = {}

    # Process Props field
    current_props = get_field_value(note_info, "Props")
    new_props = extract_props_from_tags(tags, prop_hanzi_map)

    if new_props and current_props != new_props:
        fields_to_update["Props"] = new_props

    # Process Mnemonic pegs field
    current_pegs = get_field_value(note_info, "Mnemonic pegs")
    new_pegs = extract_mnemonic_pegs(tags)

    if new_pegs and current_pegs != new_pegs:
        fields_to_update["Mnemonic pegs"] = new_pegs

    # Process Anki Tags field (remaining tags not matching special prefixes)
    current_anki_tags = get_field_value(note_info, "Anki Tags")
    new_anki_tags = extract_anki_tags(tags)
    if current_anki_tags != new_anki_tags:
        fields_to_update["Anki Tags"] = new_anki_tags

    # Process POS field - suggest using AI if empty and Traditional ≤ 5 characters
    if "POS" in note_info["fields"] and "POS Description" in note_info["fields"]:
        current_pos = get_field_value(note_info, "POS")
        traditional = get_field_value(note_info, "Traditional")
        meaning = get_field_value(note_info, "Meaning")

        # Use AI to suggest POS if empty, Traditional ≤ 5 chars, and Gemini client available
        if not current_pos and traditional and len(traditional) <= 5 and meaning and gemini_client:
            print(f"  Suggesting POS for '{traditional}' ({meaning})...")
            suggested_pos = suggest_pos_with_gemini(traditional, meaning, pos_mapping, gemini_client)
            if suggested_pos:
                fields_to_update["POS"] = suggested_pos
                current_pos = suggested_pos  # Use for POS Description processing below

        current_pos_desc = get_field_value(note_info, "POS Description")
        new_pos_desc, unknown_codes = format_pos_description(current_pos, pos_mapping)

        if unknown_codes:
            note_identifier = traditional or get_field_value(note_info, "Hanzi") or str(note_id)
            raise ValueError(f"Unknown POS codes in note {note_identifier}: {unknown_codes}")

        if current_pos_desc != new_pos_desc:
            fields_to_update["POS Description"] = new_pos_desc

    # Process Examples JSON field - generate examples for each POS if empty and Traditional ≤ 3 chars
    if "Examples JSON" in note_info["fields"] and "POS" in note_info["fields"]:
        current_examples_json = get_field_value(note_info, "Examples JSON")
        traditional = get_field_value(note_info, "Traditional")
        # Use the potentially updated POS value
        pos_value = fields_to_update.get("POS") or get_field_value(note_info, "POS")

        # Generate examples if empty, Traditional ≤ 3 chars, has POS, and Gemini client available
        if not current_examples_json and traditional and len(traditional) <= 6 and pos_value and gemini_client:
            print(f"  Generating examples for '{traditional}' with POS: {pos_value}...")
            examples_dict = generate_examples_json_with_gemini(traditional, pos_value, pos_mapping, gemini_client)
            if examples_dict:
                fields_to_update["Examples JSON"] = json.dumps(examples_dict, ensure_ascii=False)

        # Use potentially updated Examples JSON or existing one
        examples_json_str = fields_to_update.get("Examples JSON") or current_examples_json
        fields_to_update.update(build_examples_html_updates(note_info, examples_json_str, pos_mapping))

    # Process ID field - only if empty, set to "my_" + Traditional
    if "ID" in note_info["fields"] and "Traditional" in note_info["fields"]:
        current_id = get_field_value(note_info, "ID")
        traditional = get_field_value(note_info, "Traditional")

        if not current_id and traditional:
            fields_to_update["ID"] = f"my_{traditional}"

    # Process Same Pinyin Traditional and Same Syllable Traditional fields - only for Hanzi notes
    if "Traditional" in note_info["fields"] and "Pinyin" in note_info["fields"]:
        traditional = get_field_value(note_info, "Traditional")
        pinyin_accented = get_field_value(note_info, "Pinyin")

        if traditional and pinyin_accented:
            pinyin_lower = pinyin_accented.lower()
            syllable = remove_tone_marks(pinyin_accented)

            # Process Same Pinyin Traditional field (exact pinyin match including tone)
            if "Same Pinyin Traditional" in note_info["fields"]:
                current_value = get_field_value(note_info, "Same Pinyin Traditional")
                new_value = get_same_chars_field_value(traditional, pinyin_lower, pinyin_to_chars)
                if current_value != new_value:
                    fields_to_update["Same Pinyin Traditional"] = new_value

            # Process Same Syllable Traditional field (syllable match without tone)
            if "Same Syllable Traditional" in note_info["fields"]:
                current_value = get_field_value(note_info, "Same Syllable Traditional")
                new_value = get_same_chars_field_value(traditional, syllable, syllable_to_chars)
                if current_value != new_value:
                    fields_to_update["Same Syllable Traditional"] = new_value

    # Only update if there are changes
    if not fields_to_update:
        return False

    print(f"Updating note {note_id}:")
    for field_name, new_value in fields_to_update.items():
        current_value = get_field_value(note_info, field_name)
        print(f"  {field_name}: '{current_value}' -> '{new_value}'")

    # Update the note's fields
    update_note_fields(note_id, fields_to_update)
    print(f"Successfully updated note {note_id}")
    return True


def main():
    """
    Main function to process all note types and update Props, Mnemonic pegs, Anki Tags,
    POS, POS Description, Examples JSON, Same Syllable Traditional,
    Sentence Traditional, Sentence English, Sentence 2 Traditional,
    Sentence 2 English, Sentence Cloze Traditional, and Sentence Cloze English fields
    """
    parse_no_arguments(__doc__)

    # Load the prop to Hanzi mapping first
    print("=== Loading Props mapping ===")
    prop_hanzi_map = load_prop_hanzi_mapping()

    if not prop_hanzi_map:
        raise Exception("Failed to load prop to Hanzi mapping")

    # Load the POS mapping
    print("=== Loading POS mapping ===")
    pos_mapping = load_pos_mapping()
    print(f"Loaded {len(pos_mapping)} POS codes")

    # Load the pinyin/syllable mappings and the set of known characters
    print("=== Loading Pinyin mappings ===")
    pinyin_to_chars, syllable_to_chars, known_characters = load_pinyin_mappings()

    # Create Gemini client for AI-based POS suggestions
    print("=== Creating Gemini client ===")
    gemini_client = create_gemini_client()
    print("Gemini client created successfully")

    note_types = ["Hanzi", "TOCFL"]

    for note_type in note_types:
        print(f"\n=== Processing {note_type} ===")
        # For TOCFL, include notes with empty POS and empty Examples JSON for AI suggestion
        include_empty_pos = note_type == "TOCFL"
        include_empty_examples = note_type == "TOCFL"
        note_ids = find_notes_with_tags(note_type, include_empty_pos=include_empty_pos, include_empty_examples=include_empty_examples)

        if not note_ids:
            continue

        # Notes are fetched in batches rather than all at once
        total_updated = 0
        total_processed = 0

        for note_info in iter_notes_info(note_ids):
            try:
                if update_fields_for_note(note_info, prop_hanzi_map, pos_mapping, pinyin_to_chars, syllable_to_chars, gemini_client):
                    total_updated += 1
                total_processed += 1
            except ValueError as e:
                # Skip notes with validation errors (e.g., unknown POS codes)
                note_id = note_info.get("noteId")
                traditional = get_field_value(note_info, "Traditional")
                print(f"  Skipping note {note_id} ({traditional}): {e}")
                total_processed += 1

        print(f"\nCompleted processing {note_type}")
        print(f"Total processed: {total_processed}, Updated: {total_updated}")

    # Fill Sentence Traditional / Sentence 2 Traditional for due cards with a short Traditional field
    print("\n=== Filling Sentence Traditional and Sentence 2 Traditional for due cards ===")
    sentences_updated = fill_sentence_traditional_for_due_cards(known_characters, pos_mapping, gemini_client)
    print(f"Updated Sentence Traditional / Sentence 2 Traditional on {sentences_updated} note(s)")

    # Generate a small batch of missing Sentence Cloze Traditional values
    print("\n=== Filling Sentence Cloze Traditional with Gemini ===")
    cloze_traditional_updated = fill_sentence_cloze_traditional(gemini_client)
    print(f"Updated Sentence Cloze Traditional on {cloze_traditional_updated} note(s)")

    # Translate Sentence Cloze Traditional into an empty Sentence Cloze English
    print("\n=== Filling Sentence Cloze English with Google Translate ===")
    setup_google_credentials()
    cloze_updated = fill_sentence_cloze_english()
    print(f"Updated Sentence Cloze English on {cloze_updated} note(s)")

    print("\n=== All done! ===")


if __name__ == "__main__":
    main()
