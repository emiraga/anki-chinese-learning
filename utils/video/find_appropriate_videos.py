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
"*_simplified.srt" and "*_pinyin.srt" companions), extracts the traditional Chinese characters used
in each file, and compares them against the characters you already know in Anki.

A character counts as known when it has an unsuspended first card in the Hanzi
note type (query: "note:Hanzi -is:suspended card:1").

Files are sorted by the number of *unique* unknown characters (ascending), so
the videos that are easiest to watch right now come first. The unknown
characters of each file are listed, most frequent first.

With "--copy-into", every copied video is additionally passed through
"fix_for_vlc_ios.sh", which remuxes or re-encodes it into an iPhone/iPad
playable MP4 (use "--no-fix-for-vlc" to keep the files untouched).

Usage:
    ./find_appropriate_videos.py /path/to/videos
    ./find_appropriate_videos.py /path/to/videos --top 20
    ./find_appropriate_videos.py /path/to/videos --max-missing 5
    ./find_appropriate_videos.py /path/to/videos --top 10 --copy-into /path/to/watch_next
"""

import argparse
import shutil
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.character_discovery import extract_all_characters, extract_known_chars

# Encodings to try when reading subtitle files, in order of likelihood. utf-16 is
# tried last because it can "successfully" decode single-byte encoded files into
# garbage.
SUBTITLE_ENCODINGS = ("utf-8-sig", "big5", "gb18030", "utf-16")

# Companion subtitle files generated from a main "*.srt" file, which should not be
# analyzed on their own.
IGNORED_SUFFIXES = ("_simplified.srt", "_pinyin.srt")

# Script that makes a video file playable by VLC on iOS, and the extensions it
# accepts. Both must stay in sync with "fix_for_vlc_ios.sh".
FIX_FOR_VLC_SCRIPT = Path(__file__).resolve().parent / "fix_for_vlc_ios.sh"
VIDEO_EXTENSIONS = {".mp4", ".m4v", ".mkv", ".mov", ".avi", ".ts", ".webm", ".flv", ".wmv", ".mpg", ".mpeg", ".m2ts"}

# Folder where "fix_for_vlc_ios.sh" moves the originals it replaced. A video whose
# original is parked there has already been copied and converted by a previous run.
BACKUP_DIR_NAME = "originals"


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


def find_subtitle_files(root: Path, exclude: Path | None = None) -> list[Path]:
    """
    Recursively find subtitle files, excluding the "*_simplified.srt" and
    "*_pinyin.srt" companions.

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
        if not path.name.lower().endswith(IGNORED_SUFFIXES) and not (exclude is not None and exclude in path.parents)
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
    "My Video_simplified.srt", "My Video_pinyin.srt", and any other "My Video*" file.

    Args:
        srt_path: Subtitle file path

    Returns:
        Sorted list of files belonging to the same video
    """
    prefix = srt_path.name[: -len(".srt")]
    return sorted(path for path in srt_path.parent.iterdir() if path.is_file() and path.name.startswith(prefix))


def copy_reports(reports: list[SubtitleReport], destination: Path) -> list[Path]:
    """
    Copy every file belonging to the reported videos into a single folder.

    Files already present in the destination with the same size are left alone,
    so the script can be re-run without re-copying large videos. The same holds
    for files whose original was moved into the "originals/" backup folder by
    "fix_for_vlc_ios.sh", which would otherwise be copied and converted again.

    Args:
        reports: Reports whose videos should be copied
        destination: Folder to copy into (created if missing)

    Returns:
        The copied files, as paths inside the destination

    Raises:
        FileExistsError: If a different file with the same name is already there
    """
    destination.mkdir(parents=True, exist_ok=True)
    print(f"=== Copying {len(reports)} video(s) into {destination} ===\n")

    copied: list[Path] = []
    skipped = 0

    for report in reports:
        for source in find_related_files(report.path):
            target = destination / source.name
            backup = destination / BACKUP_DIR_NAME / source.name
            if backup.exists():
                skipped += 1
                continue
            if target.exists():
                if target.stat().st_size == source.stat().st_size:
                    skipped += 1
                    continue
                raise FileExistsError(f"'{target}' already exists with a different size than '{source}'")
            print(f"  {source.name}")
            shutil.copy2(source, target)
            copied.append(target)

    print(f"\nCopied {len(copied)} file(s), skipped {skipped} already present\n")
    return copied


def fix_videos_for_vlc(paths: list[Path]) -> None:
    """
    Run "fix_for_vlc_ios.sh" on every video file, one file at a time.

    Args:
        paths: Files to consider; non-video files are ignored

    Raises:
        FileNotFoundError: If the fixing script is missing
        subprocess.CalledProcessError: If the script fails for a video
    """
    if not FIX_FOR_VLC_SCRIPT.is_file():
        raise FileNotFoundError(f"Missing script: {FIX_FOR_VLC_SCRIPT}")

    videos = [path for path in paths if path.suffix.lower() in VIDEO_EXTENSIONS]
    if not videos:
        return

    print(f"=== Making {len(videos)} video(s) playable by VLC on iOS ===\n")
    for video in videos:
        subprocess.run([str(FIX_FOR_VLC_SCRIPT), str(video)], check=True)


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
    parser.add_argument(
        "--max-missing",
        type=int,
        default=None,
        metavar="N",
        help="Only show files with at most N unique unknown characters",
    )
    parser.add_argument("--max-missing-shown", type=int, default=50, help="Maximum number of missing characters listed per file")
    parser.add_argument(
        "--copy-into",
        type=Path,
        default=None,
        metavar="FOLDER",
        help="Copy every file of the listed videos (subtitles, video, ...) into this folder",
    )
    parser.add_argument(
        "--no-fix-for-vlc",
        action="store_true",
        help="Do not run fix_for_vlc_ios.sh on the copied videos",
    )
    args = parser.parse_args()

    root = args.folder.resolve()
    destination = args.copy_into.resolve() if args.copy_into is not None else None
    subtitle_files = find_subtitle_files(root, exclude=destination)
    print(f"Found {len(subtitle_files)} subtitle file(s) under {root}")
    if not subtitle_files:
        return

    known_chars = extract_known_chars()

    reports = [analyze_subtitle(path, known_chars) for path in subtitle_files]
    reports.sort(key=lambda report: (report.missing_count, len(report.unique_chars), report.path))

    if args.max_missing is not None:
        reports = [report for report in reports if report.missing_count <= args.max_missing]
        print(f"{len(reports)} file(s) with at most {args.max_missing} unknown character(s)")

    if args.top > 0:
        reports = reports[: args.top]

    print_reports(reports, root, args.max_missing_shown)

    if destination is not None:
        copied = copy_reports(reports, destination)
        if not args.no_fix_for_vlc:
            fix_videos_for_vlc(copied)


if __name__ == "__main__":
    main()
