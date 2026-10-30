#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Download the part-of-speech dictionary dumps listed in POS_SOURCES.md into `data/`.

Files that already exist are skipped; delete one to download a newer version.
The TOCFL lists are not downloaded here, they are checked into `data/tocfl/`.
"""

import sys
from pathlib import Path

import requests

# Add shared utils to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.cli import parse_no_arguments
from shared.project_paths import JIEBA_DICT_TXT, KAIKKI_EN_JSONL, KAIKKI_ZH_JSONL, MOEDICT_DUMP_JSON, UD_CHINESE_GSD_DIR

UD_GSD_URL = "https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/master/zh_gsd-ud-{split}.conllu"

DOWNLOADS = {
    KAIKKI_EN_JSONL: "https://kaikki.org/dictionary/Chinese/kaikki.org-dictionary-Chinese.jsonl.gz",
    KAIKKI_ZH_JSONL: "https://kaikki.org/zhwiktionary/漢語/kaikki.org-dictionary-漢語.jsonl.gz",
    MOEDICT_DUMP_JSON: "https://raw.githubusercontent.com/g0v/moedict-data/main/dict-revised.json.xz",
    JIEBA_DICT_TXT: "https://raw.githubusercontent.com/fxsjy/jieba/master/extra_dict/dict.txt.big",
    **{UD_CHINESE_GSD_DIR / f"zh_gsd-ud-{split}.conllu": UD_GSD_URL.format(split=split) for split in ("train", "dev", "test")},
}


def download(url: str, target: Path) -> None:
    """Stream `url` to `target`, via a temporary file so an interrupted download leaves nothing behind."""
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".partial")
    with requests.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        with partial.open("wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    partial.rename(target)


def main() -> None:
    parse_no_arguments(__doc__)
    for target, url in DOWNLOADS.items():
        if target.exists():
            print(f"exists, skipping: {target}")
            continue
        print(f"downloading {url}")
        download(url, target)
        print(f"  -> {target} ({target.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
