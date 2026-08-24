#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

r"""
Cut a video into one clip per subtitle entry.

Given an SRT subtitle file and its video, this script produces an ordered set
of clips named with the original subtitle numbering and the dialogue's start
time: "001. 你好 (0:01).mp4", "002. 我喜欢你 (0:03).mp4", and so on. By
default only entries whose characters you already know in Anki are extracted
(see extract_known_chars in utils/shared/character_discovery.py); pass --all
to extract every entry that contains Chinese text.

The clips are cut with ffmpeg stream copy, so cutting is fast but the start
may snap to the nearest keyframe before the subtitle time. Pass --reencode
for frame-accurate cuts (slower, re-encodes to browser-playable H.264/AAC
stereo). Pass --webm to output WebM clips with VP9 video and Opus audio
instead of MP4/H.264 (implies --reencode). Audio-only output (--mp3)
re-encodes the audio track to MP3.

Pass --translation movie.en.srt to attach a translation to each produced
sentence. Translation entries are matched to the Chinese entries by how much
their timestamps overlap in the movie (see --overlap-min). When a Chinese
entry overlaps several translation entries, their texts are concatenated in
timestamp order.

Pass --anki-prefix apple_of_my_eye_ to create or update one LocalMediaClips
note in Anki as soon as each clip is processed, keyed by a unique ID such as
"apple_of_my_eye_001". The note fields are ID, LocalFilePath (absolute path
to the clip), RelativeFilePath (the clip's movie folder plus filename),
Timestamp (the dialogue's start time in the movie as HH:MM:SS.mmm),
Traditional (the subtitle sentence), Translation (the matched translation),
and Context (HTML with the previous, current (bold), and next subtitle
sentences, interleaved with the translations that fall anywhere in that
window by timestamp).

Usage:
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --mp3 --padding-start 0.2 --padding-end 0.2
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --limit 10 --output /path/to/clips
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --all --reencode
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --all --webm
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --translation movie.en.srt --overlap-min 0.2
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --translation movie.en.srt --anki-prefix apple_of_my_eye_

Requirements:
    ffmpeg must be installed (brew install ffmpeg on macOS)

Used commands:
    ./utils/video/cut_video_by_subtitles.py \
    /Users/emirb/In\ Progress\ Temporary/you\ are\ the\ apple\ of\ my\ eye/You\ are\ the\ Apple\ of\ My\ Eye\ 2011\ 1080p\ x264.zh.srt \
    /Users/emirb/In\ Progress\ Temporary/you\ are\ the\ apple\ of\ my\ eye/You\ are\ the\ Apple\ of\ My\ Eye\ 2011\ 1080p\ x264.mkv \
    --translation-subtitle \
    /Users/emirb/In\ Progress\ Temporary/you\ are\ the\ apple\ of\ my\ eye/You\ are\ the\ Apple\ of\ My\ Eye\ 2011\ 1080p\ x264.en.srt \
    --padding-start 0.3 --padding-end 0.6 --reencode --overlap-min 0.1 --anki-prefix apple_of_my_eye_ --webm

    cd "/Users/emirb/In Progress Temporary/you are the apple of my eye" && python3 -m http.server 8080
"""

import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import anki_connect_request, find_notes_by_query, get_notes_info, update_note_fields
from shared.character_discovery import extract_all_characters, extract_known_chars

# Encodings to try when reading subtitle files, in order of likelihood. utf-16 is
# tried last because it can "successfully" decode single-byte encoded files into
# garbage.
SUBTITLE_ENCODINGS = ("utf-8-sig", "big5", "gb18030", "utf-16")

# Maximum number of characters kept from the subtitle text in the filename.
MAX_FILENAME_TEXT_LENGTH = 80

# Re-encoded clips are validated with ffprobe: their container duration must
# match the requested interval within this many seconds or this fraction of the
# expected duration, whichever is larger.
MAX_CLIP_DURATION_TOLERANCE_SECONDS = 0.25
MAX_CLIP_DURATION_TOLERANCE_RATIO = 0.05

# Timestamp regex: "00:00:01,000 --> 00:00:04,000" (comma or dot for milliseconds).
TIMING_PATTERN = re.compile(
    r"(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})"
)


@dataclass
class SubtitleEntry:
    """A single SRT entry with its timing and text."""

    index: int
    start: float
    end: float
    text: str


class ClipValidationError(Exception):
    """Raised when a produced clip fails the ffprobe length/validity check."""


def read_subtitle_text(path: Path) -> str:
    """
    Read a subtitle file, trying the encodings commonly used for Chinese subtitles.

    Raises:
        UnicodeDecodeError: If none of the candidate encodings can decode the file
    """
    last_error: UnicodeDecodeError | None = None
    for encoding in SUBTITLE_ENCODINGS:
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError as e:
            last_error = e

    if last_error is None:
        raise ValueError("No subtitle encodings configured")
    raise last_error


def parse_srt_timestamp(timestamp: str) -> float:
    """Convert an SRT timestamp such as '00:01:23,456' to seconds."""
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})", timestamp.strip())
    if not match:
        raise ValueError(f"Invalid SRT timestamp: {timestamp!r}")

    hours, minutes, seconds, milliseconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds) + int(milliseconds.ljust(3, "0")) / 1000


def format_timestamp(seconds: float) -> str:
    """Format seconds as an ffmpeg-friendly 'HH:MM:SS.mmm' timestamp."""
    total_ms = round(seconds * 1000)
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, ms = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def format_filename_timestamp(seconds: float) -> str:
    """Format a subtitle start time as 'M:SS' for filenames, e.g. 4:06."""
    total_seconds = int(seconds)
    minutes, secs = divmod(total_seconds, 60)
    return f"{minutes}:{secs:02d}"


def parse_srt(path: Path) -> list[SubtitleEntry]:
    """
    Parse an SRT file into subtitle entries.

    Text lines of an entry are joined with spaces, and HTML/ASS styling tags are
    stripped. Entries whose timestamp line cannot be parsed are skipped.
    """
    text = read_subtitle_text(path)
    lines = text.splitlines()

    entries: list[SubtitleEntry] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Index line: the entry number.
        try:
            index = int(line)
        except ValueError:
            i += 1
            continue
        i += 1

        # Timing line.
        if i >= len(lines):
            break
        timing_match = TIMING_PATTERN.search(lines[i])
        if not timing_match:
            i += 1
            continue
        start = parse_srt_timestamp(timing_match.group(1))
        end = parse_srt_timestamp(timing_match.group(2))
        i += 1

        # Text lines until the next blank line.
        text_lines: list[str] = []
        while i < len(lines) and lines[i].strip():
            text_lines.append(lines[i].strip())
            i += 1

        entry_text = clean_subtitle_text(" ".join(text_lines))
        entries.append(SubtitleEntry(index=index, start=start, end=end, text=entry_text))

        # Skip any blank lines between entries.
        while i < len(lines) and not lines[i].strip():
            i += 1

    return entries


def clean_subtitle_text(text: str) -> str:
    """Strip HTML/ASS styling tags and collapse whitespace in subtitle text."""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\{[^}]*\}", "", text)
    return re.sub(r"\s+", " ", text).strip()


def sanitize_filename_text(text: str) -> str:
    """
    Make subtitle text safe for a filename, keeping letters, digits and spaces.

    Everything else (punctuation, symbols, emoji) is removed, matching a
    readable "011. 你好.mp4" style while keeping the original wording.
    """
    cleaned = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    if len(cleaned) > MAX_FILENAME_TEXT_LENGTH:
        cleaned = cleaned[:MAX_FILENAME_TEXT_LENGTH].rstrip(" .")
    return cleaned


def select_entries(
    entries: list[SubtitleEntry], known_chars: set[str], include_all: bool
) -> tuple[list[SubtitleEntry], int, int, Counter[str]]:
    """
    Keep entries to be extracted.

    Entries without any Chinese character are always skipped. Unless
    include_all is set, entries with unknown characters are skipped too.

    Returns:
        (selected entries, skipped without Chinese, skipped with unknown characters,
         frequency of each missing character across skipped entries)
    """
    selected: list[SubtitleEntry] = []
    skipped_no_cjk = 0
    skipped_unknown = 0
    missing_freq: Counter[str] = Counter()

    for entry in entries:
        chars = extract_all_characters(entry.text)
        if not chars:
            skipped_no_cjk += 1
            continue
        if not include_all:
            # Keep the characters in the order they first appear in the sentence.
            missing = list(dict.fromkeys(char for char in entry.text if char in chars and char not in known_chars))
            if missing:
                skipped_unknown += 1
                missing_set = set(missing)
                missing_freq.update(char for char in entry.text if char in missing_set)
                print(f"  [{entry.index:03d}] {entry.text}  (missing: {' '.join(missing)})")
                continue
        selected.append(entry)

    return selected, skipped_no_cjk, skipped_unknown, missing_freq


def _subtitle_start_key(entry: SubtitleEntry) -> float:
    """Return a subtitle entry's start time for sorting."""
    return entry.start


def find_translation_matches(
    entry: SubtitleEntry, translations: list[SubtitleEntry], overlap_min: float
) -> list[SubtitleEntry]:
    """
    Find translation entries that overlap the given subtitle entry in time.

    An overlap is measured in seconds as min(entry.end, translation.end) -
    max(entry.start, translation.start). Entries whose overlap is at least
    overlap_min seconds are returned, ordered by their start timestamp in the
    movie. With the default overlap_min of 0.0, intervals that only touch at
    a single point count as matching; pass a small positive value such as
    0.001 to require a real overlap.
    """
    matches: list[SubtitleEntry] = []
    for translation in translations:
        overlap = min(entry.end, translation.end) - max(entry.start, translation.start)
        if overlap >= overlap_min:
            matches.append(translation)
    matches.sort(key=_subtitle_start_key)
    return matches


def _context_item_sort_key(item: tuple[float, str, str, bool]) -> tuple[float, int]:
    """Sort context items by timestamp, with Chinese before English on ties."""
    return (item[0], 0 if item[1] == "zh" else 1)


def build_context_html(
    entries: list[SubtitleEntry],
    position: int,
    translation_entries: list[SubtitleEntry],
    overlap_min: float,
) -> str:
    """
    Build the Context HTML for one clip.

    The context spans the subtitle sentence immediately before the clip's
    sentence through the sentence immediately after it. The clip's own
    sentence is rendered bold. Translation entries that overlap this whole
    window are interleaved with the Chinese sentences by timestamp; each
    translation text is included at most once.
    """
    current = entries[position]
    context_entries: list[SubtitleEntry] = []
    if position > 0:
        context_entries.append(entries[position - 1])
    context_entries.append(current)
    if position + 1 < len(entries):
        context_entries.append(entries[position + 1])

    # Match translations against the entire context window, from the start of
    # the previous sentence to the end of the next one.
    window = SubtitleEntry(
        index=-1,
        start=context_entries[0].start,
        end=context_entries[-1].end,
        text="",
    )

    # Items are (timestamp, kind, text, is_current) with kind "zh" or "en";
    # sorting by timestamp interleaves the Chinese context sentences with the
    # English translations that overlap the window.
    items: list[tuple[float, str, str, bool]] = []
    seen_translations: set[str] = set()

    items += [
        (context_entry.start, "zh", context_entry.text, context_entry is current)
        for context_entry in context_entries
    ]
    for match in find_translation_matches(window, translation_entries, overlap_min):
        if match.text and match.text not in seen_translations:
            seen_translations.add(match.text)
            items.append((match.start, "en", match.text, False))

    items.sort(key=_context_item_sort_key)

    lines: list[str] = []
    for _, kind, text, is_current in items:
        escaped = html.escape(text)
        if kind == "zh":
            if is_current:
                lines.append(
                    f'<div class="zh current" '
                    f'style="border: 2px solid #f59e0b; border-radius: 6px; '
                    f'padding: 4px 10px; display: inline-block;">'
                    f"<strong>{escaped}</strong></div>"
                )
            else:
                lines.append(f'<div class="zh">{escaped}</div>')
        else:
            lines.append(f'<div class="en">{escaped}</div>')
    return "".join(lines)


class LocalMediaClipsManager:
    """Create and update LocalMediaClips notes in Anki."""

    DECK_NAME = "ChineseLocal::Media"
    NOTE_TYPE = "LocalMediaClips"

    def get_existing_notes(self) -> dict[str, Any]:
        """Get all existing LocalMediaClips notes indexed by their ID field."""
        note_ids = find_notes_by_query(f"note:{self.NOTE_TYPE}")
        if not note_ids:
            return {}

        existing: dict[str, Any] = {}
        for note in get_notes_info(note_ids):
            note_id_value = note["fields"].get("ID", {}).get("value", "").strip()
            if note_id_value:
                existing[note_id_value] = note
        return existing

    def create_note(self, fields: dict[str, str]) -> None:
        """Create a new LocalMediaClips note."""
        response = anki_connect_request(
            "addNote",
            {
                "note": {
                    "deckName": self.DECK_NAME,
                    "modelName": self.NOTE_TYPE,
                    "fields": fields,
                    "tags": ["auto-generated"],
                }
            },
        )
        note_id = response.get("result")
        if not note_id:
            raise Exception(f"Failed to create note for ID '{fields.get('ID')}'")
        print(f"  Created note {note_id} for ID '{fields.get('ID')}'")

    def update_note(
        self, note_id: int, fields: dict[str, str], changes: dict[str, tuple[str, str]]
    ) -> None:
        """Update an existing LocalMediaClips note, printing each changed field."""
        # Pass only the changed fields to Anki so the update (and any logging it
        # does) reflects what actually changed, not the full note.
        update_note_fields(note_id, {name: new for name, (_, new) in changes.items()})
        print(
            f"  Updated note {note_id} for ID '{fields.get('ID')}' "
            f"({len(changes)} field(s) changed)"
        )
        for name, (old, new) in changes.items():
            print(f"    {name}: {old!r} -> {new!r}")


def note_field_changes(existing_note: dict[str, Any], fields: dict[str, str]) -> dict[str, tuple[str, str]]:
    """Return the fields whose values differ, mapped to (old, new) values."""
    existing_fields = existing_note.get("fields", {})
    return {
        name: (existing_fields.get(name, {}).get("value", ""), value)
        for name, value in fields.items()
        if existing_fields.get(name, {}).get("value", "") != value
    }


def build_ffmpeg_command(
    video: Path,
    start: float,
    end: float,
    output: Path,
    audio_only: bool,
    reencode: bool = False,
    webm: bool = False,
) -> list[str]:
    """
    Build the ffmpeg command for one clip.

    Video clips use stream copy for speed; audio-only clips re-encode the audio
    track to MP3. With reencode, the video is re-encoded to H.264/AAC (or
    VP9/Opus with webm) and seeking happens on the input side, which gives
    frame-accurate cuts without decoding the whole movie first.
    """
    command = ["ffmpeg", "-hide_banner", "-loglevel", "info"]

    if reencode or webm:
        # Input-side seeking is fast and still frame-accurate when re-encoding:
        # ffmpeg decodes from the previous keyframe up to the exact start frame.
        # (Output-side seeking would decode the whole movie up to the start time
        # before encoding a single frame.) WebM output always re-encodes.
        command += ["-ss", format_timestamp(start), "-to", format_timestamp(end), "-i", str(video)]
        if audio_only:
            command += ["-vn", "-map", "0:a:0?", "-c:a", "libmp3lame", "-q:a", "2", "-ac", "2"]
        elif webm:
            command += [
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libvpx-vp9",
                "-crf",
                "32",
                "-b:v",
                "0",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "libopus",
                "-b:a",
                "128k",
                "-ac",
                "2",
            ]
        else:
            command += [
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "18",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ac",
                "2",
                "-movflags",
                "+faststart",
            ]
    else:
        # Input-side seeking is fast but snaps to keyframes for stream-copied video.
        command += ["-ss", format_timestamp(start), "-to", format_timestamp(end), "-i", str(video)]
        if audio_only:
            command += ["-vn", "-map", "0:a:0?", "-c:a", "libmp3lame", "-q:a", "2"]
        else:
            command += ["-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-avoid_negative_ts", "make_zero"]

    command += ["-y", str(output)]
    return command


def validate_clip(path: Path, expected_duration: float | None = None) -> tuple[bool, str | None]:
    """
    Check a media file's readability and length with ffprobe.

    With expected_duration set, the file's container duration must be close to
    that value. With expected_duration None (the default), only readability and
    a positive duration are checked.

    Returns (True, None) when the file is valid, or when ffprobe is not
    installed. Returns (False, reason) when the file cannot be read or fails
    the requested checks.
    """
    if shutil.which("ffprobe") is None:
        return True, None

    try:
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
    except subprocess.CalledProcessError as e:
        return False, f"ffprobe could not read the file (exit status {e.returncode})"
    except OSError as e:
        return False, f"ffprobe could not run: {e}"

    try:
        duration = float(result.stdout.strip())
    except ValueError:
        return False, "ffprobe did not report a duration"

    if duration <= 0:
        return False, f"ffprobe reported a non-positive duration ({duration:.2f}s)"

    if expected_duration is not None:
        tolerance = max(
            MAX_CLIP_DURATION_TOLERANCE_SECONDS,
            expected_duration * MAX_CLIP_DURATION_TOLERANCE_RATIO,
        )
        if abs(duration - expected_duration) > tolerance:
            return False, (
                f"duration {duration:.2f}s differs from the requested "
                f"{expected_duration:.2f}s by more than {tolerance:.2f}s"
            )
    return True, None


CLIP_EXTENSIONS = {".mp4", ".webm", ".mp3"}


def recheck_output_dir(output_dir: Path) -> tuple[int, int]:
    """
    Validate existing clip files in the output folder and delete damaged ones.

    Only non-hidden files with a known clip extension are checked. Returns
    (checked, deleted).
    """
    checked = 0
    deleted = 0
    for path in sorted(output_dir.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.suffix.lower() not in CLIP_EXTENSIONS:
            continue
        checked += 1
        valid, reason = validate_clip(path)
        if valid:
            continue
        print(f"  Damaged: {path.name} ({reason})")
        try:
            path.unlink()
        except OSError as e:
            print(f"    Could not delete {path.name}: {e}")
        else:
            deleted += 1
            print(f"    Deleted {path.name}")
    return checked, deleted


def main() -> None:
    """Cut one clip per subtitle entry from a video."""
    parser = argparse.ArgumentParser(
        description="Cut a video into one clip per subtitle entry, named by subtitle number",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s movie.zh.srt movie.mkv
  %(prog)s movie.zh.srt movie.mkv --mp3 --padding-start 0.2 --padding-end 0.2
  %(prog)s movie.zh.srt movie.mkv --limit 10 --output /path/to/clips
  %(prog)s movie.zh.srt movie.mkv --all --reencode
  %(prog)s movie.zh.srt movie.mkv --all --webm
  %(prog)s movie.zh.srt movie.mkv --recheck
  %(prog)s movie.zh.srt movie.mkv --translation movie.en.srt --overlap-min 0.2
  %(prog)s movie.zh.srt movie.mkv --translation movie.en.srt --anki-prefix apple_of_my_eye_
        """,
    )
    parser.add_argument("subtitle", type=Path, help="SRT subtitle file with the sentence timing")
    parser.add_argument("video", type=Path, help="Video file to cut")
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        metavar="FOLDER",
        help="Output folder (default: <video_name>_clips next to the video)",
    )
    parser.add_argument("--mp3", action="store_true", help="Output .mp3 audio clips instead of .mp4 video clips")
    parser.add_argument(
        "--reencode",
        action="store_true",
        help="Re-encode clips for frame-accurate cuts instead of fast keyframe-snapped stream copy "
        "(H.264/AAC stereo, browser-playable)",
    )
    parser.add_argument(
        "--webm",
        action="store_true",
        help="Output .webm video clips with VP9 video and Opus audio instead of .mp4/H.264; implies --reencode",
    )
    parser.add_argument(
        "--recheck",
        action="store_true",
        help="Before cutting, validate existing clips in the output folder with ffprobe and delete damaged ones "
        "so they are cut again",
    )
    parser.add_argument("--limit", type=int, default=0, help="Only extract the first N matching entries (0 = all)")
    parser.add_argument("--padding-start", type=float, default=0.0, help="Seconds added before each subtitle interval")
    parser.add_argument("--padding-end", type=float, default=0.0, help="Seconds added after each subtitle interval")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Extract every entry with Chinese text, not only entries whose characters you already know",
    )
    parser.add_argument(
        "--translation",
        "--translation-subtitle",
        dest="translation_subtitle",
        type=Path,
        default=None,
        metavar="SRT",
        help="Translation subtitle file (e.g. movie.en.srt). Matched to each Chinese entry by time overlap",
    )
    parser.add_argument(
        "--overlap-min",
        type=float,
        default=0.0,
        help="Minimum seconds of timestamp overlap required for a translation entry to match (default: 0.0)",
    )
    parser.add_argument(
        "--anki-prefix",
        type=str,
        default=None,
        metavar="PREFIX",
        help="Create or update one LocalMediaClips note in Anki as each clip is produced, with IDs "
        "'<prefix>001', '<prefix>002', ... (requires Anki running with AnkiConnect)",
    )
    args = parser.parse_args()

    if args.padding_start < 0 or args.padding_end < 0:
        parser.error("padding values must be >= 0")
    if args.overlap_min < 0:
        parser.error("--overlap-min must be >= 0")
    if args.webm and args.mp3:
        parser.error("--webm and --mp3 are mutually exclusive")
    if args.anki_prefix is not None and not args.anki_prefix.strip():
        parser.error("--anki-prefix must not be empty")

    subtitle_path = args.subtitle
    video_path = args.video
    if not subtitle_path.is_file():
        print(f"Error: Subtitle file not found: {subtitle_path}")
        sys.exit(1)
    if not video_path.is_file():
        print(f"Error: Video file not found: {video_path}")
        sys.exit(1)
    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg not found in PATH (brew install ffmpeg on macOS)")
        sys.exit(1)
    if (args.reencode or args.webm) and shutil.which("ffprobe") is None:
        print("Warning: ffprobe not found in PATH; re-encoded clips will not be validated")

    translation_entries: list[SubtitleEntry] = []
    if args.translation_subtitle is not None:
        translation_path = args.translation_subtitle
        if not translation_path.is_file():
            print(f"Error: Translation subtitle file not found: {translation_path}")
            sys.exit(1)
        translation_entries = parse_srt(translation_path)
        print(f"Parsed {len(translation_entries)} translation entries from {translation_path.name}")

    if args.mp3:
        extension = ".mp3"
    elif args.webm:
        extension = ".webm"
    else:
        extension = ".mp4"
    output_dir = args.output if args.output is not None else video_path.with_name(video_path.stem + "_clips")
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.recheck:
        if shutil.which("ffprobe") is None:
            print("Error: --recheck requires ffprobe, which was not found in PATH")
            sys.exit(1)
        print(f"=== Rechecking existing clips in {output_dir} ===")
        checked, deleted = recheck_output_dir(output_dir)
        print(f"Recheck: {checked} clip(s) checked, {deleted} damaged clip(s) deleted\n")

    entries = parse_srt(subtitle_path)
    print(f"Parsed {len(entries)} subtitle entries from {subtitle_path.name}")

    if args.all:
        known_chars: set[str] = set()
    else:
        try:
            known_chars = extract_known_chars()
        except Exception as e:
            print(f"Error: Could not load known characters from Anki: {e}")
            print("Make sure Anki is running with the AnkiConnect addon, or pass --all to skip the filter.")
            sys.exit(1)

    selected, skipped_no_cjk, skipped_unknown, missing_freq = select_entries(entries, known_chars, include_all=args.all)

    if not args.all:
        print(f"Skipped {skipped_no_cjk} entries without Chinese text and {skipped_unknown} with unknown characters")
    print(f"Kept {len(selected)} matching entries")

    if not args.all:
        if missing_freq:
            print("Missing characters by frequency:")
            for char, count in missing_freq.most_common():
                print(f"  {char}: {count}")
        else:
            print("Missing characters: none")

    if args.limit > 0:
        selected = selected[: args.limit]
        print(f"Limiting to the first {len(selected)} matching entries")

    # Precompute translation matches for every entry that will be produced.
    translations_by_index: dict[int, Any] = {}
    if args.translation_subtitle is not None:
        for entry in selected:
            matches = find_translation_matches(entry, translation_entries, args.overlap_min)
            translations_by_index[entry.index] = {
                "text": " ".join(match.text for match in matches),
                "count": len(matches),
                "matches": [
                    {"index": match.index, "start": match.start, "end": match.end, "text": match.text}
                    for match in matches
                ],
            }

    print(f"=== Cutting {len(selected)} clip(s) into {output_dir} ===\n")

    # Set up Anki before cutting so each note can be created or updated as soon
    # as its clip is processed. Existing notes are indexed by their ID field to
    # decide between creating and updating.
    entry_positions: dict[int, int] = {}
    manager: LocalMediaClipsManager | None = None
    existing_notes: dict[str, Any] = {}
    if args.anki_prefix:
        entry_positions = {id(entry): position for position, entry in enumerate(entries)}
        manager = LocalMediaClipsManager()
        try:
            existing_notes = manager.get_existing_notes()
            print(f"Found {len(existing_notes)} existing LocalMediaClips notes")
        except Exception as e:
            print(f"Error: Could not load LocalMediaClips notes from Anki: {e}")
            print("Make sure Anki is running with the AnkiConnect addon.")
            sys.exit(1)

    cut_count = 0
    skipped_existing = 0
    failed = 0
    anki_created = 0
    anki_updated = 0
    anki_unchanged = 0
    anki_errors = 0
    translation_counts: list[int] = []

    for entry in selected:
        filename_text = sanitize_filename_text(entry.text)
        timestamp = format_filename_timestamp(entry.start)
        output_path = output_dir / f"{entry.index:03d}. {filename_text} ({timestamp}){extension}"

        start = max(0.0, entry.start - args.padding_start)
        end = entry.end + args.padding_end
        match_info = translations_by_index.get(entry.index)
        translation = match_info["text"] if match_info else ""
        translation_count = match_info["count"] if match_info else 0
        if args.translation_subtitle is not None:
            translation_counts.append(translation_count)

        status: str | None = None
        if output_path.exists():
            status = "skipped_existing"
            skipped_existing += 1
        elif end <= start:
            status = "empty_interval"
            failed += 1
            print(f"[{entry.index:03d}] Skipped: empty interval ({format_timestamp(entry.start)} -> {format_timestamp(entry.end)})")
        else:
            translation_note = f"  (translations: {translation_count})" if match_info else ""
            print(f"[{entry.index:03d}] {format_timestamp(start)} -> {format_timestamp(end)}  {entry.text[:40]}{translation_note}")
            temp_path: Path | None = None
            try:
                # Write to a hidden temporary file in the output folder first,
                # then atomically rename it into place. An interrupted or failed
                # run never leaves a truncated clip under the final filename.
                with tempfile.NamedTemporaryFile(
                    dir=output_dir, prefix=f".{entry.index:03d}.", suffix=extension, delete=False
                ) as temp_file:
                    temp_path = Path(temp_file.name)
                temp_path.unlink()  # let ffmpeg create the file with normal permissions
                subprocess.run(
                    build_ffmpeg_command(
                        video_path,
                        start,
                        end,
                        temp_path,
                        audio_only=args.mp3,
                        reencode=args.reencode or args.webm,
                        webm=args.webm,
                    ),
                    check=True,
                )
                if args.reencode or args.webm:
                    valid, reason = validate_clip(temp_path, expected_duration=end - start)
                    if not valid:
                        raise ClipValidationError(reason or "clip failed validation")
                temp_path.replace(output_path)
                temp_path = None
                status = "cut"
                cut_count += 1
            except subprocess.CalledProcessError as e:
                status = "failed"
                failed += 1
                print(f"  Error cutting entry {entry.index}: {e}")
            except ClipValidationError as e:
                status = "failed"
                failed += 1
                print(f"  Rejected invalid clip for entry {entry.index}: {e}")
            except KeyboardInterrupt:
                print("\nInterrupted; removing incomplete clip...")
                raise
            finally:
                if temp_path is not None:
                    temp_path.unlink(missing_ok=True)

        if args.anki_prefix and status in ("cut", "skipped_existing"):
            assert manager is not None
            note_id_str = f"{args.anki_prefix}{entry.index:03d}"
            fields = {
                "ID": note_id_str,
                "LocalFilePath": str(output_path.resolve()),
                "RelativeFilePath": f"{output_dir.name}/{output_path.name}",
                "Timestamp": format_timestamp(entry.start),
                "Traditional": entry.text,
                "Translation": translation,
                "Context": build_context_html(
                    entries, entry_positions[id(entry)], translation_entries, args.overlap_min
                ),
            }
            try:
                existing_note = existing_notes.get(note_id_str)
                if existing_note is None:
                    manager.create_note(fields)
                    anki_created += 1
                else:
                    changes = note_field_changes(existing_note, fields)
                    if changes:
                        manager.update_note(existing_note["noteId"], fields, changes)
                        anki_updated += 1
                    else:
                        anki_unchanged += 1
            except Exception as e:
                anki_errors += 1
                print(f"  Error upserting note '{note_id_str}': {e}")

    print(f"\nCut {cut_count} clip(s), skipped {skipped_existing} already present, {failed} failed")

    if args.translation_subtitle is not None:
        distribution: dict[int, int] = {}
        for count in translation_counts:
            distribution[count] = distribution.get(count, 0) + 1
        distribution_summary = ", ".join(f"{count}: {num}" for count, num in sorted(distribution.items()))
        print(f"Translation match counts per sentence: {distribution_summary}")
        matched_sentences = sum(1 for count in translation_counts if count > 0)
        print(f"Sentences with at least one translation: {matched_sentences}/{len(translation_counts)}")

    if args.anki_prefix:
        print(f"\nAnki: {anki_created} created, {anki_updated} updated, {anki_unchanged} unchanged, {anki_errors} errors")

    if failed or anki_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
