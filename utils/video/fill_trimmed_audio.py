#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Fill empty Trimmed Audio fields on mature LocalMediaClips notes.

This script finds every LocalMediaClips note whose "Trimmed Audio" field is
empty and that is either mature (review interval at least 10 days) or tagged
"chinese::media-trimmed-audio", which is how a note is picked out by hand
before it matures. For each matching note it takes the clip at
"RelativeFilePath" (resolved under MEDIA_DIR), cuts off the first
"trimDurationStart" seconds and the last "trimDurationEnd" seconds, extracts
the remaining audio to an MP3, uploads it to Anki's media collection, points
the "Trimmed Audio" field at it with a [sound:...] tag, tags the note
"chinese::media-trimmed-audio", and moves the note's cards to the
"Chinese::MediaClips" deck.

By default the audio is extracted exactly as it is in the film. Passing
`--audio-preset` instead cleans up the dialogue - denoising it, boosting the
presence band, and normalizing it to a consistent loudness, none of which
alters the pitch contour that carries Mandarin tone. See
`shared/speech_audio.py` for the presets and what each one does.

The Anki search used is:

    note:LocalMediaClips (prop:ivl>=10 OR tag:chinese::media-trimmed-audio) "Trimmed Audio:"

The quoted "Trimmed Audio:" matches an empty field whose name contains a space.

Usage:
    ./fill_trimmed_audio.py
    ./fill_trimmed_audio.py --dry-run
    ./fill_trimmed_audio.py --limit 10
    ./fill_trimmed_audio.py --audio-preset speech
    ./fill_trimmed_audio.py --audio-preset clarity
    ./fill_trimmed_audio.py --query 'note:LocalMediaClips prop:ivl>=21 "Trimmed Audio:"'

To re-cut clips that already have audio - for instance after changing the
preset - select them with a query and pass --overwrite, which replaces the
stored MP3:

    ./fill_trimmed_audio.py --overwrite --query 'note:LocalMediaClips tag:chinese::media-trimmed-audio'

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

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import (
    add_tags,
    find_cards_by_query,
    find_notes_by_query,
    get_field_value,
    get_notes_info,
    move_cards_to_deck,
    store_media_file,
    update_note_audio_field,
)
from shared.media_paths import resolve_clip_path
from shared.speech_audio import (
    DEFAULT_MAX_GAIN_DB,
    DEFAULT_PRESET,
    DEFAULT_TARGET_LUFS,
    PRESETS,
    SpeechEnhancement,
    build_audio_command,
    format_ffmpeg_timestamp,
    plan_enhancement,
)

NOTE_TYPE = "LocalMediaClips"
ID_FIELD = "ID"
AUDIO_FIELD = "Trimmed Audio"
CLIP_FIELD = "RelativeFilePath"
TRIM_START_FIELD = "trimDurationStart"
TRIM_END_FIELD = "trimDurationEnd"
DESTINATION_DECK = "Chinese::MediaClips"
# Added to every note this script fills, and also a way to hand-pick a note that
# has not matured yet: the default search takes tagged notes as well as mature
# ones.
TAG = "chinese::media-trimmed-audio"

# A field name followed by a bare ":" matches an empty field; quotes are needed
# because the field name contains a space.
SEARCH_QUERY = f'note:{NOTE_TYPE} (prop:ivl>=10 OR tag:{TAG}) "{AUDIO_FIELD}:"'

# Produced audio clips are validated with ffprobe: their duration must match the
# requested interval within this many seconds or this fraction of the expected
# duration, whichever is larger.
MAX_AUDIO_DURATION_TOLERANCE_SECONDS = 0.25
MAX_AUDIO_DURATION_TOLERANCE_RATIO = 0.05


def parse_trim_seconds(value: str) -> float:
    """Parse a trim field value as non-negative seconds, defaulting to 0.0."""
    try:
        return max(0.0, float(value))
    except ValueError:
        return 0.0


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


def extract_audio_clip(video_path: Path, start: float, end: float, output_path: Path, enhancement: SpeechEnhancement) -> None:
    """
    Extract the audio between start and end (seconds) into an MP3 file.

    The enhancement preset decides how much the dialogue is cleaned up on the
    way out; `none` copies the audio through as-is.
    """
    plan = plan_enhancement(video_path, start, end, enhancement)
    if plan is not None:
        print(f"  Audio: {plan.describe()}")
    elif enhancement.enabled:
        print("  Audio: too quiet to normalize, extracting as-is")

    subprocess.run(build_audio_command(video_path, start, end, output_path, plan), check=True)


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


def process_note(note_id: int, dry_run: bool, enhancement: SpeechEnhancement, overwrite: bool) -> bool:
    """
    Extract and store trimmed audio for a single LocalMediaClips note.

    Args:
        note_id: The note ID to process
        dry_run: If True, only print what would be done without updating Anki
        enhancement: How to process the extracted audio
        overwrite: If True, redo notes whose audio field is already filled

    Returns:
        True if the note was (or would be) processed, False if it was skipped
    """
    note = get_notes_info([note_id])[0]

    if get_field_value(note, AUDIO_FIELD) and not overwrite:
        print(f"Note {note_id}: {AUDIO_FIELD} already has content, skipping")
        return False

    clip_id = get_field_value(note, ID_FIELD)
    if not clip_id:
        print(f"Note {note_id}: {ID_FIELD} field is empty, skipping")
        return False

    clip_path = resolve_clip_path(get_field_value(note, CLIP_FIELD))

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
        print(f"  [DRY RUN] Would store '{audio_filename}', set {AUDIO_FIELD}, add tag '{TAG}', and move card(s) to '{DESTINATION_DECK}'")
        return True

    with tempfile.TemporaryDirectory(prefix="trimmed_audio_") as tmp_dir:
        temp_path = Path(tmp_dir) / audio_filename
        extract_audio_clip(clip_path, trim_start, end, temp_path, enhancement)
        validate_audio_clip(temp_path, end - trim_start)
        audio_data = temp_path.read_bytes()

    store_media_file(audio_filename, audio_data)
    update_note_audio_field(note_id, audio_filename, field_name=AUDIO_FIELD)
    add_tags([note_id], TAG)

    card_ids = find_cards_by_query(f"nid:{note_id}")
    if not card_ids:
        print(f"  Note {note_id}: no cards found to move to '{DESTINATION_DECK}'")
    else:
        move_cards_to_deck(card_ids, DESTINATION_DECK)

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
        help=f"Anki search query for the notes to process (default: mature or '{TAG}'-tagged {NOTE_TYPE} notes with empty {AUDIO_FIELD})",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help=f"Redo notes whose {AUDIO_FIELD} is already filled, replacing the stored MP3 (use with a query that selects them)",
    )
    parser.add_argument(
        "--audio-preset",
        choices=sorted(PRESETS),
        default=DEFAULT_PRESET,
        help=f"How much to clean up the dialogue; 'speech' is the recommended one (default: {DEFAULT_PRESET}, the audio untouched)",
    )
    parser.add_argument(
        "--target-lufs",
        type=float,
        default=DEFAULT_TARGET_LUFS,
        help=f"Loudness every clip is normalized to (default: {DEFAULT_TARGET_LUFS})",
    )
    parser.add_argument(
        "--max-gain-db",
        type=float,
        default=DEFAULT_MAX_GAIN_DB,
        help=f"Most a clip may be boosted, so near-silent clips do not get a loud noise floor (default: {DEFAULT_MAX_GAIN_DB})",
    )
    parser.add_argument(
        "--rnnoise-model",
        type=Path,
        default=None,
        metavar="PATH",
        help="Also run arnndn with this RNNoise model, which separates speech from music better than the built-in denoiser",
    )
    args = parser.parse_args()

    enhancement = SpeechEnhancement(
        preset=args.audio_preset,
        target_lufs=args.target_lufs,
        max_gain_db=args.max_gain_db,
        rnnoise_model=args.rnnoise_model,
    )

    if shutil.which("ffmpeg") is None:
        print("Error: ffmpeg not found in PATH (brew install ffmpeg on macOS)")
        sys.exit(1)
    if shutil.which("ffprobe") is None:
        print("Error: ffprobe not found in PATH (brew install ffmpeg on macOS)")
        sys.exit(1)

    if args.dry_run:
        print("Running in DRY RUN mode - no media will be stored and no notes will be modified\n")

    print(f"Query: {args.query}")
    print(f"Audio preset: {enhancement.preset}" + (f" -> {enhancement.target_lufs:.1f} LUFS" if enhancement.enabled else ""))
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
            if process_note(note_id, dry_run=args.dry_run, enhancement=enhancement, overwrite=args.overwrite):
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
