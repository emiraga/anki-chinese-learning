#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
# ]
# ///

#   "requests",
"""
Download images from external URLs in JSON files and replace with local paths.

This script processes all JSON files in public/data/dong/ directory:
- Downloads images from external URLs to public/images/dong/
- Creates subdirectories matching the original URL structure
- Updates JSON files to point to local image paths
- Skips already downloaded images
"""

import json
import os
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, List, Any
import time

# Base directories
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
JSON_DIR = PROJECT_ROOT / "public" / "data" / "dong"
IMAGES_DIR = PROJECT_ROOT / "public" / "images" / "dong"

# Ensure images directory exists
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def get_local_path_from_url(url: str) -> tuple[Path, str]:
    """
    Convert external URL to local file path and web path.

    Args:
        url: External URL like "https://data.dong-chinese.com/img/sinica/%E4%BA%BA_0.png"

    Returns:
        Tuple of (local_file_path, web_path)
        - local_file_path: Full path to save the file
        - web_path: Path to use in JSON (e.g., "/images/dong/...")
    """
    parsed = urllib.parse.urlparse(url)

    # Remove http:// or https:// and construct path
    # e.g., "data.dong-chinese.com/img/sinica/%E4%BA%BA_0.png"
    # Note: parsed.path is URL-decoded, so we need to re-encode for web path
    path_parts = [parsed.netloc] + [p for p in parsed.path.split('/') if p]

    # Local file path (using decoded characters is fine for filesystem)
    local_path = IMAGES_DIR / Path(*path_parts)

    # Web path (relative to public directory)
    # URL-encode each path component to ensure consistent encoding
    encoded_parts = [urllib.parse.quote(part, safe='') for part in path_parts]
    web_path = "/images/dong/" + "/".join(encoded_parts)

    return local_path, web_path


def download_image(url: str, local_path: Path) -> bool:
    """
    Download image from URL to local path.

    Args:
        url: External URL to download from
        local_path: Local file path to save to

    Returns:
        True if downloaded successfully, False otherwise
    """
    # Skip if already exists
    if local_path.exists():
        print(f"  ✓ Already exists: {local_path.name}")
        return True

    try:
        # Create parent directories
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Download with user agent to avoid blocking
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            with open(local_path, 'wb') as f:
                f.write(response.read())

        print(f"  ✓ Downloaded: {local_path.name}")
        return True

    except Exception as e:
        print(f"  ✗ Failed to download {url}: {e}")
        return False


def process_json_file(json_path: Path) -> Dict[str, Any]:
    """
    Process a single JSON file: download images and update URLs.

    Args:
        json_path: Path to JSON file

    Returns:
        Statistics dict with counts of processed/downloaded/failed images
    """
    stats = {
        'processed': 0,
        'downloaded': 0,
        'failed': 0,
        'already_local': 0
    }

    try:
        # Read JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Check if images array exists
        if 'images' not in data or not isinstance(data['images'], list):
            return stats

        modified = False

        # Process each image
        for image in data['images']:
            if not isinstance(image, dict) or 'url' not in image:
                continue

            url = image['url']
            stats['processed'] += 1

            # Skip if already a local path
            if url.startswith('/images/'):
                stats['already_local'] += 1
                continue

            # Skip if not an HTTP(S) URL
            if not url.startswith(('http://', 'https://')):
                continue

            # Get local and web paths
            local_path, web_path = get_local_path_from_url(url)

            # Download image
            if local_path.exists():
                stats['already_local'] += 1
            else:
                if download_image(url, local_path):
                    stats['downloaded'] += 1
                    # Add small delay to be respectful to server
                    time.sleep(0.1)
                else:
                    stats['failed'] += 1
                    continue

            # Update URL in JSON
            image['url'] = web_path
            modified = True

        # Save modified JSON if changes were made
        if modified:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  ✓ Updated JSON: {json_path.name}")

    except Exception as e:
        print(f"  ✗ Error processing {json_path.name}: {e}")
        raise

    return stats


def main():
    """Main function to process all JSON files."""
    print(f"Processing JSON files from: {JSON_DIR}")
    print(f"Downloading images to: {IMAGES_DIR}")
    print()

    # Get all JSON files
    json_files = sorted(JSON_DIR.glob("*.json"))

    if not json_files:
        print("No JSON files found!")
        return

    print(f"Found {len(json_files)} JSON files")
    print("=" * 60)

    # Track overall statistics
    total_stats = {
        'files_processed': 0,
        'files_with_images': 0,
        'total_images': 0,
        'total_downloaded': 0,
        'total_failed': 0,
        'total_already_local': 0
    }

    # Process each file
    for idx, json_path in enumerate(json_files, 1):
        stats = process_json_file(json_path)

        total_stats['files_processed'] += 1
        if stats['processed'] > 0:
            total_stats['files_with_images'] += 1
            total_stats['total_images'] += stats['processed']
            total_stats['total_downloaded'] += stats['downloaded']
            total_stats['total_failed'] += stats['failed']
            total_stats['total_already_local'] += stats['already_local']

        if stats['processed'] > 0 and stats['processed'] != stats['already_local']:
            progress = (idx / len(json_files)) * 100
            print(f"\n[{idx}/{len(json_files)} - {progress:.1f}%] Processing: {json_path.name}")
            print(f"  Images: {stats['processed']} processed, "
                  f"{stats['downloaded']} downloaded, "
                  f"{stats['already_local']} already local, "
                  f"{stats['failed']} failed")

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Files processed: {total_stats['files_processed']}")
    print(f"Files with images: {total_stats['files_with_images']}")
    print(f"Total images: {total_stats['total_images']}")
    print(f"Downloaded: {total_stats['total_downloaded']}")
    print(f"Already local: {total_stats['total_already_local']}")
    print(f"Failed: {total_stats['total_failed']}")
    print()

    if total_stats['total_failed'] > 0:
        print("⚠️  Some images failed to download. Check the logs above.")
    else:
        print("✅ All images processed successfully!")


if __name__ == "__main__":
    main()
