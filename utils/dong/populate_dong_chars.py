#!/usr/bin/env python3
"""
Script to populate individual character JSON files from a bulk JSON input file.
Filters out invalid entries and creates one file per character in public/data/dong/
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict


def is_valid_char_data(data: Dict[str, Any]) -> bool:
    """Check if character data is valid and should be processed."""
    # Check if data has error property
    if "error" in data or "details" in data:
        return False

    # Check if char property exists
    if "char" not in data or not isinstance(data["char"], str):
        return False

    # Check if char is not empty or just whitespace
    if not data["char"].strip():
        return False

    return True


def sanitize_filename(char: str) -> str:
    """Sanitize the character for use as a filename."""
    return char.strip()


def populate_dong_chars(input_file_path: str) -> None:
    """
    Process the input JSON file and create individual character files.

    Args:
        input_file_path: Path to the input JSON file containing all entries
    """
    print(f"Reading input file: {input_file_path}")

    # Read the input JSON file
    with open(input_file_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    print(f"Found {len(entries)} total entries")

    # Create output directory if it doesn't exist
    output_dir = Path("public/data/dong")
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {output_dir.absolute()}")

    valid_count = 0
    error_count = 0
    skipped_count = 0
    already_exists_count = 0

    # Process each entry
    for entry in entries:
        # Only process entries with keys starting with __sink__charData_
        if not entry.get("key", "").startswith("__sink__charData_"):
            skipped_count += 1
            continue

        try:
            # Parse the JSON value
            char_data = json.loads(entry["value"])

            # Validate the character data
            if not is_valid_char_data(char_data):
                if "error" in char_data:
                    print(
                        f"Skipping entry with error: {char_data.get('error')} - "
                        f"{char_data.get('details', '')}"
                    )
                else:
                    print(f"Skipping invalid entry: {entry['key']}")
                error_count += 1
                continue

            # Sanitize the filename
            file_name = sanitize_filename(char_data["char"])
            output_path = output_dir / f"{file_name}.json"

            # Skip if file already exists
            if output_path.exists():
                already_exists_count += 1
                continue

            # Write the character data to file
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(char_data, f, ensure_ascii=False, indent=2)
                f.write("\n")

            valid_count += 1
            print(f"✓ Created: {output_path}")

        except json.JSONDecodeError as e:
            print(f"Error parsing JSON for entry {entry.get('key')}: {e}")
            error_count += 1
        except Exception as e:
            print(f"Error processing entry {entry.get('key')}: {e}")
            error_count += 1

    print("\n=== Summary ===")
    print(f"Total entries: {len(entries)}")
    print(f"Valid characters created: {valid_count}")
    print(f"Already exists (skipped): {already_exists_count}")
    print(f"Errors/Invalid entries: {error_count}")
    print(f"Skipped (non-charData): {skipped_count}")


def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print("Usage: python utils/dong/populate_dong_chars.py <input-json-file>")
        print("Example: python utils/dong/populate_dong_chars.py data.json")
        sys.exit(1)

    input_file_path = sys.argv[1]

    if not os.path.exists(input_file_path):
        print(f"Error: Input file not found: {input_file_path}")
        sys.exit(1)

    try:
        populate_dong_chars(input_file_path)
        print("\n✓ Script completed successfully")
    except Exception as e:
        print(f"\n✗ Script failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
