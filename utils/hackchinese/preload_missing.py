#!/usr/bin/env -S uv run --quiet --script
# /// script
# dependencies = []
# ///

"""
Script to preload words from HackChinese with intelligent prioritization.
"""

import argparse
import json
import time
import webbrowser
from pathlib import Path
from typing import List, Set, Dict, Any, Optional
from queue import PriorityQueue

WORDS_DIR = Path("/Users/emirb/src/Learning_Languages/chinese/anki-chinese-learning/data/hackchinese/words")
LISTS_DIR = Path("/Users/emirb/src/Learning_Languages/chinese/anki-chinese-learning/data/hackchinese/lists")
BASE_URL = "https://www.hackchinese.com/words"


def load_word_files(directory: Path) -> List[Dict[str, Any]]:
    """
    Load all JSON word files from the specified directory.

    Args:
        directory: Path to the directory containing word JSON files

    Returns:
        List of parsed word dictionaries
    """
    words = []

    if not directory.exists():
        print(f"Warning: Directory {directory} does not exist")
        return words

    for file_path in directory.glob("*.json"):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                word_data = json.load(f)
                words.append(word_data)
        except json.JSONDecodeError as e:
            print(f"Error parsing {file_path}: {e}")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    return words


def extract_component_ids(word: Dict[str, Any]) -> List[tuple[str, str]]:
    """
    Extract all component IDs and traditional characters from a word dictionary.

    Args:
        word: Word dictionary containing a 'components' key

    Returns:
        List of tuples (component_id, traditional) as strings
    """
    component_info = []

    components = word.get("components", [])
    if not isinstance(components, list):
        return component_info

    for component in components:
        if isinstance(component, dict) and "id" in component:
            component_id = str(component["id"])
            traditional = component.get("traditional", "")
            component_info.append((component_id, traditional))

    return component_info


def get_existing_word_ids(directory: Path) -> Set[str]:
    """
    Get a set of all existing word IDs from filenames in the directory.

    Args:
        directory: Path to the directory containing word JSON files

    Returns:
        Set of word IDs that already exist
    """
    existing_ids = set()

    if not directory.exists():
        return existing_ids

    for file_path in directory.glob("*.json"):
        # Extract ID from filename (e.g., "12345.json" -> "12345")
        word_id = file_path.stem
        existing_ids.add(word_id)

    return existing_ids


def open_in_browser_and_wait(word_id: str, traditional: str = "", base_url: str = BASE_URL) -> Path:
    """
    Open a word URL in a new browser tab and wait for the file to appear.

    Args:
        word_id: The word ID to open
        traditional: The traditional characters (optional, for display)
        base_url: Base URL for the word pages

    Returns:
        Path to the downloaded file

    Raises:
        Exception: If file doesn't appear after 20 attempts
    """
    url = f"{base_url}/{word_id}"
    file_path = WORDS_DIR / f"{word_id}.json"

    display = f"{traditional} ({word_id})" if traditional else word_id
    try:
        webbrowser.open_new_tab(url)
        print(f"Opened: {url} for word: {display}")
    except Exception as e:
        raise Exception(f"Error opening {url}: {e}")

    # Wait for file to appear
    for attempt in range(20):
        time.sleep(1)
        if file_path.exists():
            print(f"  ✓ File appeared after {attempt + 1} second(s)")
            return file_path
        print(f"  Waiting for file... ({attempt + 1}/20)")

    raise Exception(f"File {file_path} did not appear after 20 seconds")


def load_list_files(directory: Path, file_paths: Optional[List[Path]] = None) -> List[Dict[str, Any]]:
    """
    Load JSON list files from the specified directory or specific file paths.

    Args:
        directory: Path to the directory containing list JSON files
        file_paths: Optional list of specific file paths to load. If None, loads all JSON files from directory.

    Returns:
        List of parsed list dictionaries
    """
    lists = []

    if file_paths is None:
        # Load all JSON files from directory
        if not directory.exists():
            print(f"Warning: Directory {directory} does not exist")
            return lists

        file_paths = list(directory.glob("*.json"))

    # Load the specified file paths
    for file_path in file_paths:
        if not file_path.exists():
            print(f"Warning: File {file_path} does not exist")
            continue

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                list_data = json.load(f)
                lists.append(list_data)
                list_name = list_data.get("name", file_path.stem)
                print(f"  Loaded list: {list_name} from {file_path.name}")
        except json.JSONDecodeError as e:
            print(f"Error parsing {file_path}: {e}")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    return lists


def load_single_word_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """
    Load a single word JSON file.

    Args:
        file_path: Path to the word JSON file

    Returns:
        Parsed word dictionary or None if error
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error parsing {file_path}: {e}")
        return None
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None


def get_list_words_info(lists: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Extract word ID to traditional mapping from all lists.

    Args:
        lists: List of list dictionaries

    Returns:
        Dictionary mapping word IDs to traditional characters
    """
    word_info = {}

    for list_data in lists:
        list_words = list_data.get("listWordsObject", {})
        for word_id, info in list_words.items():
            if word_id not in word_info:
                word_info[word_id] = info.get("traditional", "")

    return word_info


def main():
    """
    Main function to preload missing words with intelligent prioritization.

    Priority levels (lower number = higher priority):
    1. Single character words from lists
    2. Component words from already downloaded words
    3. Multi-character words from lists
    """
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Preload words from HackChinese with intelligent prioritization"
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Specific list files to load (e.g., hsk1.json hsk2.json). If not provided, loads all files from lists directory."
    )
    args = parser.parse_args()

    # Convert file arguments to Path objects
    list_file_paths = None
    if args.files:
        list_file_paths = []
        for f in args.files:
            path = Path(f)
            # If absolute, use as-is
            if path.is_absolute():
                list_file_paths.append(path)
            # If already exists, use as-is (handles relative paths from cwd)
            elif path.exists():
                list_file_paths.append(path)
            # Otherwise, assume it's relative to LISTS_DIR
            else:
                list_file_paths.append(LISTS_DIR / f)

    print("=" * 60)
    print("HackChinese Word Preloader")
    print("=" * 60)

    # Get existing word IDs and single character words
    print("\n[1/5] Loading existing word files...")
    existing_ids = get_existing_word_ids(WORDS_DIR)
    print(f"  Found {len(existing_ids)} existing words")

    # Build set of downloaded single characters
    # Include all alphanumeric and common punctuation
    downloaded_chars = set(['，','。','！','？','；','：','、','…','—','·','「','」','『','』','（','）','《','》', '…',
                           '!','?',';',':',',','.','-','_','\'','"','(',')','[',']','{','}','<','>','/','\\',
                           '|','@','#','$','%','^','&','*','+','=','~','`'])
    # Add all alphanumeric characters
    downloaded_chars.update(chr(i) for i in range(ord('a'), ord('z') + 1))  # a-z
    downloaded_chars.update(chr(i) for i in range(ord('A'), ord('Z') + 1))  # A-Z
    downloaded_chars.update(chr(i) for i in range(ord('0'), ord('9') + 1))  # 0-9
    downloaded_chars.add(' ')  # space
    print(f"  Pre-initialized {len(downloaded_chars)} characters (alphanumeric + punctuation)")

    for file_path in WORDS_DIR.glob("*.json"):
        word_data = load_single_word_file(file_path)
        if word_data:
            traditional = word_data.get("word", {}).get("traditional", "")
            if len(traditional) == 1:
                downloaded_chars.add(traditional)
    print(f"  Found {len(downloaded_chars)} single-character words already downloaded")

    # Load all existing words to extract components
    print("\n[2/5] Extracting components from existing words...")
    existing_words = load_word_files(WORDS_DIR)
    component_info = {}
    for word in existing_words:
        comp_info = extract_component_ids(word)
        for comp_id, traditional in comp_info:
            if comp_id not in component_info:
                component_info[comp_id] = traditional
    print(f"  Found {len(component_info)} unique component IDs")

    # Load list files
    print("\n[3/5] Loading list files...")
    if list_file_paths:
        print(f"  Loading {len(list_file_paths)} specified file(s)")
    else:
        print("  Loading all files from lists directory")
    lists = load_list_files(LISTS_DIR, list_file_paths)
    print(f"  Loaded {len(lists)} lists")

    # Extract word info from lists
    print("\n[4/5] Building word info from lists...")
    list_word_info = get_list_words_info(lists)
    print(f"  Found {len(list_word_info)} unique words across all lists")

    # Build priority queue
    print("\n[5/5] Building priority queue...")
    priority_queue = PriorityQueue()
    queued_ids = set()

    # Priority 1: Single character words from lists
    single_char_count = 0
    for word_id, traditional in list_word_info.items():
        if word_id not in existing_ids and word_id not in queued_ids and len(traditional) == 1:
            priority_queue.put((1, word_id, traditional))
            queued_ids.add(word_id)
            single_char_count += 1
    print(f"  Added {single_char_count} single-char words (priority 1)")

    # Priority 2: Components from already downloaded words
    component_count = 0
    for comp_id, traditional in component_info.items():
        if comp_id not in existing_ids and comp_id not in queued_ids:
            # Prefer traditional from component_info, fallback to list_word_info
            if not traditional:
                traditional = list_word_info.get(comp_id, "")
            priority_queue.put((2, comp_id, traditional))
            queued_ids.add(comp_id)
            component_count += 1
    print(f"  Added {component_count} component words (priority 2)")

    # Priority 3: Multi-character words from lists
    multi_char_count = 0
    for word_id, traditional in list_word_info.items():
        if word_id not in existing_ids and word_id not in queued_ids and len(traditional) > 1:
            priority_queue.put((3, word_id, traditional))
            queued_ids.add(word_id)
            multi_char_count += 1
    print(f"  Added {multi_char_count} multi-char words (priority 3)")

    total_to_download = priority_queue.qsize()
    print(f"\n{'=' * 60}")
    print(f"Total words to download: {total_to_download}")
    print(f"{'=' * 60}")

    if total_to_download == 0:
        print("\n✓ All words are already downloaded!")
        return

    # Process queue
    print(f"\nStarting download process...")
    downloaded = 0
    failed = []

    while not priority_queue.empty():
        priority, word_id, traditional = priority_queue.get()
        downloaded += 1

        # Check if all characters of this word are already downloaded
        if all(char in downloaded_chars for char in traditional):
            continue

        # Check if file already exists (safety check)
        file_path = WORDS_DIR / f"{word_id}.json"
        if file_path.exists():
            existing_ids.add(word_id)
            continue

        priority_label = {1: "SINGLE-CHAR", 2: "COMPONENT", 3: "MULTI-CHAR"}[priority]
        print(f"\n[{downloaded}/{total_to_download}] ({priority_label}) {traditional} (ID: {word_id})")

        try:
            file_path = open_in_browser_and_wait(word_id, traditional)

            # Load the newly downloaded word and extract its components
            new_word = load_single_word_file(file_path)
            if new_word:
                # Add to downloaded_chars if it's a single character
                word_traditional = new_word.get("word", {}).get("traditional", "")
                if len(word_traditional) == 1:
                    downloaded_chars.add(word_traditional)

                new_component_info = extract_component_ids(new_word)
                added_components = 0
                for comp_id, comp_traditional in new_component_info:
                    if comp_id not in existing_ids and comp_id not in queued_ids:
                        # Prefer traditional from component, fallback to list_word_info
                        if not comp_traditional:
                            comp_traditional = list_word_info.get(comp_id, "")
                        print("Adding to queue", (2, comp_id, comp_traditional))
                        priority_queue.put((2, comp_id, comp_traditional))
                        queued_ids.add(comp_id)
                        added_components += 1

                if added_components > 0:
                    print(f"  → Added {added_components} new component(s) to queue")
                    total_to_download += added_components

            # Mark this word as downloaded
            existing_ids.add(word_id)

        except Exception as e:
            print(f"  ✗ Failed: {e}")
            failed.append((word_id, traditional, str(e)))
            continue

    # Summary
    print(f"\n{'=' * 60}")
    print("Download Summary")
    print(f"{'=' * 60}")
    print(f"Successfully downloaded: {downloaded - len(failed)}")
    print(f"Failed: {len(failed)}")

    if failed:
        print("\nFailed downloads:")
        for word_id, traditional, error in failed:
            print(f"  - {traditional} ({word_id}): {error}")

if __name__ == "__main__":
    main()
