#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""
Export the parts of speech of the TOCFL 8000 word list to
`app/data/tocfl_pos.json`, as {word: [codes]}.

The app gives these to the AI that breaks sentences down by part of speech
(`app/apis/pos_breakdown.ts`), so that it uses the codes of the official list.
Rerun after updating `data/tocfl/`.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.project_paths import PROJECT_ROOT
from shared.tocfl_csv import load_all

OUTPUT_PATH = PROJECT_ROOT / "app" / "data" / "tocfl_pos.json"


def main() -> None:
    codes_by_word: dict[str, list[str]] = {}
    for word in load_all():
        codes = codes_by_word.setdefault(word.traditional, [])
        codes.extend(code for code in word.part_of_speech if code not in codes)

    # One word per line keeps diffs readable
    lines = [f"{json.dumps(word, ensure_ascii=False)}: {json.dumps(codes)}" for word, codes in sorted(codes_by_word.items())]
    OUTPUT_PATH.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")
    print(f"Wrote {len(codes_by_word)} words to {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
