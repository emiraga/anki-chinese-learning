#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "google-cloud-translate>=3.15.0",
# ]
# ///

import json
import os
import sys
from pathlib import Path
import time

# In-memory cache for translations
_translation_cache: dict[str, str] = {}


def translate_text_with_google(text: str, client, max_retries: int = 3) -> str:
    """
    Translate Chinese text to English using Google Cloud Translation API.
    Uses in-memory cache to avoid redundant API calls.

    Args:
        text: Chinese text to translate
        client: Google Cloud Translation client
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
        print(f"  [CACHE HIT] Using cached translation")
        return _translation_cache[text]

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


def process_dong_file(file_path: Path, client, dry_run: bool = False) -> bool:
    """
    Process a single dong JSON file and add English translations.

    Args:
        file_path: Path to the JSON file
        client: Google Cloud Translation client
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
                        translation = translate_text_with_google(char_obj['shuowen'], client)
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
                                translation = translate_text_with_google(comment['text'], client)
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
    import argparse
    from google.cloud import translate_v2 as translate

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

    # Initialize translation client
    print("Initializing Google Cloud Translation client...")
    try:
        client = translate.Client()
    except Exception as e:
        print(f"Error initializing translation client: {e}")
        sys.exit(1)

    dong_dir = project_root / 'public' / 'data' / 'dong'

    if not dong_dir.exists():
        print(f"Error: Directory not found: {dong_dir}")
        sys.exit(1)

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
            if process_dong_file(file_path, client, dry_run=args.dry_run):
                modified_count += 1
        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")
            sys.exit(1)

    print(f"\n{'Would modify' if args.dry_run else 'Modified'} {modified_count} file(s)")
    print(f"Translation cache: {len(_translation_cache)} unique texts cached")


if __name__ == '__main__':
    main()
