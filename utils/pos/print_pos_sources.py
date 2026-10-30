#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Print the part of speech that each downloaded source gives for some words.

With words given, prints every entry each source has for them, e.g.:

    ./utils/pos/print_pos_sources.py 繼續 還

Without words, prints how often each tag occurs in each source instead, which
helps when mapping a source's tags to the TOCFL codes of `app/data/pos.json`.
Reading the Wiktionary dumps takes about a minute each in that mode.

Download the sources first with ./utils/pos/download_pos_sources.py.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

# Add shared utils to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.pos_sources import POS_SOURCES


def print_words(words: list[str]) -> None:
    wanted = set(words)
    for source, read in POS_SOURCES.items():
        entries = list(read(wanted))
        print(f"== {source}")
        for word in words:
            matching = [entry for entry in entries if entry.word == word]
            if not matching:
                print(f"  {word}: -")
            for entry in matching:
                print(f"  {word}: {entry.pos}  [{entry.detail}]")


def print_tag_counts() -> None:
    for source, read in POS_SOURCES.items():
        counts = Counter(entry.pos for entry in read())
        print(f"== {source} ({counts.total()} entries, {len(counts)} tags)")
        for tag, count in counts.most_common():
            print(f"  {count:8}  {tag}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("words", nargs="*", help="Traditional Chinese words to look up")
    args = parser.parse_args()
    if args.words:
        print_words(args.words)
    else:
        print_tag_counts()


if __name__ == "__main__":
    main()
