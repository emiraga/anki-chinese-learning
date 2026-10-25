"""
Lookups in the Ministry of Education's Revised Mandarin Dictionary (教育部重編國語辭典).

The dictionary is reached through moedict.tw, which serves each entry as JSON.
Many definitions list synonyms (相似詞) and antonyms (相反詞), which makes it a
free, Taiwan-centric source of candidate word relations. Every reply is cached
under `data/moedict/`, so a word is downloaded at most once - including words
the dictionary does not have, which are cached as its 404 reply.
"""

import json
from typing import Any

import requests

from .project_paths import MOEDICT_CACHE_DIR

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
