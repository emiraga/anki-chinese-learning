#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///

"""
Rank subtitle files by how many unknown Chinese characters they contain.

Given a folder, this script recursively collects every "*.srt" file (skipping
"*_simplified.srt" companions), extracts the traditional Chinese characters used
in each file, and compares them against the characters you already know in Anki.

A character counts as known when it has an unsuspended first card in the Hanzi
note type (query: "note:Hanzi -is:suspended card:1").

Files are sorted by the number of *unique* unknown characters (ascending), so
the videos that are easiest to watch right now come first. The unknown
characters of each file are listed, most frequent first.

Usage:
    ./find_appropriate_videos.py /path/to/videos
    ./find_appropriate_videos.py /path/to/videos --top 20
    ./find_appropriate_videos.py /path/to/videos --top 10 --copy-into /path/to/watch_next
"""

import argparse
import shutil
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.anki_utils import find_notes_by_query, get_notes_info
from shared.character_discovery import extract_all_characters

KNOWN_CHARS_QUERY = "note:Hanzi -is:suspended card:1"

# Encodings to try when reading subtitle files, in order of likelihood. utf-16 is
# tried last because it can "successfully" decode single-byte encoded files into
# garbage.
SUBTITLE_ENCODINGS = ("utf-8-sig", "big5", "gb18030", "utf-16")

SIMPLIFIED_SUFFIX = "_simplified.srt"


@dataclass
class SubtitleReport:
    """Result of analyzing a single subtitle file."""

    path: Path
    unique_chars: set[str]
    missing_counts: Counter[str]

    @property
    def missing_count(self) -> int:
        """Number of unique unknown characters in this file."""
        return len(self.missing_counts)

    @property
    def known_ratio(self) -> float:
        """Fraction of unique characters in this file that are already known."""
        if not self.unique_chars:
            return 1.0
        return (len(self.unique_chars) - self.missing_count) / len(self.unique_chars)


def fetch_known_characters() -> set[str]:
    """
    Collect the traditional characters that are already being learned in Anki.

    Returns:
        Set of known traditional characters
    """
    note_ids = find_notes_by_query(KNOWN_CHARS_QUERY)
    print(f"Found {len(note_ids)} unsuspended Hanzi notes")

    known_chars: set[str] = set()
    batch_size = 100

    for i in range(0, len(note_ids), batch_size):
        batch_ids = note_ids[i : i + batch_size]
        for note_info in get_notes_info(batch_ids):
            traditional = note_info["fields"].get("Traditional", {}).get("value", "").strip()
            known_chars.update(extract_all_characters(traditional))

    print(f"Known characters: {len(known_chars)}")
    return known_chars


def find_subtitle_files(root: Path, exclude: Path | None = None) -> list[Path]:
    """
    Recursively find subtitle files, excluding the "*_simplified.srt" ones.

    Args:
        root: Folder to search
        exclude: Folder to skip, typically a "--copy-into" destination living
            inside root, whose copies would otherwise show up as duplicates

    Returns:
        Sorted list of subtitle file paths

    Raises:
        NotADirectoryError: If root is not an existing directory
    """
    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {root}")

    return sorted(
        path
        for path in root.rglob("*.srt")
        if not path.name.lower().endswith(SIMPLIFIED_SUFFIX) and not (exclude is not None and exclude in path.parents)
    )


def read_subtitle_text(path: Path) -> str:
    """
    Read a subtitle file, trying the encodings commonly used for Chinese subtitles.

    Args:
        path: Subtitle file path

    Returns:
        Full file content (timestamps and markup included; they contain no CJK)

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


def analyze_subtitle(path: Path, known_chars: set[str]) -> SubtitleReport:
    """
    Count the unknown characters of a single subtitle file.

    Args:
        path: Subtitle file path
        known_chars: Characters that are already being learned

    Returns:
        Report for this file
    """
    text = read_subtitle_text(path)

    unique_chars = extract_all_characters(text)
    missing_counts: Counter[str] = Counter()
    for char in text:
        if char in unique_chars and char not in known_chars:
            missing_counts[char] += 1

    return SubtitleReport(path=path, unique_chars=unique_chars, missing_counts=missing_counts)


def format_missing_chars(report: SubtitleReport, max_shown: int) -> str:
    """
    Render the unknown characters of a report, most frequent first.

    Args:
        report: Report to render
        max_shown: Maximum number of characters to list

    Returns:
        Human readable list of unknown characters
    """
    if not report.missing_counts:
        return "(none)"

    ranked = [char for char, _ in report.missing_counts.most_common()]
    shown = " ".join(ranked[:max_shown])
    remaining = len(ranked) - max_shown
    if remaining > 0:
        shown += f" ... (+{remaining} more)"
    return shown


def find_related_files(srt_path: Path) -> list[Path]:
    """
    Find every sibling file sharing the subtitle's name prefix.

    For "My Video.srt" this returns "My Video.srt", "My Video.mp4",
    "My Video_simplified.srt", and any other "My Video*" file.

    Args:
        srt_path: Subtitle file path

    Returns:
        Sorted list of files belonging to the same video
    """
    prefix = srt_path.name[: -len(".srt")]
    return sorted(path for path in srt_path.parent.iterdir() if path.is_file() and path.name.startswith(prefix))


def copy_reports(reports: list[SubtitleReport], destination: Path) -> None:
    """
    Copy every file belonging to the reported videos into a single folder.

    Files already present in the destination with the same size are left alone,
    so the script can be re-run without re-copying large videos.

    Args:
        reports: Reports whose videos should be copied
        destination: Folder to copy into (created if missing)

    Raises:
        FileExistsError: If a different file with the same name is already there
    """
    destination.mkdir(parents=True, exist_ok=True)
    print(f"=== Copying {len(reports)} video(s) into {destination} ===\n")

    copied = 0
    skipped = 0

    for report in reports:
        for source in find_related_files(report.path):
            target = destination / source.name
            if target.exists():
                if target.stat().st_size == source.stat().st_size:
                    skipped += 1
                    continue
                raise FileExistsError(f"'{target}' already exists with a different size than '{source}'")
            print(f"  {source.name}")
            shutil.copy2(source, target)
            copied += 1

    print(f"\nCopied {copied} file(s), skipped {skipped} already present\n")


def print_reports(reports: list[SubtitleReport], root: Path, max_missing_shown: int) -> None:
    """Print the ranked reports."""
    print(f"\n=== {len(reports)} subtitle file(s), easiest first ===\n")

    for rank, report in enumerate(reports, start=1):
        relative_path = report.path.relative_to(root)
        print(f"{rank}. {relative_path}")
        print(
            f"   unknown: {report.missing_count} unique"
            f"  |  total unique chars: {len(report.unique_chars)}"
            f"  |  known: {report.known_ratio * 100:.1f}%"
        )
        print(f"   missing: {format_missing_chars(report, max_missing_shown)}\n")


def main() -> None:
    """Rank the subtitle files of a folder by number of unknown characters."""
    parser = argparse.ArgumentParser(description="Sort subtitle files by the number of unknown Chinese characters they contain")
    parser.add_argument("folder", type=Path, help="Folder to search recursively for *.srt files")
    parser.add_argument("--top", type=int, default=0, help="Only show the N easiest files (0 = all)")
    parser.add_argument("--max-missing-shown", type=int, default=50, help="Maximum number of missing characters listed per file")
    parser.add_argument(
        "--copy-into",
        type=Path,
        default=None,
        metavar="FOLDER",
        help="Copy every file of the listed videos (subtitles, video, ...) into this folder",
    )
    args = parser.parse_args()

    root = args.folder.resolve()
    destination = args.copy_into.resolve() if args.copy_into is not None else None
    subtitle_files = find_subtitle_files(root, exclude=destination)
    print(f"Found {len(subtitle_files)} subtitle file(s) under {root}")
    if not subtitle_files:
        return

    known_chars = fetch_known_characters()

    reports = [analyze_subtitle(path, known_chars) for path in subtitle_files]
    reports.sort(key=lambda report: (report.missing_count, len(report.unique_chars), report.path))

    if args.top > 0:
        reports = reports[: args.top]

    print_reports(reports, root, args.max_missing_shown)

    if destination is not None:
        copy_reports(reports, destination)


if __name__ == "__main__":
    main()
