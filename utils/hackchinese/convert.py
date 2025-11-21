#!/usr/bin/env -S uv run --quiet --script
# /// script
# dependencies = []
# ///
"""
Extract outlier data from HackChinese word JSON files.

Reads all JSON files in ./data/hackchinese/words, checks for non-empty outlier
data, and saves it to ./public/data/hackchinese/outlier/<traditional>.json
"""

import json
from pathlib import Path


def main():
    # Setup paths
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent
    words_dir = project_root / "data" / "hackchinese" / "words"
    outlier_dir = project_root / "public" / "data" / "hackchinese" / "outlier"

    # Create output directory if it doesn't exist
    outlier_dir.mkdir(parents=True, exist_ok=True)

    # Process all JSON files
    processed_count = 0
    outlier_count = 0
    skipped_count = 0

    for json_file in words_dir.glob("*.json"):
        processed_count += 1

        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Get traditional form
            traditional = data.get("word", {}).get("traditional")
            if not traditional:
                continue

            # Check if outlier exists and is not empty
            outlier = data.get("outlier")
            if outlier is not None and outlier:
                # Check if output file exists and is newer than source file
                output_file = outlier_dir / f"{traditional}.json"
                if output_file.exists():
                    source_mtime = json_file.stat().st_mtime
                    output_mtime = output_file.stat().st_mtime
                    if output_mtime >= source_mtime:
                        skipped_count += 1
                        continue

                # Save outlier data
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(outlier, f, ensure_ascii=False, indent=2)
                outlier_count += 1

        except Exception as e:
            print(f"Error processing {json_file}: {e}")
            raise

    print(f"Processed {processed_count} files")
    print(f"Extracted {outlier_count} outlier entries")
    print(f"Skipped {skipped_count} up-to-date files")


if __name__ == "__main__":
    main()
