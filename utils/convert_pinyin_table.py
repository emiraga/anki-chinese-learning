#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Convert the initial/final pinyin table CSV into the JSON the app imports.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.project_paths import PINYIN_TABLE_CSV, PINYIN_TABLE_JSON


def csv_to_2d_array(csv_filepath: Path, output_filepath: Path | None = None) -> list[list[str]]:
    """
    Reads a CSV file with header row and index column and converts it to a 2D array.
    Optionally outputs a JSON file that can be imported in TypeScript.

    Args:
        csv_filepath (Path): Path to the CSV file
        output_filepath (Path, optional): Path to save the JSON output file

    Returns:
        list: 2D array of the CSV data (excluding header row and index column)
    """
    # Read the CSV file
    with csv_filepath.open(newline="", encoding="utf-8") as csvfile:
        csv_reader = csv.reader(csvfile)

        # Read all rows
        all_rows = list(csv_reader)

        if not all_rows:
            return []

        # Extract data (skip first row and first column)
        data_array = [row[1:] for row in all_rows[1:]]

        # Get headers (excluding the first cell which is the intersection of headers and indices)
        headers = all_rows[0][1:]

        # Get row indices
        row_indices = [row[0] for row in all_rows[1:]]

        # Create TypeScript-friendly structure with metadata
        result = {"data": data_array, "headers": headers, "rowIndices": row_indices}

        # Optionally save to JSON file
        if output_filepath:
            with output_filepath.open("w", encoding="utf-8") as jsonfile:
                json.dump(result, jsonfile, indent=2)
            print(f"Data saved to {output_filepath}")

        return data_array


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", type=Path, default=PINYIN_TABLE_CSV, help="Input CSV holding the initial/final table")
    parser.add_argument("--output", type=Path, default=PINYIN_TABLE_JSON, help="JSON file to write")
    args = parser.parse_args()

    data = csv_to_2d_array(args.csv, args.output)
    print(f"Converted data (2D array): {data}")


if __name__ == "__main__":
    main()
