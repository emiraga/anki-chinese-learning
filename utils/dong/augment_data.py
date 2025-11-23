#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "google-cloud-translate>=3.15.0",
#   "pypinyin>=0.51.0",
# ]
# ///

import json
import os
import sys
from pathlib import Path
import time
import argparse
from google.cloud import translate_v2 as translate
from pypinyin import pinyin, Style

# In-memory cache for translations
_translation_cache: dict[str, str] = {}
# Lazy-initialized translation client
_translation_client = None


def get_pinyin_from_library(char: str) -> list:
    """
    Get pinyin for a character using pypinyin library as fallback.
    Returns all possible pronunciations (heteronyms) if available.

    Args:
        char: Chinese character

    Returns:
        List of pinyinFrequencies format: [{"pinyin": "...", "count": 1}, ...]
        Empty list if pinyin cannot be determined
    """
    if not char or len(char) != 1:
        return []

    try:
        # Get pinyin with tone marks, including all possible pronunciations
        result = pinyin(char, style=Style.TONE, heteronym=True)
        if result and result[0]:
            # pypinyin returns a list of lists: [['pronunciation1', 'pronunciation2', ...]]
            pronunciations = result[0]
            if pronunciations:
                # Return all pronunciations in pinyinFrequencies format
                # We don't have real frequency data, so we use count=1 for all
                return [{"pinyin": p, "count": 1} for p in pronunciations]
    except Exception as e:
        print(f"Warning: Failed to get pinyin for '{char}': {e}")

    return []


def get_translation_client():
    """
    Get or initialize the Google Cloud Translation client lazily.

    Returns:
        Google Cloud Translation client
    """
    global _translation_client
    if _translation_client is None:
        print("Initializing Google Cloud Translation client...")
        _translation_client = translate.Client()
    return _translation_client


def translate_text_with_google(text: str, max_retries: int = 3) -> str:
    """
    Translate Chinese text to English using Google Cloud Translation API.
    Uses in-memory cache to avoid redundant API calls.

    Args:
        text: Chinese text to translate
        max_retries: Maximum number of retry attempts

    Returns:
        Translated English text

    Raises:
        Exception: If translation fails after max retries
    """
    if not text or not text.strip():
        return ""

    # Check cache first
    if text in _translation_cache:
        return _translation_cache[text]

    # Get client lazily
    client = get_translation_client()

    # Not in cache, translate it
    for attempt in range(max_retries):
        try:
            result = client.translate(
                text,
                source_language='zh-CN',
                target_language='en'
            )
            translated_text = result['translatedText']

            # Store in cache
            _translation_cache[text] = translated_text

            return translated_text
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Translation attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(2)
            else:
                raise Exception(f"Translation failed after {max_retries} attempts: {e}")


def build_char_pinyin_mapping(dong_dir: Path, use_pypinyin_fallback: bool = True) -> dict[str, list]:
    """
    Build a mapping from character to pinyinFrequencies by reading all JSON files.
    Also includes characters from the 'chars' array and pypinyin library as fallbacks.

    Args:
        dong_dir: Directory containing dong JSON files
        use_pypinyin_fallback: Whether to use pypinyin library for missing characters

    Returns:
        Dictionary mapping character (str) to pinyinFrequencies (list)
    """
    char_to_pinyin: dict[str, list] = {}
    all_componentIn_chars: set[str] = set()

    # First pass: collect all data from files
    for file_path in dong_dir.glob('*.json'):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Get the character and its pinyinFrequencies from root level
            if 'char' in data and 'pinyinFrequencies' in data and data['pinyinFrequencies']:
                char = data['char']
                pinyin_freqs = data['pinyinFrequencies']
                char_to_pinyin[char] = pinyin_freqs

            # Also get pinyinFrequencies from chars array as fallback
            if 'chars' in data and isinstance(data['chars'], list):
                for char_obj in data['chars']:
                    if 'char' in char_obj and 'pinyinFrequencies' in char_obj and char_obj['pinyinFrequencies']:
                        char = char_obj['char']
                        pinyin_freqs = char_obj['pinyinFrequencies']
                        # Only add if not already present (root level takes precedence)
                        if char not in char_to_pinyin:
                            char_to_pinyin[char] = pinyin_freqs

            # Collect all characters from componentIn for pypinyin fallback
            if use_pypinyin_fallback and 'componentIn' in data and isinstance(data['componentIn'], list):
                for item in data['componentIn']:
                    if 'char' in item:
                        all_componentIn_chars.add(item['char'])
        except Exception as e:
            print(f"Warning: Error reading {file_path.name} for mapping: {e}")
            continue

    # Second pass: use pypinyin for characters in componentIn that don't have pinyin yet
    if use_pypinyin_fallback:
        missing_chars = all_componentIn_chars - set(char_to_pinyin.keys())
        if missing_chars:
            print(f"Using pypinyin fallback for {len(missing_chars)} characters...")
            for char in missing_chars:
                pinyin_result = get_pinyin_from_library(char)
                if pinyin_result:
                    char_to_pinyin[char] = pinyin_result

    return char_to_pinyin


def process_dong_file(file_path: Path, char_to_pinyin: dict[str, list], dry_run: bool = False) -> bool:
    """
    Process a single dong JSON file and add English translations and pinyinFrequencies.

    Args:
        file_path: Path to the JSON file
        char_to_pinyin: Mapping from character to pinyinFrequencies
        dry_run: If True, only print what would be done without saving

    Returns:
        True if file was modified, False otherwise
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        raise

    modified = False

    # Process chars array
    if 'chars' in data and isinstance(data['chars'], list):
        for char_obj in data['chars']:
            # Translate shuowen field
            if 'shuowen' in char_obj and char_obj['shuowen']:
                if 'shuowen_en_translation' not in char_obj or not char_obj['shuowen_en_translation']:
                    print(f"Translating shuowen for {char_obj.get('char', 'unknown')}...")
                    try:
                        translation = translate_text_with_google(char_obj['shuowen'])
                        char_obj['shuowen_en_translation'] = translation
                        modified = True
                        print(f"  Original: {char_obj['shuowen'][:80]}...")
                        print(f"  Translated: {translation[:80]}...")
                    except Exception as e:
                        print(f"  Error translating shuowen: {e}")
                        raise
                else:
                    # Populate cache with existing translation
                    _translation_cache[char_obj['shuowen']] = char_obj['shuowen_en_translation']

            # Translate comments.text field
            if 'comments' in char_obj and isinstance(char_obj['comments'], list):
                for comment in char_obj['comments']:
                    if 'text' in comment and comment['text']:
                        if 'text_en_translation' not in comment or not comment['text_en_translation']:
                            print(f"Translating comment for {char_obj.get('char', 'unknown')}...")
                            try:
                                translation = translate_text_with_google(comment['text'])
                                comment['text_en_translation'] = translation
                                modified = True
                                print(f"  Original: {comment['text'][:80]}...")
                                print(f"  Translated: {translation[:80]}...")
                            except Exception as e:
                                print(f"  Error translating comment: {e}")
                                raise
                        else:
                            # Populate cache with existing translation
                            _translation_cache[comment['text']] = comment['text_en_translation']

    # Process componentIn array
    if 'componentIn' in data and isinstance(data['componentIn'], list):
        for component_obj in data['componentIn']:
            if 'char' in component_obj:
                char = component_obj['char']
                # Check if pinyinFrequencies already exists and matches
                if char in char_to_pinyin:
                    expected_pinyin = char_to_pinyin[char]
                    current_pinyin = component_obj.get('pinyinFrequencies')

                    # Only modify if pinyinFrequencies is missing or different
                    if current_pinyin != expected_pinyin:
                        if current_pinyin is None:
                            print(f"Adding pinyinFrequencies for componentIn char '{char}' in {file_path.name}")
                        else:
                            print(f"Updating pinyinFrequencies for componentIn char '{char}' in {file_path.name}")
                        component_obj['pinyinFrequencies'] = expected_pinyin
                        modified = True

    # Save the modified file
    if modified and not dry_run:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"✓ Saved {file_path}")
        except Exception as e:
            print(f"Error saving {file_path}: {e}")
            raise
    elif modified and dry_run:
        print(f"[DRY RUN] Would save {file_path}")

    return modified


def main():
    """
    Main function to process all dong JSON files.
    """
    parser = argparse.ArgumentParser(
        description='Add English translations to dong Chinese JSON files using Google Cloud Translation API'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print what would be done without actually saving files'
    )
    parser.add_argument(
        '--file',
        type=str,
        help='Process only a specific file (relative to public/data/dong/)'
    )
    parser.add_argument(
        '--credentials',
        type=str,
        help='Path to Google Cloud credentials JSON file (default: utils/tts/gcloud_account.json)'
    )

    args = parser.parse_args()

    # Get the project root directory
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent

    # Set up credentials
    credentials_path = args.credentials
    if not credentials_path:
        credentials_path = project_root / 'utils' / 'tts' / 'gcloud_account.json'
    else:
        credentials_path = Path(credentials_path)

    if not credentials_path.exists():
        print(f"Error: Credentials file not found: {credentials_path}")
        sys.exit(1)

    # Set environment variable for Google Cloud credentials
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(credentials_path)

    dong_dir = project_root / 'public' / 'data' / 'dong'

    if not dong_dir.exists():
        print(f"Error: Directory not found: {dong_dir}")
        sys.exit(1)

    # Build character to pinyinFrequencies mapping
    print("Building character to pinyinFrequencies mapping...")
    char_to_pinyin = build_char_pinyin_mapping(dong_dir)
    print(f"Built mapping for {len(char_to_pinyin)} characters")

    # Get list of files to process
    if args.file:
        file_path = dong_dir / args.file
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)
        files_to_process = [file_path]
    else:
        files_to_process = sorted(dong_dir.glob('*.json'))

    if not files_to_process:
        print("No JSON files found to process")
        sys.exit(0)

    print(f"Found {len(files_to_process)} file(s) to process")
    if args.dry_run:
        print("Running in DRY RUN mode - no files will be modified\n")

    # Process each file
    modified_count = 0
    for file_path in files_to_process:
        try:
            if process_dong_file(file_path, char_to_pinyin, dry_run=args.dry_run):
                modified_count += 1
        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")
            sys.exit(1)

    print(f"\n{'Would modify' if args.dry_run else 'Modified'} {modified_count} file(s)")
    print(f"Translation cache: {len(_translation_cache)} unique texts cached")


if __name__ == '__main__':
    main()
