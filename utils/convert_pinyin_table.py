#/usr/bin/env python3

import csv
import json

def csv_to_2d_array(csv_filepath, output_filepath=None):
    """
    Reads a CSV file with header row and index column and converts it to a 2D array.
    Optionally outputs a JSON file that can be imported in TypeScript.

    Args:
        csv_filepath (str): Path to the CSV file
        output_filepath (str, optional): Path to save the JSON output file

    Returns:
        list: 2D array of the CSV data (excluding header row and index column)
    """
    # Read the CSV file
    with open(csv_filepath, 'r', newline='', encoding='utf-8') as csvfile:
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
        result = {
            "data": data_array,
            "headers": headers,
            "rowIndices": row_indices
        }

        # Optionally save to JSON file
        if output_filepath:
            with open(output_filepath, 'w', encoding='utf-8') as jsonfile:
                json.dump(result, jsonfile, indent=2)
            print(f"Data saved to {output_filepath}")

        return data_array

# Example usage
if __name__ == "__main__":
    # Example call
    data = csv_to_2d_array("../data/table-initial-final.csv", "../app/data/pinyin_table.json")
    print(f"Converted data (2D array): {data}")
