#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Cut a video into one clip per subtitle entry.

Given an SRT subtitle file and its video, this script produces an ordered set
of clips named with the original subtitle numbering: "001. 你好.mp4",
"002. 我喜欢你.mp4", and so on. By default only entries whose characters you
already know in Anki are extracted (see extract_known_chars in
utils/shared/character_discovery.py); pass --all to extract every entry that
contains Chinese text.

The clips are cut with ffmpeg stream copy, so cutting is fast but the start
may snap to the nearest keyframe before the subtitle time. Pass --reencode
for frame-accurate cuts (slower, re-encodes to H.264/AAC). Audio-only output
(--mp3) re-encodes the audio track to MP3.

Usage:
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --mp3 --padding 0.2
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --limit 10 --output /path/to/clips
    ./cut_video_by_subtitles.py movie.zh.srt movie.mkv --all --reencode

Requirements:
    ffmpeg must be installed (brew install ffmpeg on macOS)
"""

import argparse
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.character_discovery import extract_all_characters, extract_known_chars

# Encodings to try when reading subtitle files, in order of likelihood. utf-16 is
# tried last because it can "successfully" decode single-byte encoded files into
# garbage.
SUBTITLE_ENCODINGS = ("utf-8-sig", "big5", "gb18030", "utf-16")

# Maximum number of characters kept from the subtitle text in the filename.
MAX_FILENAME_TEXT_LENGTH = 80

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
) -> tuple[list[SubtitleEntry], int, int]:
    """
    Keep entries to be extracted.

    Entries without any Chinese character are always skipped. Unless
    include_all is set, entries with unknown characters are skipped too.

    Returns:
        (selected entries, skipped without Chinese, skipped with unknown characters)
    """
    selected: list[SubtitleEntry] = []
    skipped_no_cjk = 0
    skipped_unknown = 0

    for entry in entries:
        chars = extract_all_characters(entry.text)
        if not chars:
            skipped_no_cjk += 1
            continue
        if not include_all and not chars.issubset(known_chars):
            skipped_unknown += 1
            continue
        selected.append(entry)

    return selected, skipped_no_cjk, skipped_unknown


def build_ffmpeg_command(
    video: Path, start: float, end: float, output: Path, audio_only: bool, reencode: bool = False
) -> list[str]:
    """
    Build the ffmpeg command for one clip.

    Video clips use stream copy for speed; audio-only clips re-encode the audio
    track to MP3. With reencode, seeking happens on the output side and video is
    re-encoded to H.264/AAC, which gives frame-accurate cuts at the cost of speed.
    """
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error"]

    if reencode:
        # Output-side seeking decodes from the requested frame instead of
        # snapping to the nearest keyframe.
        command += ["-i", str(video), "-ss", format_timestamp(start), "-to", format_timestamp(end)]
        if audio_only:
            command += ["-vn", "-map", "0:a:0?", "-c:a", "libmp3lame", "-q:a", "2"]
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


def main() -> None:
    """Cut one clip per subtitle entry from a video."""
    parser = argparse.ArgumentParser(
        description="Cut a video into one clip per subtitle entry, named by subtitle number",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s movie.zh.srt movie.mkv
  %(prog)s movie.zh.srt movie.mkv --mp3 --padding 0.2
  %(prog)s movie.zh.srt movie.mkv --limit 10 --output /path/to/clips
  %(prog)s movie.zh.srt movie.mkv --all --reencode
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
        help="Re-encode clips for frame-accurate cuts instead of fast keyframe-snapped stream copy",
    )
    parser.add_argument("--limit", type=int, default=0, help="Only extract the first N matching entries (0 = all)")
    parser.add_argument("--padding", type=float, default=0.0, help="Seconds added before and after each subtitle interval")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Extract every entry with Chinese text, not only entries whose characters you already know",
    )
    args = parser.parse_args()

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

    extension = ".mp3" if args.mp3 else ".mp4"
    output_dir = args.output if args.output is not None else video_path.with_name(video_path.stem + "_clips")
    output_dir.mkdir(parents=True, exist_ok=True)

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

    selected, skipped_no_cjk, skipped_unknown = select_entries(entries, known_chars, include_all=args.all)

    if not args.all:
        print(f"Skipped {skipped_no_cjk} entries without Chinese text and {skipped_unknown} with unknown characters")
    print(f"Kept {len(selected)} matching entries")

    if args.limit > 0:
        selected = selected[: args.limit]
        print(f"Limiting to the first {len(selected)} matching entries")

    print(f"=== Cutting {len(selected)} clip(s) into {output_dir} ===\n")

    cut_count = 0
    skipped_existing = 0
    failed = 0

    for entry in selected:
        filename_text = sanitize_filename_text(entry.text)
        output_path = output_dir / f"{entry.index:03d}. {filename_text}{extension}"

        if output_path.exists():
            skipped_existing += 1
            continue

        start = max(0.0, entry.start - args.padding)
        end = entry.end + args.padding
        if end <= start:
            print(f"[{entry.index:03d}] Skipped: empty interval ({format_timestamp(entry.start)} -> {format_timestamp(entry.end)})")
            failed += 1
            continue

        print(f"[{entry.index:03d}] {format_timestamp(start)} -> {format_timestamp(end)}  {entry.text[:40]}")
        try:
            subprocess.run(
                build_ffmpeg_command(video_path, start, end, output_path, audio_only=args.mp3, reencode=args.reencode),
                check=True,
            )
            cut_count += 1
        except subprocess.CalledProcessError as e:
            failed += 1
            print(f"  Error cutting entry {entry.index}: {e}")

    print(f"\nCut {cut_count} clip(s), skipped {skipped_existing} already present, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
