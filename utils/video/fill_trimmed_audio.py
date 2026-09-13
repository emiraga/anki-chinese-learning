#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill empty Trimmed Audio fields on mature LocalMediaClips notes.

This script finds every LocalMediaClips note whose review interval is at least
10 days and whose "Trimmed Audio" field is empty. For each matching note it
takes the clip at "LocalFilePath", cuts off the first "trimDurationStart"
seconds and the last "trimDurationEnd" seconds, extracts the remaining audio to
an MP3, uploads it to Anki's media collection, and points the "Trimmed Audio"
field at it with a [sound:...] tag.

The Anki search used is:

    note:LocalMediaClips prop:ivl>=10 "Trimmed Audio:"

The quoted "Trimmed Audio:" matches an empty field whose name contains a space.

Usage:
    ./fill_trimmed_audio.py
    ./fill_trimmed_audio.py --dry-run
    ./fill_trimmed_audio.py --limit 10
    ./fill_trimmed_audio.py --query 'note:LocalMediaClips prop:ivl>=21 "Trimmed Audio:"'

Requirements:
    ffmpeg and ffprobe must be installed (brew install ffmpeg on macOS)
    Anki must be running with the AnkiConnect addon
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_notes_info, store_media_file, update_note_audio_field

NOTE_TYPE = "LocalMediaClips"
ID_FIELD = "ID"
AUDIO_FIELD = "Trimmed Audio"
CLIP_FIELD = "LocalFilePath"
TRIM_START_FIELD = "trimDurationStart"
TRIM_END_FIELD = "trimDurationEnd"

# A field name followed by a bare ":" matches an empty field; quotes are needed
# because the field name contains a space.
SEARCH_QUERY = f'note:{NOTE_TYPE} prop:ivl>=10 "{AUDIO_FIELD}:"'

# Produced audio clips are validated with ffprobe: their duration must match the
# requested interval within this many seconds or this fraction of the expected
# duration, whichever is larger.
MAX_AUDIO_DURATION_TOLERANCE_SECONDS = 0.25
MAX_AUDIO_DURATION_TOLERANCE_RATIO = 0.05


def get_field_value(note: dict[str, Any], field_name: str) -> str:
    """Return the stripped value of a field from a note dictionary."""
    return note.get("fields", {}).get(field_name, {}).get("value", "").strip()


def parse_trim_seconds(value: str) -> float:
    """Parse a trim field value as non-negative seconds, defaulting to 0.0."""
    try:
        return max(0.0, float(value))
    except ValueError:
        return 0.0


def format_ffmpeg_timestamp(seconds: float) -> str:
    """Format seconds as an ffmpeg-friendly 'HH:MM:SS.mmm' timestamp."""
    total_ms = round(seconds * 1000)
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def probe_duration(path: Path) -> float:
    """Return the media duration in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError as e:
        raise RuntimeError(f"ffprobe did not report a duration for {path}") from e


def extract_audio_clip(video_path: Path, start: float, end: float, output_path: Path) -> None:
    """Extract the audio between start and end (seconds) into an MP3 file."""
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            format_ffmpeg_timestamp(start),
            "-to",
            format_ffmpeg_timestamp(end),
            "-i",
            str(video_path),
            "-vn",
            "-map",
            "0:a:0?",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            "-ac",
            "2",
            "-y",
            str(output_path),
        ],
        check=True,
    )


def validate_audio_clip(path: Path, expected_duration: float) -> None:
    """Check that the produced audio clip has a positive, expected duration."""
    duration = probe_duration(path)
    if duration <= 0:
        raise RuntimeError(f"ffmpeg produced a non-positive duration audio clip ({duration:.2f}s)")

    tolerance = max(
        MAX_AUDIO_DURATION_TOLERANCE_SECONDS,
        expected_duration * MAX_AUDIO_DURATION_TOLERANCE_RATIO,
    )
    if abs(duration - expected_duration) > tolerance:
        raise RuntimeError(
            f"audio clip duration {duration:.2f}s differs from the requested {expected_duration:.2f}s by more than {tolerance:.2f}s"
        )


def process_note(note_id: int, dry_run: bool) -> bool:
    """
    Extract and store trimmed audio for a single LocalMediaClips note.

    Args:
        note_id: The note ID to process
        dry_run: If True, only print what would be done without updating Anki

    Returns:
        True if the note was (or would be) processed, False if it was skipped
    """
    note = get_notes_info([note_id])[0]

    if get_field_value(note, AUDIO_FIELD):
        print(f"Note {note_id}: {AUDIO_FIELD} already has content, skipping")
        return False

    clip_id = get_field_value(note, ID_FIELD)
    if not clip_id:
        print(f"Note {note_id}: {ID_FIELD} field is empty, skipping")
        return False

    clip_value = get_field_value(note, CLIP_FIELD)
    if not clip_value:
        print(f"Note {note_id}: {CLIP_FIELD} is empty, skipping")
        return False

    clip_path = Path(clip_value)
    if not clip_path.is_file():
        print(f"Note {note_id}: {CLIP_FIELD} not found: {clip_value}")
        return False

    trim_start = parse_trim_seconds(get_field_value(note, TRIM_START_FIELD))
    trim_end = parse_trim_seconds(get_field_value(note, TRIM_END_FIELD))
    duration = probe_duration(clip_path)
    end = duration - trim_end

    if end <= trim_start:
        print(f"Note {note_id}: trims leave no audio (duration {duration:.2f}s, start {trim_start:.2f}s, end {end:.2f}s), skipping")
        return False

    audio_filename = f"audio_clip_{clip_id}.mp3"
    print(f"Note {note_id}: {clip_path.name} [{format_ffmpeg_timestamp(trim_start)} -> {format_ffmpeg_timestamp(end)}] -> {audio_filename}")

    if dry_run:
        print(f"  [DRY RUN] Would store '{audio_filename}' and set {AUDIO_FIELD}")
        return True

    with tempfile.TemporaryDirectory(prefix="trimmed_audio_") as tmp_dir:
        temp_path = Path(tmp_dir) / audio_filename
        extract_audio_clip(clip_path, trim_start, end, temp_path)
        validate_audio_clip(temp_path, end - trim_start)
        audio_data = temp_path.read_bytes()

    store_media_file(audio_filename, audio_data)
    update_note_audio_field(note_id, audio_filename, field_name=AUDIO_FIELD)
    return True


def main() -> None:
    """Find mature LocalMediaClips notes with empty Trimmed Audio and fill them."""
    parser = argparse.ArgumentParser(description=f"Fill empty {AUDIO_FIELD} fields on {NOTE_TYPE} notes by trimming their video clips")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without updating Anki")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N matching notes")
    parser.add_argument(
        "--query",
        type=str,
        default=SEARCH_QUERY,
        metavar="QUERY",
        help="Anki search query for the notes to process (default: mature LocalMediaClips notes with empty Trimmed Audio)",
    )
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None:
        print("Error: ffmpeg not found in PATH (brew install ffmpeg on macOS)")
        sys.exit(1)
    if shutil.which("ffprobe") is None:
        print("Error: ffprobe not found in PATH (brew install ffmpeg on macOS)")
        sys.exit(1)

    if args.dry_run:
        print("Running in DRY RUN mode - no media will be stored and no notes will be modified\n")

    print(f"Query: {args.query}")
    note_ids = find_notes_by_query(args.query)
    if not note_ids:
        print("No matching notes found")
        return

    print(f"Found {len(note_ids)} note(s)")
    if args.limit is not None:
        note_ids = note_ids[: args.limit]
        print(f"Limiting to the first {len(note_ids)} note(s)")

    processed = 0
    skipped = 0
    failed = 0

    for note_id in note_ids:
        try:
            if process_note(note_id, dry_run=args.dry_run):
                processed += 1
            else:
                skipped += 1
        except Exception as e:
            failed += 1
            print(f"Error processing note {note_id}: {e}")

    print(f"\n{'Would process' if args.dry_run else 'Processed'} {processed} note(s)")
    print(f"Skipped {skipped} note(s)")
    if failed:
        print(f"Failed {failed} note(s)")
        sys.exit(1)


if __name__ == "__main__":
    main()
