"""
Lookups in the Ministry of Education's Revised Mandarin Dictionary (教育部重編國語辭典).

The dictionary is reached through moedict.tw, which serves each entry as JSON.
Many definitions list synonyms (相似詞) and antonyms (相反詞), which makes it a
free, Taiwan-centric source of candidate word relations. Every reply is cached
under `data/moedict/`, so a word is downloaded at most once - including words
the dictionary does not have, which are cached as its 404 reply.

The whole dictionary is also available offline as a dump (`data/moedict_dump/`,
downloaded by `./utils/pos/download_pos_sources.py`). It is loaded only when
first needed, since parsing it takes a couple of seconds.
"""

import json
import lzma
import re
import threading
from functools import cache
from typing import Any

import requests

from .project_paths import MOEDICT_CACHE_DIR, MOEDICT_DUMP_JSON

MOEDICT_URL = "https://www.moedict.tw/uni/{word}"


def lookup_moedict(word: str) -> dict[str, Any] | None:
    """
    Fetch a word's moedict entry, using the local cache when possible.

    Args:
        word: Traditional Chinese word (a single form, without "/" separators)

    Returns:
        The entry as returned by moedict.tw, or None when the dictionary does
        not have the word

    Raises:
        ValueError: If the word is empty or would not make a valid cache file name
        requests.HTTPError: If moedict.tw answers with an error other than 404
    """
    if not word or "/" in word:
        raise ValueError(f"Not a single word: {word!r}")

    cache_file = MOEDICT_CACHE_DIR / f"{word}.json"
    if cache_file.exists():
        with cache_file.open(encoding="utf-8") as f:
            entry: dict[str, Any] = json.load(f)
    else:
        response = requests.get(MOEDICT_URL.format(word=word), timeout=30)
        if response.status_code != 404:
            response.raise_for_status()
        entry = response.json()
        MOEDICT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with cache_file.open("w", encoding="utf-8") as f:
            json.dump(entry, f, ensure_ascii=False)

    if "heteronyms" not in entry:
        return None
    return entry


def get_moedict_relations(word: str) -> tuple[list[str], list[str]]:
    """
    Collect the synonyms and antonyms moedict lists across all of a word's senses.

    Args:
        word: Traditional Chinese word

    Returns:
        (synonyms, antonyms), each deduplicated in order of appearance and
        without the word itself; both empty when moedict lacks the word
    """
    entry = lookup_moedict(word)
    if entry is None:
        return [], []

    synonyms: dict[str, None] = {}
    antonyms: dict[str, None] = {}
    for heteronym in entry["heteronyms"]:
        for definition in heteronym.get("definitions", []):
            for key, collected in (("synonyms", synonyms), ("antonyms", antonyms)):
                for related in definition.get(key, "").split(","):
                    related = related.strip()
                    if related and related != word:
                        collected[related] = None

    return list(synonyms), list(antonyms)


# Lookups run in worker threads: only the first one should parse the dump
_DUMP_LOCK = threading.Lock()
# A few dump readings are (partly) written in Zhuyin instead of pinyin
ZHUYIN_PATTERN = re.compile(r"[ㄅ-ㄯˇˋˊ˙]")


@cache
def load_moedict_dump() -> list[dict[str, Any]]:
    """
    Load every entry of the moedict dump (loaded once, then kept in memory).

    Raises:
        FileNotFoundError: If the dump has not been downloaded
    """
    if not MOEDICT_DUMP_JSON.exists():
        raise FileNotFoundError(f"{MOEDICT_DUMP_JSON} is missing, run ./utils/pos/download_pos_sources.py first")
    with lzma.open(MOEDICT_DUMP_JSON, "rt", encoding="utf-8") as f:
        entries: list[dict[str, Any]] = json.load(f)
    return entries


@cache
def _moedict_pinyin_index() -> dict[str, str]:
    """Map every dump entry's title to the pinyin of its first heteronym that has a pinyin reading."""
    index: dict[str, str] = {}
    for entry in load_moedict_dump():
        for heteronym in entry["heteronyms"]:
            reading = heteronym.get("pinyin", "")
            if reading.strip() and not ZHUYIN_PATTERN.search(reading):
                # "hòu lái" -> "hòulái", as TOCFL writes it
                index[entry["title"]] = "".join(reading.split())
                break
    return index


def lookup_moedict_pinyin(word: str) -> str | None:
    """
    Look up a word's Taiwan pronunciation in the moedict dump, loading the dump on first use.

    Returns:
        Pinyin with tone marks and without spaces (e.g. "lèsè" for 垃圾), or
        None when the dictionary does not have the word

    Raises:
        FileNotFoundError: If the dump has not been downloaded
    """
    with _DUMP_LOCK:
        index = _moedict_pinyin_index()
    return index.get(word)
