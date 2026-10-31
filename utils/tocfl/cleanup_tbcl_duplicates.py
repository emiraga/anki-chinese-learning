#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Delete suspended TBCL notes that duplicate an existing TOCFL note (temporary cleanup).

Loads every suspended "TOCFL" note tagged TBCL::L1 .. TBCL::L7 (all of its cards
suspended) and looks for a non-TBCL note of type "TOCFL" or "Hanzi" (suspended or
not) with the same Traditional and Pinyin. Such a TBCL note is redundant and gets deleted.

A TBCL note may list several forms, e.g. Traditional "常常/常" with Pinyin
"chángcháng/cháng", or "例(子)" with "lì(zi)". Its forms are looked up in the
Traditional and "Variants" JSON field of the other notes:
- They may be found in one note (常常 with variant 常) or spread over several
  (晚餐 and 晚飯 as separate notes).
- They may be found only as a variant (右 listed in the Variants of 右邊).
- At least one form must be found. A form that is not found must be a single
  character that no other note spells at all (雖然/雖 matches a note 雖然
  without a 雖 variant, but 將 jiāng/jiàng does not match 將 jiāng alone).

Pinyin is compared fuzzily: case, spacing and apostrophes are ignored, and a
syllable matches when its tone is equal, either side is neutral (bàba / bàbà),
or it is the tone-sandhi syllable yi / bu (yíxià / yīxià). Matches that needed
the fuzziness are listed separately so they can be reviewed.

Runs as a dry run by default; pass --delete to actually delete the notes.
"""

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import dragonmapper.transcriptions

# Add shared utils to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    AnkiNoteInfo,
    cards_to_notes,
    delete_notes,
    find_cards_by_query,
    find_notes_by_query,
    get_field_value,
    iter_notes_info,
)

TBCL_TAGS = [f"TBCL::L{level}" for level in range(1, 8)]
TBCL_TAG_QUERY = "(" + " OR ".join(f"tag:{tag}" for tag in TBCL_TAGS) + ")"

TBCL_QUERY = f"note:TOCFL is:suspended {TBCL_TAG_QUERY}"
TBCL_UNSUSPENDED_CARDS_QUERY = f"note:TOCFL -is:suspended {TBCL_TAG_QUERY}"
OTHER_QUERY = "(note:TOCFL OR note:Hanzi) -tag:TBCL::*"

# Syllables whose written tone changes with tone sandhi, so sources disagree.
SANDHI_SYLLABLES = {"yi", "bu"}

# Also accept the full-width slash, parentheses and apostrophe (U+FF0F, U+FF08/U+FF09, U+2019).
FORM_SEPARATOR = re.compile(r"[/\uff0f]")
OPTIONAL_PART = re.compile(r"[(\uff08]([^)\uff09]*)[)\uff09]")
HTML_TAG = re.compile(r"<[^>]+>")
PINYIN_IGNORED = re.compile(r"[\s'\u2019\-·]")
NUMBERED_SYLLABLE = re.compile(r"([a-zü]+)([1-5])")


@dataclass(frozen=True)
class Form:
    """One spelling of a word together with its pinyin."""

    traditional: str
    pinyin: str


@dataclass
class Match:
    tbcl: AnkiNoteInfo
    others: list[AnkiNoteInfo]
    exact: bool
    # No covering note has one of the TBCL forms as its own Traditional.
    only_as_variant: bool
    # Single-character TBCL forms that no other note contains.
    missing: list[Form]


def clean(text: str) -> str:
    return unicodedata.normalize("NFC", HTML_TAG.sub("", text).replace("&nbsp;", " ")).strip()


def expand_optional(traditional: str, pinyin: str) -> list[Form]:
    """Expand "例(子)" / "lì(zi)" into the forms with and without the optional part."""
    if not OPTIONAL_PART.search(traditional):
        return [Form(traditional, pinyin)]
    with_part = Form(OPTIONAL_PART.sub(r"\1", traditional), OPTIONAL_PART.sub(r"\1", pinyin))
    without_part = Form(OPTIONAL_PART.sub("", traditional), OPTIONAL_PART.sub("", pinyin))
    return [with_part, without_part]


def parse_forms(traditional: str, pinyin: str) -> list[Form] | None:
    """
    Split a Traditional / Pinyin field pair into its forms.

    Returns:
        The forms, or None if the two fields list a different number of forms
    """
    traditionals = [t.strip() for t in FORM_SEPARATOR.split(clean(traditional)) if t.strip()]
    pinyins = [p.strip() for p in FORM_SEPARATOR.split(clean(pinyin)) if p.strip()]
    if not traditionals or len(traditionals) != len(pinyins):
        return None
    forms: list[Form] = []
    for t, p in zip(traditionals, pinyins, strict=True):
        forms.extend(expand_optional(t, p))
    return forms


def note_forms(note: AnkiNoteInfo) -> list[Form] | None:
    """
    The forms of a note's Traditional / Pinyin fields.

    When the fields list a different number of forms (e.g. "姊姊/姐姐/姊/姐" with
    "jiějie/jiě"), the forms come from the note's Variants field instead.

    A Hanzi note lists alternate spellings of its character separated by spaces,
    all with the one pinyin (e.g. "并 併 並" with "bìng").

    Returns:
        The forms, or None if they cannot be determined
    """
    if note["modelName"] == "Hanzi":
        pinyin = clean(get_field_value(note, "Pinyin"))
        return [Form(traditional, pinyin) for traditional in clean(get_field_value(note, "Traditional")).split()]
    forms = parse_forms(get_field_value(note, "Traditional"), get_field_value(note, "Pinyin"))
    if forms is not None:
        return forms
    traditionals = set(FORM_SEPARATOR.split(clean(get_field_value(note, "Traditional"))))
    variants = variant_forms(note)
    if not variants or {v.traditional for v in variants} != traditionals:
        return None
    return variants


def variant_forms(note: AnkiNoteInfo) -> list[Form]:
    """Forms listed in a note's "Variants" JSON field."""
    raw = clean(get_field_value(note, "Variants"))
    if not raw:
        return []
    try:
        variants = json.loads(raw)
    except json.JSONDecodeError as e:
        raise Exception(f"Note {note['noteId']} ({get_field_value(note, 'Traditional')}) has invalid Variants JSON: {raw}") from e
    forms: list[Form] = []
    for variant in variants:
        parsed = parse_forms(variant.get("Traditional", ""), variant.get("Pinyin", ""))
        forms.extend(parsed or [])
    return forms


def normalize_pinyin(pinyin: str) -> str:
    return PINYIN_IGNORED.sub("", pinyin.lower()).replace("u:", "ü").replace("v", "ü")


def pinyin_syllables(pinyin: str) -> list[tuple[str, int]] | None:
    """Split pinyin into (toneless syllable, tone) pairs, or None if it cannot be parsed."""
    try:
        numbered = dragonmapper.transcriptions.accented_to_numbered(pinyin)
    except Exception:
        return None
    syllables = NUMBERED_SYLLABLE.findall(numbered)
    if "".join(base + tone for base, tone in syllables) != numbered:
        return None
    return [(base, int(tone)) for base, tone in syllables]


def pinyin_match(a: str, b: str) -> bool | None:
    """
    Compare two pinyin strings.

    Returns:
        True for an exact match, False for a fuzzy match, None for no match
    """
    a, b = normalize_pinyin(a), normalize_pinyin(b)
    if a == b:
        return True
    syllables_a, syllables_b = pinyin_syllables(a), pinyin_syllables(b)
    if syllables_a is None or syllables_b is None or len(syllables_a) != len(syllables_b):
        return None
    for i, ((base_a, tone_a), (base_b, tone_b)) in enumerate(zip(syllables_a, syllables_b, strict=True)):
        if base_a != base_b:
            return None
        # A neutral first syllable marks a different word (哪 na vs 哪 nǎ, 得 de vs 得 dé).
        neutral = i > 0 and 5 in (tone_a, tone_b)
        if tone_a != tone_b and not neutral and base_a not in SANDHI_SYLLABLES:
            return None
    return False


def find_form(form: Form, candidates: list[Form]) -> bool | None:
    """Best pinyin match of `form` among same-spelled candidates (True exact, False fuzzy, None none)."""
    results = [pinyin_match(form.pinyin, c.pinyin) for c in candidates if c.traditional == form.traditional]
    if True in results:
        return True
    if False in results:
        return False
    return None


def find_duplicate(tbcl: AnkiNoteInfo, forms: list[Form], others_by_traditional: dict[str, list[AnkiNoteInfo]]) -> Match | None:
    """
    Find the non-TBCL notes that together cover the forms of a TBCL note.

    Notes whose own Traditional is one of the TBCL forms are preferred over
    notes that only list a form as a variant.

    Returns:
        The match, exact if every found form matched exactly, or None if no form is
        found or a multi-character form is not found
    """
    candidates = {other["noteId"]: other for form in forms for other in others_by_traditional.get(form.traditional, [])}
    eligible: list[tuple[AnkiNoteInfo, list[Form], bool]] = []
    for other in candidates.values():
        primary = note_forms(other) or []
        is_primary = any(find_form(form, primary) is not None for form in forms)
        eligible.append((other, primary + variant_forms(other), is_primary))
    eligible.sort(key=lambda entry: not entry[2])

    covering: dict[int, AnkiNoteInfo] = {}
    missing: list[Form] = []
    exact = True
    only_as_variant = True
    for form in forms:
        results = [(find_form(form, other_forms), other, is_primary) for other, other_forms, is_primary in eligible]
        best = next((r for r in results if r[0] is True), None) or next((r for r in results if r[0] is False), None)
        if best is None:
            # Only a missing spelling may be skipped, not a missing reading of a
            # spelling that is there (將 jiàng next to 將 jiāng, 媽 ma next to 媽 mā).
            other_readings = [f for f in forms if f != form and f.traditional == form.traditional]
            spelling_found = any(f.traditional == form.traditional for _, other_forms, _ in eligible for f in other_forms)
            if len(form.traditional) > 1 or other_readings or spelling_found:
                return None
            missing.append(form)
            continue
        result, other, is_primary = best
        exact = exact and result is True
        only_as_variant = only_as_variant and not is_primary
        covering[other["noteId"]] = other
    if not covering:
        return None
    return Match(tbcl, list(covering.values()), exact, only_as_variant, missing)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--delete", action="store_true", help="Delete the duplicate TBCL notes (default: dry run)")
    args = parser.parse_args()

    tbcl_ids = find_notes_by_query(TBCL_QUERY)
    partially_suspended = set(cards_to_notes(find_cards_by_query(TBCL_UNSUSPENDED_CARDS_QUERY)))
    fully_suspended_ids = [note_id for note_id in tbcl_ids if note_id not in partially_suspended]
    print(f"Found {len(tbcl_ids)} suspended TBCL notes, {len(fully_suspended_ids)} with all cards suspended")

    other_ids = find_notes_by_query(OTHER_QUERY)
    print(f"Found {len(other_ids)} non-TBCL TOCFL and Hanzi notes")

    # Index the other notes by every spelling they contain, for quick lookup.
    others_by_traditional: dict[str, list[AnkiNoteInfo]] = {}
    for note in iter_notes_info(other_ids):
        for form in {f.traditional: f for f in (note_forms(note) or []) + variant_forms(note)}.values():
            others_by_traditional.setdefault(form.traditional, []).append(note)

    matches: list[Match] = []
    unparsable: list[AnkiNoteInfo] = []
    for tbcl in iter_notes_info(fully_suspended_ids):
        forms = note_forms(tbcl)
        if forms is None:
            unparsable.append(tbcl)
            continue
        match = find_duplicate(tbcl, forms, others_by_traditional)
        if match is not None:
            matches.append(match)

    def describe(note: AnkiNoteInfo) -> str:
        variants = ", ".join(f"{f.traditional} {f.pinyin}" for f in variant_forms(note))
        suffix = f"  [variants: {variants}]" if variants else ""
        return f"{get_field_value(note, 'Traditional')} {get_field_value(note, 'Pinyin')} (note {note['noteId']}){suffix}"

    def describe_match(m: Match) -> str:
        missing = f"  (not found: {', '.join(f'{f.traditional} {f.pinyin}' for f in m.missing)})" if m.missing else ""
        return f"  {describe(m.tbcl)}  ->  " + "  +  ".join(describe(other) for other in m.others) + missing

    if unparsable:
        print(f"\n=== {len(unparsable)} TBCL notes skipped: cannot pair Traditional with Pinyin ===")
        for note in unparsable:
            print(f"  {describe(note)}")

    sections = {
        "fuzzy pinyin matches": [m for m in matches if not m.exact],
        "matches spread over several notes": [m for m in matches if len(m.others) > 1],
        "matches found only as a variant": [m for m in matches if m.only_as_variant],
        "matches with single-character forms not found": [m for m in matches if m.missing],
    }
    for title, section in sections.items():
        if section:
            print(f"\n=== {len(section)} {title} ===")
            for m in section:
                print(describe_match(m))

    print(f"\n{len(matches)} duplicate TBCL notes")
    for title, section in sections.items():
        print(f"  {len(section)} {title}")

    if not args.delete:
        print("Dry run, nothing deleted. Pass --delete to delete them.")
        return
    delete_notes([m.tbcl["noteId"] for m in matches])
    print(f"Deleted {len(matches)} notes")


if __name__ == "__main__":
    main()
