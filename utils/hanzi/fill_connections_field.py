#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
#   "dragonmapper",
#   "google-genai",
#   "hanziconv",
#   "opencc-python-reimplemented",
# ]
# ///
"""
Fill the "Connections JSON" field of TOCFL notes with each word's relations to
other words, and render it into the "Connections HTML" and "Meaning Hint" fields.

Connections JSON holds:

    {"v": 4,
     "hint": "<English clue telling the word apart from similar ones, or empty>",
     "synonyms": [{"w": "之後", "diff": "<how this word differs from 之後, in English>"}],
     "antonyms": [{"w": "以前", "diff": "<how this word contrasts with 以前, in English>"}],
     "measure_words": ["輛"],
     "register": "colloquial" | "neutral" | "formal" | "written",
     "region": {"usage": "tw" | "cn" | "both", "equivalents": [{"w": "出租車", "region": "cn"}]},
     "pairs_with": [{"w": "所以", "pattern": "因為…所以…"}]}

Work is done a little at a time: the script starts from unsuspended notes with a
card due today (or overdue), in the order Anki will show them for review, whose Connections JSON is empty or was made with an
older schema version. Each such word is sent
to the model together with the active words it is easily confused with - those
sharing an English gloss, or listed as its synonym/antonym by the MOE dictionary.
Related active words that need connections too are filled by the same call, so
the contrast between two words is written from both sides at once.

Related words that are TOCFL vocabulary beyond Level 5 (遴選, 魂魄) are never
suggested unless they are in the active deck: they are too rare to be worth
contrasting. Words outside TOCFL entirely (多雲, 化妝室) are kept.

Only single words are processed: sentences, phrases longer than 4 characters
and idioms (POS "Id") are skipped. Connections JSON of the current schema
version is never overwritten; clear the field to regenerate it.

Meaning Hint is meant for the front of the meaning card, so it is English only
and never contains Chinese characters, Zhuyin, or the pinyin of the word or of
the words it is contrasted with. The diffs name the Chinese words and belong on
the back, in Connections HTML.

Both rendered fields are refreshed on every run for every note with current
Connections JSON. Connections HTML marks which related words are in the active
deck, and synonyms and antonyms are shown from both sides, so it changes as the
deck grows without needing any model call.
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict, TypeVar, cast

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    AnkiNoteInfo,
    find_cards_by_query,
    find_notes_by_query,
    get_cards_info,
    get_field_value,
    iter_notes_info,
    update_note_fields,
)
from shared.character_conversion import to_simplified
from shared.gemini_utils import STRONG_GEMINI_MODEL, GeminiClient, create_gemini_client, gemini_generate_json
from shared.html_utils import escape_html
from shared.moedict import get_moedict_relations
from shared.pinyin_utils import remove_tone_marks
from shared.review_order import sort_cards_in_review_order
from shared.tocfl_csv import load_tocfl_levels

NOTE_TYPE = "TOCFL"
CONNECTIONS_JSON_FIELD = "Connections JSON"
CONNECTIONS_HTML_FIELD = "Connections HTML"
MEANING_HINT_FIELD = "Meaning Hint"
SCHEMA_VERSION = 4

# A note is a single word (and so gets connections) when its main form is at
# most this long, has no sentence punctuation, and is not an idiom.
MAX_WORD_LENGTH = 4
# Full-width (comma, period, question and exclamation marks, enumeration comma,
# semicolon, colon) and ASCII sentence punctuation, the ellipsis, and whitespace
SENTENCE_PUNCTUATION = re.compile("[\uff0c\u3002\uff1f\uff01\u3001\uff1b\uff1a,.?!\u2026\\s]")
IDIOM_POS = "Id"

CJK_PATTERN = re.compile(r"[㐀-鿿]")
ZHUYIN_PATTERN = re.compile(r"[ㄅ-ㄯˇˋˊ˙]")
LATIN_WORD_PATTERN = re.compile(r"[A-Za-z]{3,}")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
# A CC-CEDICT classifier list, e.g. "CL:輛|辆[liang4],台|台[tai2]"
CEDICT_CLASSIFIERS_PATTERN = re.compile(r"CL:([^/<\n]+)")
CEDICT_CLASSIFIER_PATTERN = re.compile(r"([㐀-鿿]+)(?:\|[㐀-鿿]+)?\[")

# An English gloss shared by more words than this is too generic ("good",
# "thing") to say anything about which words get confused.
MAX_GLOSS_SHARERS = 8
# Size limits of a single model call: words to fill, and words only named for contrast.
MAX_GROUP_TARGETS = 5
MAX_GROUP_CONTEXT = 8
MAX_CANDIDATES = 15
MAX_MEANING_LENGTH = 120
MAX_CONTEXT_MEANING_LENGTH = 60

MAX_HINT_WORDS = 15
MAX_SYNONYMS = 3
MAX_ANTONYMS = 2
MAX_MEASURE_WORDS = 3
REGISTERS = ("colloquial", "neutral", "formal", "written")
REGION_NAMES = {"tw": "Taiwan", "cn": "Mainland China"}
REGION_USAGES = (*REGION_NAMES, "both")

PARALLEL_REQUESTS = 8
GENERATION_ATTEMPTS = 2

T = TypeVar("T")


class WordDiff(TypedDict):
    w: str
    diff: str


class RegionEquivalent(TypedDict):
    w: str
    region: str


class Region(TypedDict):
    usage: str
    equivalents: list[RegionEquivalent]


class Pairing(TypedDict):
    w: str
    pattern: str


class Connections(TypedDict):
    v: int
    hint: str
    synonyms: list[WordDiff]
    antonyms: list[WordDiff]
    measure_words: list[str]
    register: str
    region: Region
    pairs_with: list[Pairing]


@dataclass
class DeckWord:
    """A TOCFL note, reduced to what connections are built from."""

    note_id: int
    word: str
    """The main form: the first of the "/"-separated forms in Traditional."""
    forms: frozenset[str]
    """All spellings of the word: the Traditional forms and the spelling Variants."""
    alternatives: tuple[str, ...]
    """Different words TOCFL lists as Variants of this one (洗手間 for 廁所)."""
    pinyin: str
    pos_codes: tuple[str, ...]
    meaning: str
    cedict_measure_words: tuple[str, ...]
    active: bool
    """Whether the note is unsuspended."""
    connections_json: str
    connections_html: str
    meaning_hint: str


@dataclass
class Group:
    """The words of one model call."""

    targets: list[DeckWord]
    """Words whose Connections JSON is generated."""
    context: list[DeckWord]
    """Related words that already have connections, named only for contrast."""


def strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    return " ".join(HTML_TAG_PATTERN.sub(" ", text).split())


def to_simplified_word(word: str) -> str:
    """Convert every character of a word to its simplified form."""
    return "".join(to_simplified(char) for char in word)


def toneless_pinyin(pinyin: str) -> str:
    """Normalize a pinyin reading for comparison: no tone marks, spaces, apostrophes or case."""
    return re.sub("[\\s'\u2019]", "", remove_tone_marks(strip_html(pinyin)))


def parse_variants(note: AnkiNoteInfo, traditional_forms: list[str]) -> tuple[list[str], list[str]]:
    """
    Split the words in a note's Variants field into spellings and alternatives.

    TOCFL lists different kinds of entries together: other spellings of the same
    word (臺灣 for 台灣, 姐姐 for 姊姊), shortened forms (車 for 車子), and
    different words it accepts in the same slot (洗手間 for 廁所, 醫師 for 醫生).
    An entry is compared with the note's main form only, since the note's
    Simplified field lists the simplified form of every variant. It is a
    spelling when it is one of the Traditional forms, or shares the main form's
    simplified form or toneless pinyin; it is a shortened form when one reading
    starts with the other. The remaining entries are alternatives - the most
    reliable synonym candidates there are.

    Returns:
        (spellings and shortened forms, alternatives), as Traditional words

    Raises:
        ValueError: If the field holds something other than a JSON list of variants
    """
    value = get_field_value(note, "Variants")
    if not value:
        return [], []
    try:
        variants = json.loads(value)
    except json.JSONDecodeError as e:
        raise ValueError(f"Note {note['noteId']}: Variants is not valid JSON: {value!r}") from e
    if not isinstance(variants, list):
        raise ValueError(f"Note {note['noteId']}: Variants is not a JSON list: {value!r}")

    main_form = traditional_forms[0]
    main_simplified = to_simplified_word(main_form)
    main_reading = toneless_pinyin(get_field_value(note, "Pinyin").split("/")[0])

    spellings: list[str] = []
    alternatives: list[str] = []
    for variant in variants:
        if not isinstance(variant, dict) or not variant.get("Traditional"):
            continue
        traditional = str(variant["Traditional"])
        reading = toneless_pinyin(str(variant.get("Pinyin", "")))
        is_same_word = (
            traditional in traditional_forms
            or to_simplified_word(traditional) == main_simplified
            or (bool(reading) and bool(main_reading) and (reading.startswith(main_reading) or main_reading.startswith(reading)))
        )
        (spellings if is_same_word else alternatives).append(traditional)
    return spellings, alternatives


def extract_cedict_measure_words(note: AnkiNoteInfo) -> tuple[str, ...]:
    """Collect the classifiers CC-CEDICT lists in the note's meaning fields."""
    measure_words: dict[str, None] = {}
    for field_name in ("Meaning", "Meaning 2"):
        for classifiers in CEDICT_CLASSIFIERS_PATTERN.findall(get_field_value(note, field_name)):
            for measure_word in CEDICT_CLASSIFIER_PATTERN.findall(classifiers):
                measure_words[measure_word] = None
    return tuple(measure_words)


def load_deck_words() -> list[DeckWord]:
    """
    Load every TOCFL note.

    All notes are needed, not only the active ones: the full TOCFL vocabulary is
    what moedict's candidate relations are filtered against, so that rare or
    literary words never reach the model.

    Raises:
        ValueError: If the note type lacks one of the fields this script fills
    """
    note_ids = find_notes_by_query(f"note:{NOTE_TYPE}")
    active_ids = set(find_notes_by_query(f"note:{NOTE_TYPE} -is:suspended"))
    print(f"Loading {len(note_ids)} {NOTE_TYPE} notes ({len(active_ids)} unsuspended)...")

    words: list[DeckWord] = []
    for note in iter_notes_info(note_ids):
        for field_name in (CONNECTIONS_JSON_FIELD, CONNECTIONS_HTML_FIELD, MEANING_HINT_FIELD):
            if field_name not in note["fields"]:
                raise ValueError(f'Note type {NOTE_TYPE} has no "{field_name}" field')

        traditional_forms = [form.strip() for form in get_field_value(note, "Traditional").split("/") if form.strip()]
        if not traditional_forms:
            continue

        spellings, alternatives = parse_variants(note, traditional_forms)
        words.append(
            DeckWord(
                note_id=note["noteId"],
                word=traditional_forms[0],
                forms=frozenset(traditional_forms + spellings),
                alternatives=tuple(alternatives),
                pinyin=get_field_value(note, "Pinyin"),
                pos_codes=tuple(code.strip() for code in get_field_value(note, "POS").split("/") if code.strip()),
                meaning=strip_html(get_field_value(note, "Meaning 2") or get_field_value(note, "Meaning")),
                cedict_measure_words=extract_cedict_measure_words(note),
                active=note["noteId"] in active_ids,
                connections_json=get_field_value(note, CONNECTIONS_JSON_FIELD),
                connections_html=get_field_value(note, CONNECTIONS_HTML_FIELD),
                meaning_hint=get_field_value(note, MEANING_HINT_FIELD),
            )
        )
    return words


def build_deck_index(words: list[DeckWord]) -> dict[str, DeckWord]:
    """
    Map every spelling to its note, preferring active notes when a spelling is
    shared by several (e.g. a word that is also listed under a longer entry).
    """
    index: dict[str, DeckWord] = {}
    for word in words:
        for form in word.forms:
            existing = index.get(form)
            if existing is None or (word.active and not existing.active):
                index[form] = word
    return index


def is_single_word(word: DeckWord) -> bool:
    """Whether connections apply: a short word rather than a sentence, phrase or idiom."""
    return (
        len(word.word) <= MAX_WORD_LENGTH
        and CJK_PATTERN.search(word.word) is not None
        and SENTENCE_PUNCTUATION.search(word.word) is None
        and IDIOM_POS not in word.pos_codes
    )


def has_current_connections(word: DeckWord) -> bool:
    """
    Whether the note's Connections JSON exists and uses the current schema version.

    Raises:
        json.JSONDecodeError: If the note's Connections JSON is not valid JSON
    """
    if not word.connections_json:
        return False
    stored = json.loads(word.connections_json)
    return isinstance(stored, dict) and stored.get("v") == SCHEMA_VERSION


def needs_connections(word: DeckWord) -> bool:
    """Whether this note should get Connections JSON generated now."""
    return word.active and is_single_word(word) and not has_current_connections(word)


def extract_glosses(meaning: str) -> set[str]:
    """
    Split an English meaning into normalized glosses, for finding words that
    translate the same way ("to study / to learn" -> {"study", "learn"}).
    """
    meaning = re.sub(r"\([^)]*\)|\[[^\]]*\]|CL:\S+", " ", meaning)
    glosses: set[str] = set()
    for gloss in re.split(r"[,/;]", meaning):
        normalized = re.sub(r"^\s*(to|a|an|the)\s+", "", gloss.strip().lower()).strip(" .!?")
        if 2 < len(normalized) < 25:
            glosses.add(normalized)
    return glosses


def build_gloss_index(active_words: list[DeckWord]) -> tuple[dict[int, set[str]], dict[str, list[DeckWord]]]:
    """
    Index the active single words by English gloss.

    Returns:
        (glosses of each note id, words of each gloss shared by 2 to
        MAX_GLOSS_SHARERS words)
    """
    glosses_by_note = {word.note_id: extract_glosses(word.meaning) for word in active_words if is_single_word(word)}
    words_by_gloss: dict[str, list[DeckWord]] = defaultdict(list)
    for word in active_words:
        for gloss in glosses_by_note.get(word.note_id, ()):
            words_by_gloss[gloss].append(word)
    shared = {gloss: words for gloss, words in words_by_gloss.items() if 2 <= len(words) <= MAX_GLOSS_SHARERS}
    return glosses_by_note, shared


class RelationFinder:
    """Finds the active words a word is easily confused with."""

    def __init__(self, deck_index: dict[str, DeckWord], active_words: list[DeckWord], tocfl_levels: dict[str, str]) -> None:
        self.deck_index = deck_index
        self.tocfl_levels = tocfl_levels
        self.glosses_by_note, self.words_by_gloss = build_gloss_index(active_words)
        self._moedict_cache: dict[str, tuple[list[str], list[str]]] = {}

    def is_too_advanced(self, word: str) -> bool:
        """
        Whether a related word is too rare to suggest: TOCFL vocabulary beyond
        Level 5 (a TOCFL note missing from the Level 1-5 lists) that the learner
        does not study. Words outside TOCFL are not judged.
        """
        entry = self.deck_index.get(word)
        return entry is not None and not entry.active and word not in self.tocfl_levels

    def prefetch_moedict(self, words: list[DeckWord]) -> None:
        """Download the moedict entries of many words in parallel (cached on disk afterwards)."""
        missing = [word.word for word in words if word.word not in self._moedict_cache]
        with ThreadPoolExecutor(max_workers=PARALLEL_REQUESTS) as executor:
            for word, relations in zip(missing, executor.map(get_moedict_relations, missing), strict=True):
                self._moedict_cache[word] = relations

    def candidates(self, word: DeckWord) -> tuple[list[str], list[str]]:
        """
        The candidate synonyms and antonyms of a word: its TOCFL alternatives
        first, then the moedict relations that are TOCFL vocabulary.

        Returns:
            (synonyms, antonyms), each at most MAX_CANDIDATES long
        """
        if word.word not in self._moedict_cache:
            self._moedict_cache[word.word] = get_moedict_relations(word.word)
        synonyms, antonyms = self._moedict_cache[word.word]

        def keep(related: list[str]) -> list[str]:
            candidates = dict.fromkeys(related)
            return [w for w in candidates if w in self.deck_index and w not in word.forms and not self.is_too_advanced(w)][:MAX_CANDIDATES]

        return keep([*word.alternatives, *synonyms]), keep(antonyms)

    def related_active_words(self, word: DeckWord) -> list[DeckWord]:
        """
        Active single words related to a word: its moedict synonyms and antonyms
        first, then the words sharing one of its English glosses.
        """
        synonyms, antonyms = self.candidates(word)
        related: dict[int, DeckWord] = {}
        for candidate in synonyms + antonyms:
            entry = self.deck_index[candidate]
            if entry.active and is_single_word(entry):
                related[entry.note_id] = entry
        for gloss in sorted(self.glosses_by_note.get(word.note_id, ())):
            for entry in self.words_by_gloss.get(gloss, ()):
                related[entry.note_id] = entry
        related.pop(word.note_id, None)
        return [entry for entry in related.values() if not (entry.forms & word.forms)]


def build_groups(start_words: list[DeckWord], finder: RelationFinder) -> list[Group]:
    """
    Group each starting word with its related words.

    A starting word's related words that still need connections join it as
    targets (up to MAX_GROUP_TARGETS in total); the remaining related words are
    passed as context. Every word is a target of at most one group.
    """
    assigned: set[int] = set()
    groups: list[Group] = []
    for start in start_words:
        if start.note_id in assigned:
            continue
        related = finder.related_active_words(start)
        joining = [word for word in related if needs_connections(word) and word.note_id not in assigned]
        targets = [start, *joining[: MAX_GROUP_TARGETS - 1]]
        target_ids = {word.note_id for word in targets}
        context = [word for word in related if word.note_id not in target_ids][:MAX_GROUP_CONTEXT]
        assigned |= target_ids
        groups.append(Group(targets=targets, context=context))
    return groups


PROMPT_INSTRUCTIONS = """You are a Chinese language expert helping a learner of Taiwan Mandarin tell similar words apart.

For EACH target word return an object:
{"w": "<the target word, exactly as given>",
 "hint": "<English clue, see rules>",
 "synonyms": [{"w": "<word>", "diff": "<how the TARGET word differs from this one>"}],
 "antonyms": [{"w": "<word>", "diff": "<how the TARGET word contrasts with this one>"}],
 "measure_words": ["<measure word>"],
 "register": "colloquial" | "neutral" | "formal" | "written",
 "region": {"usage": "tw" | "cn" | "both", "equivalents": [{"w": "<word>", "region": "tw" | "cn"}]},
 "pairs_with": [{"w": "<word>", "pattern": "<e.g. 因為…所以…>"}]}

Rules:
- Use Traditional characters and the perspective of Taiwan Mandarin.
- "hint" is shown on a flashcard that gives the English meaning and asks the learner to recall the
  Chinese target word. In ENGLISH, at most 12 words, it adds what the meaning lacks to pick the target
  over its near-synonyms among the target and context words (陰天: "fully overcast all day, not just
  partly cloudy"). It MUST NOT contain Chinese characters, pinyin or zhuyin, and MUST NOT translate the
  characters literally or explain their etymology (not "literally hand-washing room"), since that gives
  the answer away. Use "" when no target or context word could be confused with the target, rather
  than restating the meaning.
- "diff" (of synonyms and antonyms) MUST be written in ENGLISH, at most 25 words. Chinese only for the words themselves, and it
  names both words in Chinese (never "the target" or "this word"): "陰天 is fully overcast, whereas 多雲 ...".
- synonyms: at most 3 real near-synonyms. Every other target or context word that is a near-synonym
  of the target MUST be listed before any candidate; use the candidates only for the remaining slots.
  Common words only, never obscure or literary ones. Words that only share an English translation but
  mean something else are NOT synonyms.
- antonyms: at most 2, and only an opposite a native speaker would name immediately (高興/難過,
  晴天/陰天). Related roles (店員/老闆), loose contrasts (發明/模仿) and rare words are NOT antonyms; when
  unsure, use []. Correlative partners (雖然/但是, 因為/所以) are NOT antonyms; put them in pairs_with.
- measure_words: the common Taiwan measure words of a noun; [] for other parts of speech.
- region.equivalents: only a well-established regional pair - a DIFFERENT word with the same meaning
  used in the other region (計程車 tw vs 出租車 cn, 公車 tw vs 公交車 cn). A simplified spelling of the
  same word is NOT an equivalent. When unsure, or when usage is "both", use [].
- pairs_with: fixed correlative pairings only; "w" is a single word (先 for 先…然後…).
- Never list spelling variants of the target word. Empty lists are fine.
- Proper nouns (places, people, countries, organizations: 嘉義市, 伊斯坦堡) and literal phrases whose
  meaning is just the sum of their words (一些花, 很多人) have nothing worth contrasting: give them an
  empty hint, empty lists, register "neutral" and region usage "both".

Output a JSON array with exactly one object per target word, nothing else."""


def build_prompt(group: Group, finder: RelationFinder) -> str:
    """Build the model prompt for one group, keeping each word's input compact."""
    target_lines: list[str] = []
    for word in group.targets:
        synonyms, antonyms = finder.candidates(word)
        entry: dict[str, object] = {
            "w": word.word,
            "pinyin": word.pinyin,
            "pos": "/".join(word.pos_codes),
            "meaning": word.meaning[:MAX_MEANING_LENGTH],
            "synonym_candidates": synonyms,
            "antonym_candidates": antonyms,
            "dictionary_measure_words": list(word.cedict_measure_words),
        }
        target_lines.append(json.dumps({key: value for key, value in entry.items() if value}, ensure_ascii=False))

    prompt = PROMPT_INSTRUCTIONS + "\n\nTarget words:\n" + "\n".join(target_lines)
    if group.context:
        context_lines = [f"{word.word} ({word.meaning[:MAX_CONTEXT_MEANING_LENGTH]})" for word in group.context]
        prompt += "\n\nOther words the learner knows (for contrast only, no output for them):\n" + "\n".join(context_lines)
    return prompt


def require(obj: object, key: str, kind: type[T], where: str) -> T:
    """
    Read a key of a JSON object, checking the value's type.

    Raises:
        ValueError: If obj is not an object, or the key is missing or of another type
    """
    if not isinstance(obj, dict):
        raise ValueError(f"{where}: expected a JSON object, got {obj!r}")
    value = cast("dict[str, object]", obj).get(key)
    if not isinstance(value, kind):
        raise ValueError(f"{where}: expected {key!r} to be {kind.__name__}, got {value!r}")
    return value


def find_hint_leak(hint: str, group_words: list[DeckWord]) -> str | None:
    """
    Find what in a hint would give a word away on the front of the meaning card.

    Args:
        hint: The hint to check
        group_words: The words of the hint's group (targets and context), whose
            pinyin must not appear in the hint either

    Returns:
        A description of the leak, or None when the hint is safe
    """
    if CJK_PATTERN.search(hint) or ZHUYIN_PATTERN.search(hint):
        return "Chinese characters or Zhuyin"

    lowered = hint.lower()
    for word in group_words:
        for reading in re.split(r"[,/;]", strip_html(word.pinyin)):
            accented = reading.strip().lower().replace(" ", "")
            if not accented:
                continue
            toneless = remove_tone_marks(accented)
            # Tone-marked pinyin never occurs in English, so it is searched for
            # anywhere; a reading without tone marks (吧 "ba") would match inside
            # English words ("bad") and goes through the whole-word check instead
            if accented != toneless and accented in lowered.replace(" ", ""):
                return f"the pinyin of {word.word} ({accented})"
            # Toneless single syllables are too often English words ("men", "you")
            if len(word.word) >= 2 and re.search(rf"\b{re.escape(toneless)}\b", lowered):
                return f"the pinyin of {word.word} ({toneless})"
    return None


def clean_connections(item: object, target: DeckWord, group_words: list[DeckWord], finder: RelationFinder) -> Connections:
    """
    Validate one word's connections from the model reply, and remove what the
    prompt rules forbid but models still produce: the word's own spellings,
    synonyms and antonyms too rare to suggest, correlative partners listed as
    antonyms, simplified spellings listed as regional equivalents, and lists
    over their size limit.

    Raises:
        ValueError: If the reply's structure is wrong, a diff is not in English,
            or the hint is too long or would give a word away
    """
    where = f"Connections of {target.word}"

    hint = require(item, "hint", str, where).strip()
    if len(hint.split()) > MAX_HINT_WORDS:
        raise ValueError(f"{where}: the hint is longer than {MAX_HINT_WORDS} words: {hint!r}")
    leak = find_hint_leak(hint, group_words)
    if leak is not None:
        raise ValueError(f"{where}: the hint contains {leak}: {hint!r}")

    def clean_word_diffs(key: str, excluded: set[str]) -> list[WordDiff]:
        """Validate a list of related words with diffs, skipping the excluded and too rare ones."""
        cleaned: list[WordDiff] = []
        for related in require(item, key, list, where):
            w = require(related, "w", str, where).strip()
            diff = require(related, "diff", str, where).strip()
            if w in excluded or finder.is_too_advanced(w) or any(c["w"] == w for c in cleaned):
                continue
            if not LATIN_WORD_PATTERN.search(diff):
                raise ValueError(f"{where}: the diff for {w} is not in English: {diff!r}")
            # "target" is ordinary English (目標 "a concrete target"), so check the
            # rule itself: the diff names the word rather than "the target word"
            if not any(form in diff for form in target.forms):
                raise ValueError(f"{where}: the diff for {w} does not name {target.word}: {diff!r}")
            cleaned.append({"w": w, "diff": diff})
        return cleaned

    synonyms = clean_word_diffs("synonyms", set(target.forms))

    pairs_with: list[Pairing] = []
    for pairing in require(item, "pairs_with", list, where):
        w = require(pairing, "w", str, where).strip()
        pattern = require(pairing, "pattern", str, where).strip()
        if w and pattern and w not in target.forms and "…" not in w and "..." not in w:
            pairs_with.append({"w": w, "pattern": pattern})

    antonyms = clean_word_diffs("antonyms", set(target.forms) | {s["w"] for s in synonyms} | {p["w"] for p in pairs_with})

    measure_words: list[str] = []
    for measure_word in require(item, "measure_words", list, where):
        if not isinstance(measure_word, str):
            raise ValueError(f"{where}: measure word {measure_word!r} is not a string")
        measure_word = measure_word.strip()
        if 1 <= len(measure_word) <= 2 and all(CJK_PATTERN.match(char) for char in measure_word) and measure_word not in measure_words:
            measure_words.append(measure_word)

    register = require(item, "register", str, where)
    if register not in REGISTERS:
        raise ValueError(f"{where}: unknown register {register!r}")

    region = require(item, "region", dict, where)
    usage = require(region, "usage", str, where)
    if usage not in REGION_USAGES:
        raise ValueError(f"{where}: unknown region usage {usage!r}")
    simplified_word = to_simplified_word(target.word)
    equivalents: list[RegionEquivalent] = []
    for equivalent in require(region, "equivalents", list, where):
        w = require(equivalent, "w", str, where).strip()
        equivalent_region = require(equivalent, "region", str, where)
        if equivalent_region not in REGION_NAMES:
            raise ValueError(f"{where}: unknown region {equivalent_region!r}")
        if w and w not in target.forms and to_simplified_word(w) != simplified_word:
            equivalents.append({"w": w, "region": equivalent_region})

    return {
        "v": SCHEMA_VERSION,
        "hint": hint,
        "synonyms": synonyms[:MAX_SYNONYMS],
        "antonyms": antonyms[:MAX_ANTONYMS],
        "measure_words": measure_words[:MAX_MEASURE_WORDS],
        "register": register,
        "region": {"usage": usage, "equivalents": equivalents},
        "pairs_with": pairs_with,
    }


def parse_reply(reply: object, group: Group, finder: RelationFinder) -> dict[int, Connections]:
    """
    Match the model's reply to the group's targets and clean each entry.

    Returns:
        Connections of each target, by note id

    Raises:
        ValueError: If the reply is not a list, or lacks a target word
    """
    if not isinstance(reply, list):
        raise ValueError(f"Expected a JSON array, got {reply!r}")
    items_by_word = {require(item, "w", str, "Reply item").strip(): item for item in cast("list[object]", reply)}

    group_words = group.targets + group.context
    result: dict[int, Connections] = {}
    for target in group.targets:
        item = next((items_by_word[form] for form in [target.word, *sorted(target.forms)] if form in items_by_word), None)
        if item is None:
            raise ValueError(f"The reply has no entry for {target.word}; it has {sorted(items_by_word)}")
        result[target.note_id] = clean_connections(item, target, group_words, finder)
    return result


def generate_group(group: Group, finder: RelationFinder, client: GeminiClient) -> dict[int, Connections]:
    """
    Generate the connections of a group's targets, retrying a malformed reply.

    Raises:
        Exception: If generation fails, or every attempt gives a malformed reply
    """
    prompt = build_prompt(group, finder)
    last_error: ValueError | None = None
    for attempt in range(1, GENERATION_ATTEMPTS + 1):
        try:
            return parse_reply(gemini_generate_json(prompt, client=client, model_name=STRONG_GEMINI_MODEL), group, finder)
        except ValueError as e:
            last_error = e
            print(f"  Malformed reply for {[t.word for t in group.targets]} (attempt {attempt}/{GENERATION_ATTEMPTS}): {e}")
    raise Exception(f"No valid reply for {[t.word for t in group.targets]} after {GENERATION_ATTEMPTS} attempts") from last_error


def generate_all(groups: list[Group], finder: RelationFinder, dry_run: bool) -> int:
    """
    Run the groups' model calls in parallel and save each result as it arrives,
    so that the work already done is kept if a later call fails.

    Returns:
        Number of notes filled
    """
    client = create_gemini_client()
    filled = 0
    executor = ThreadPoolExecutor(max_workers=PARALLEL_REQUESTS)
    try:
        futures: dict[Future[dict[int, Connections]], Group] = {
            executor.submit(generate_group, group, finder, client): group for group in groups
        }
        for done, future in enumerate(as_completed(futures), 1):
            group = futures[future]
            connections_by_note = future.result()
            context = f" (context: {' '.join(w.word for w in group.context)})" if group.context else ""
            print(f"[{done}/{len(groups)}] {' '.join(t.word for t in group.targets)}{context}")
            for target in group.targets:
                value = json.dumps(connections_by_note[target.note_id], ensure_ascii=False)
                print(f"  {target.word}: {value}")
                if not dry_run:
                    update_note_fields(target.note_id, {CONNECTIONS_JSON_FIELD: value})
                target.connections_json = value
                filled += 1
    finally:
        # On failure, do not wait for (or pay for) the calls that have not started yet
        executor.shutdown(cancel_futures=True)
    return filled


GRAY_STYLE = "color: gray;"
# An explanation goes on its own line below its word, indented and smaller
EXPLANATION_STYLE = "display: inline-block; margin: 0 0 0.4em 1em; font-size: 0.85em;"


def is_learned(word: str, deck_index: dict[str, DeckWord]) -> bool:
    """Whether a related word is one the learner studies: a TOCFL note in the active deck."""
    entry = deck_index.get(word)
    return entry is not None and entry.active


def learned_first(words: list[str], deck_index: dict[str, DeckWord]) -> list[str]:
    """Order words so the learned ones come first, keeping the order within each part."""
    return sorted(words, key=lambda word: not is_learned(word, deck_index))


def format_entry(word: str, deck_index: dict[str, DeckWord], explanation: str = "") -> str:
    """
    Format a related word, with its pinyin when known and an optional explanation.

    The word and its pinyin are on one line; the explanation follows on the next
    line, indented and in smaller text. A learned word is bold with gray pinyin.
    A word the learner has not learned is gray and not bold as a whole - pinyin
    and explanation included - so it reads as secondary.
    """
    entry = deck_index.get(word)
    pinyin = escape_html(entry.pinyin) if entry is not None and entry.pinyin else ""
    learned = is_learned(word, deck_index)

    if learned:
        pinyin_html = f' <span style="{GRAY_STYLE}">{pinyin}</span>' if pinyin else ""
        word_line = f"<b>{escape_html(word)}</b>{pinyin_html}"
    else:
        pinyin_text = f" {pinyin}" if pinyin else ""
        word_line = f'<span style="{GRAY_STYLE}">{escape_html(word)}{pinyin_text}</span>'

    if not explanation:
        return word_line
    explanation_style = EXPLANATION_STYLE if learned else f"{EXPLANATION_STYLE} {GRAY_STYLE}"
    return f'{word_line}<br><span style="{explanation_style}">{escape_html(explanation)}</span>'


def render_connections_html(
    connections: Connections, extra_synonyms: list[WordDiff], extra_antonyms: list[WordDiff], deck_index: dict[str, DeckWord]
) -> str:
    """
    Render Connections JSON as HTML, one titled section per non-empty relation.

    In every list, learned words come first and the others follow in gray.

    Args:
        connections: The note's connections
        extra_synonyms: Words that list this word as their synonym, with their
            diff; shown when this word's own connections do not list them back
        extra_antonyms: Words that list this word as their antonym, likewise
        deck_index: Every TOCFL spelling, to mark learned words and show pinyin
    """
    sections: list[list[str]] = []

    def word_diff_lines(own: list[WordDiff], extra: list[WordDiff]) -> list[str]:
        """One entry per related word, with its diff below it, the learned words first."""
        merged = list(own)
        merged += [e for e in extra if all(m["w"] != e["w"] for m in merged)]
        merged.sort(key=lambda related: not is_learned(related["w"], deck_index))
        return [format_entry(related["w"], deck_index, related["diff"]) for related in merged]

    synonym_lines = word_diff_lines(connections["synonyms"], extra_synonyms)
    if synonym_lines:
        sections.append(["Similar words", *synonym_lines])

    antonym_lines = word_diff_lines(connections["antonyms"], extra_antonyms)
    if antonym_lines:
        sections.append(["Opposites", *antonym_lines])

    if connections["pairs_with"]:
        sections.append(["Pairs with", ", ".join(escape_html(p["pattern"]) for p in connections["pairs_with"])])

    if connections["measure_words"]:
        measure_words = learned_first(connections["measure_words"], deck_index)
        sections.append(["Measure words", ", ".join(format_entry(w, deck_index) for w in measure_words)])

    region = connections["region"]
    # Only shown with an equivalent word: "Mainly used in Taiwan" alone tells a
    # learner of Taiwan Mandarin nothing (and is all that place names get)
    equivalents = sorted(region["equivalents"], key=lambda equivalent: not is_learned(equivalent["w"], deck_index))
    if equivalents:
        region_lines = [f"Mainly used in {REGION_NAMES[region['usage']]}"] if region["usage"] in REGION_NAMES else []
        region_lines += [f"{REGION_NAMES[e['region']]}: {format_entry(e['w'], deck_index)}" for e in equivalents]
        sections.append(["Region", *region_lines])

    if connections["register"] != "neutral":
        sections.append(["Register", connections["register"].capitalize()])

    return "<br><br>".join("<br>".join([f"<u>{escape_html(title)}</u>", *lines]) for title, *lines in sections)


def render_all(words: list[DeckWord], deck_index: dict[str, DeckWord], dry_run: bool) -> int:
    """
    Refresh the Connections HTML and Meaning Hint fields of every note whose
    Connections JSON uses the current schema version.

    Returns:
        Number of notes whose fields changed

    Raises:
        json.JSONDecodeError: If a note's Connections JSON is not valid JSON
    """
    with_connections = [word for word in words if has_current_connections(word)]
    parsed: dict[int, Connections] = {word.note_id: json.loads(word.connections_json) for word in with_connections}

    # Both relations are symmetric: show B on A's card when only B's connections
    # list A. A diff names both words, so it reads correctly from either side.
    listed_as_synonym_by: dict[str, list[WordDiff]] = defaultdict(list)
    listed_as_antonym_by: dict[str, list[WordDiff]] = defaultdict(list)
    for word in with_connections:
        for synonym in parsed[word.note_id]["synonyms"]:
            listed_as_synonym_by[synonym["w"]].append({"w": word.word, "diff": synonym["diff"]})
        for antonym in parsed[word.note_id]["antonyms"]:
            listed_as_antonym_by[antonym["w"]].append({"w": word.word, "diff": antonym["diff"]})

    changed = 0
    for word in with_connections:
        forms = sorted(word.forms)
        extra_synonyms = [s for form in forms for s in listed_as_synonym_by.get(form, [])]
        extra_antonyms = [w for form in forms for w in listed_as_antonym_by.get(form, [])]
        rendered = {
            CONNECTIONS_HTML_FIELD: render_connections_html(parsed[word.note_id], extra_synonyms, extra_antonyms, deck_index),
            MEANING_HINT_FIELD: escape_html(parsed[word.note_id]["hint"]),
        }
        if rendered[CONNECTIONS_HTML_FIELD] == word.connections_html and rendered[MEANING_HINT_FIELD] == word.meaning_hint:
            continue
        if not dry_run:
            update_note_fields(word.note_id, rendered)
        word.connections_html = rendered[CONNECTIONS_HTML_FIELD]
        word.meaning_hint = rendered[MEANING_HINT_FIELD]
        changed += 1
    return changed


def select_start_words(args: argparse.Namespace, active_words: list[DeckWord]) -> list[DeckWord]:
    """
    Pick the words to start groups from: the given words, or the due notes in the
    order their first card comes up in Anki's review queue.

    Raises:
        ValueError: If a --word is not an active single word that needs connections
    """
    if args.word:
        start_words: list[DeckWord] = []
        for requested in args.word:
            matches = [word for word in active_words if requested in word.forms]
            if not matches:
                raise ValueError(f"No unsuspended {NOTE_TYPE} note has the word {requested}")
            needing = [word for word in matches if needs_connections(word)]
            if not needing:
                raise ValueError(f"{requested} is not a single word, or its {CONNECTIONS_JSON_FIELD} is up to date (clear it to redo)")
            start_words.extend(needing)
        return start_words

    due_cards = sort_cards_in_review_order(get_cards_info(find_cards_by_query(f"note:{NOTE_TYPE} is:due -is:suspended")))
    due_note_ids = list(dict.fromkeys(card["note"] for card in due_cards))
    words_by_note = {word.note_id: word for word in active_words}
    start_words = [words_by_note[note_id] for note_id in due_note_ids if needs_connections(words_by_note[note_id])]
    print(f"{len(due_note_ids)} due note(s), {len(start_words)} of them single words needing {CONNECTIONS_JSON_FIELD}")
    print(f"In review order: {' '.join(word.word for word in start_words[:10])}{' ...' if len(start_words) > 10 else ''}")
    if args.limit is not None:
        start_words = start_words[: args.limit]
    return start_words


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Generate and print connections without updating notes")
    parser.add_argument("--limit", type=int, metavar="N", help="Start from at most N due notes (related words are filled too)")
    parser.add_argument("--word", nargs="+", metavar="WORD", help="Fill these words (and their related words) instead of the due notes")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    words = load_deck_words()
    deck_index = build_deck_index(words)
    active_words = [word for word in words if word.active]
    finder = RelationFinder(deck_index, active_words, load_tocfl_levels())

    start_words = select_start_words(args, active_words)
    filled = 0
    if start_words:
        print(f"Looking up {len(start_words)} word(s) in moedict...")
        finder.prefetch_moedict(start_words)
        groups = build_groups(start_words, finder)
        print(f"Generating connections with {STRONG_GEMINI_MODEL}: {sum(len(g.targets) for g in groups)} word(s) in {len(groups)} group(s)")
        filled = generate_all(groups, finder, args.dry_run)

    rendered = render_all(words, deck_index, args.dry_run)

    print(f"\nFilled {CONNECTIONS_JSON_FIELD} on {filled} note(s)")
    print(f"Refreshed {CONNECTIONS_HTML_FIELD} and {MEANING_HINT_FIELD} on {rendered} note(s)")
    if args.dry_run:
        print("(DRY RUN - no changes were made)")


if __name__ == "__main__":
    main()
