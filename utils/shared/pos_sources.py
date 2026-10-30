"""
Readers for the downloaded part-of-speech (POS) sources listed in POS_SOURCES.md.

Every source uses its own tag scheme, so the tags are returned as they appear in
the source, without mapping them to the TOCFL codes of `app/data/pos.json`:

- TOCFL: TOCFL codes (V, Vs, Vaux, ...)
- Wiktionary, English and Chinese editions (kaikki.org dumps): verb, noun, ...
- moedict dump: 動, 名, 副, 形, ... (single characters only, in practice)
- jieba `dict.txt.big`: ICTCLAS tags (v, n, d, a, ...)
- Universal Dependencies Chinese GSD: UPOS/XPOS per token in a corpus

The large dumps are read straight from their compressed files. Passing `words`
restricts the entries to those words, which lets the readers skip parsing most
lines.
"""

import gzip
import json
import lzma
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .project_paths import JIEBA_DICT_TXT, KAIKKI_EN_JSONL, KAIKKI_ZH_JSONL, MOEDICT_DUMP_JSON, UD_CHINESE_GSD_DIR
from .tocfl_csv import load_all


@dataclass
class PosEntry:
    word: str
    pos: str
    """Tag in the source's own scheme."""
    detail: str
    """Gloss, definition, level or frequency, depending on the source."""


def _require_file(path: Path) -> Path:
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing, run ./utils/pos/download_pos_sources.py first")
    return path


def read_tocfl(words: set[str] | None = None) -> Iterator[PosEntry]:
    for word in load_all():
        if words is None or word.traditional in words:
            yield PosEntry(word.traditional, ", ".join(word.part_of_speech), f"{word.level}, {word.pinyin}")


def _read_kaikki(path: Path, words: set[str] | None) -> Iterator[PosEntry]:
    # Lines are written with `"word": "<word>"` near the start; checking for the
    # exact substring avoids parsing ~400k JSON lines when only a few words are
    # wanted. Nested objects (synonyms, ...) also contain "word" keys, so the
    # parsed entry is checked again below.
    needles = None if words is None else [f'"word": "{w}"' for w in words]
    with gzip.open(_require_file(path), "rt", encoding="utf-8") as f:
        for line in f:
            if needles is not None and not any(n in line for n in needles):
                continue
            entry: dict[str, Any] = json.loads(line)
            word = entry["word"]
            if words is not None and word not in words:
                continue
            pos = entry["pos"]
            if pos == "soft-redirect":
                continue
            glosses = [gloss for sense in entry.get("senses", []) for gloss in sense.get("glosses", [])[:1]]
            pos_title = entry.get("pos_title")
            yield PosEntry(word, f"{pos} ({pos_title})" if pos_title else pos, "; ".join(glosses))


def read_kaikki_en(words: set[str] | None = None) -> Iterator[PosEntry]:
    """English Wiktionary, Chinese entries. Single characters only get the pos "character"."""
    return _read_kaikki(KAIKKI_EN_JSONL, words)


def read_kaikki_zh(words: set[str] | None = None) -> Iterator[PosEntry]:
    """Chinese Wiktionary (漢語 entries). Many entries only have the generic "unknown (釋義)"."""
    return _read_kaikki(KAIKKI_ZH_JSONL, words)


def read_moedict_dump(words: set[str] | None = None) -> Iterator[PosEntry]:
    """One entry per definition that has a `type`; definitions without one are skipped."""
    with lzma.open(_require_file(MOEDICT_DUMP_JSON), "rt", encoding="utf-8") as f:
        entries: list[dict[str, Any]] = json.load(f)
    for entry in entries:
        title = entry["title"]
        if words is not None and title not in words:
            continue
        for heteronym in entry["heteronyms"]:
            pinyin = heteronym.get("pinyin", "")
            for definition in heteronym.get("definitions", []):
                if "type" in definition:
                    yield PosEntry(title, definition["type"], f"{pinyin}: {definition['def']}")


def read_jieba(words: set[str] | None = None) -> Iterator[PosEntry]:
    """Lines are `<word> <frequency> <tag>`; a word can be listed once per tag."""
    with _require_file(JIEBA_DICT_TXT).open(encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            parts = line.split()
            if len(parts) != 3:
                raise ValueError(f"{JIEBA_DICT_TXT}:{line_num}: expected 3 fields, got {line!r}")
            word, frequency, tag = parts
            if words is None or word in words:
                yield PosEntry(word, tag, f"frequency {frequency}")


def read_ud_gsd(words: set[str] | None = None) -> Iterator[PosEntry]:
    """
    Count how often each word is tagged with each UPOS/XPOS pair in the treebank.

    This is corpus data: the tag depends on the sentence, so a word gets one
    entry per tag it was seen with.
    """
    counts: Counter[tuple[str, str]] = Counter()
    conllu_files = sorted(_require_file(UD_CHINESE_GSD_DIR).glob("*.conllu"))
    if not conllu_files:
        raise FileNotFoundError(f"No .conllu files in {UD_CHINESE_GSD_DIR}")
    for path in conllu_files:
        with path.open(encoding="utf-8") as f:
            for line in f:
                if not line.strip() or line.startswith("#"):
                    continue
                fields = line.split("\t")
                if len(fields) != 10:
                    raise ValueError(f"{path}: expected 10 CoNLL-U fields, got {line!r}")
                # Multi-word token ranges ("1-2") and empty nodes ("1.1") carry no POS.
                if not fields[0].isdigit():
                    continue
                form = fields[1]
                if words is None or form in words:
                    counts[form, f"{fields[3]}/{fields[4]}"] += 1
    for (form, tag), count in counts.most_common():
        yield PosEntry(form, tag, f"{count}x in corpus")


POS_SOURCES = {
    "TOCFL": read_tocfl,
    "Wiktionary (en)": read_kaikki_en,
    "Wiktionary (zh)": read_kaikki_zh,
    "moedict": read_moedict_dump,
    "jieba": read_jieba,
    "UD Chinese GSD": read_ud_gsd,
}
"""Source name -> reader, in the order the sources should be trusted."""
