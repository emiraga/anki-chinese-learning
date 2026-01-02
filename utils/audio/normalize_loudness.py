#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pydub>=0.25.0",
#     "audioop-lts>=0.2.0",
#     "tqdm>=4.66.0",
# ]
# ///
"""
Audio Loudness Normalizer

Analyzes and normalizes loudness of MP3 files in the media folder.
Focuses on files matching patterns: tocfl-tts-*.mp3, sapi5-*.mp3, emir_tts_*.mp3

Usage:
    ./normalize_loudness.py --analyze              # Analyze all files
    ./normalize_loudness.py --normalize --dry-run  # Show what would be normalized
    ./normalize_loudness.py --normalize            # Actually normalize loud files

Requirements:
    ffmpeg must be installed (brew install ffmpeg on macOS)
"""

import argparse
import glob
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pydub import AudioSegment
from tqdm import tqdm


@dataclass
class AudioFile:
    path: str
    dbfs: float
    pattern: str


@dataclass
class NormalizationConfig:
    target_dbfs: float = -20.0  # Target loudness in dBFS
    loud_threshold: float = -16.0  # Files louder than this are considered "loud"
    quiet_threshold: float = -24.0  # Files quieter than this are considered "quiet"
    min_adjustment: float = 1.0  # Minimum dB adjustment to bother making


def get_media_path() -> Path:
    """Get the path to the media folder."""
    script_dir = Path(__file__).resolve().parent
    # Navigate from utils/audio to project root, then to media
    project_root = script_dir.parent.parent
    media_path = project_root / "media"

    if not media_path.exists():
        raise FileNotFoundError(f"Media folder not found at {media_path}")

    return media_path


def get_matching_files(media_path: Path) -> list[tuple[str, str]]:
    """Get all files matching the target patterns.

    Returns list of (filepath, pattern) tuples.
    """
    patterns = [
        ("tocfl-tts-*.mp3", "tocfl-tts"),
        ("sapi5-*.mp3", "sapi5"),
        ("emir_tts_*.mp3", "emir_tts"),
        ("dangdai-*.mp3", "dangdai"),
    ]

    files = []
    for pattern, name in patterns:
        matching = glob.glob(str(media_path / pattern))
        for f in matching:
            files.append((f, name))

    return files


def analyze_file(filepath: str) -> Optional[float]:
    """Analyze a single file and return its dBFS value."""
    try:
        audio = AudioSegment.from_mp3(filepath)
        return audio.dBFS
    except Exception as e:
        print(f"  Warning: Could not analyze {filepath}: {e}")
        return None


def analyze_all_files(
    files: list[tuple[str, str]],
    verbose: bool = False
) -> list[AudioFile]:
    """Analyze all files and return their loudness values."""
    results = []

    for filepath, pattern in tqdm(files, desc="Analyzing", unit="file"):
        dbfs = analyze_file(filepath)
        if dbfs is not None:
            results.append(AudioFile(path=filepath, dbfs=dbfs, pattern=pattern))

    return results


def print_statistics(files: list[AudioFile], config: NormalizationConfig) -> None:
    """Print statistics about the analyzed files."""
    if not files:
        print("No files to analyze.")
        return

    dbfs_values = [f.dbfs for f in files]
    avg_dbfs = sum(dbfs_values) / len(dbfs_values)
    min_dbfs = min(dbfs_values)
    max_dbfs = max(dbfs_values)

    loud_files = [f for f in files if f.dbfs > config.loud_threshold]
    quiet_files = [f for f in files if f.dbfs < config.quiet_threshold]

    print("\n" + "=" * 60)
    print("LOUDNESS ANALYSIS SUMMARY")
    print("=" * 60)
    print(f"Total files analyzed: {len(files)}")
    print(f"Average loudness:     {avg_dbfs:.2f} dBFS")
    print(f"Quietest file:        {min_dbfs:.2f} dBFS")
    print(f"Loudest file:         {max_dbfs:.2f} dBFS")
    print(f"Range:                {max_dbfs - min_dbfs:.2f} dB")
    print()
    print(f"Configuration:")
    print(f"  Target loudness:    {config.target_dbfs:.1f} dBFS")
    print(f"  Loud threshold:     {config.loud_threshold:.1f} dBFS")
    print(f"  Quiet threshold:    {config.quiet_threshold:.1f} dBFS")
    print()
    print(f"Files louder than {config.loud_threshold:.1f} dBFS:  {len(loud_files)}")
    print(f"Files quieter than {config.quiet_threshold:.1f} dBFS: {len(quiet_files)}")

    # Stats by pattern
    print("\nBy pattern:")
    for pattern in ["tocfl-tts", "sapi5", "emir_tts", "dangdai"]:
        pattern_files = [f for f in files if f.pattern == pattern]
        if pattern_files:
            pattern_dbfs = [f.dbfs for f in pattern_files]
            pattern_avg = sum(pattern_dbfs) / len(pattern_dbfs)
            pattern_loud = [f for f in pattern_files if f.dbfs > config.loud_threshold]
            print(f"  {pattern:12s}: {len(pattern_files):5d} files, "
                  f"avg {pattern_avg:.1f} dBFS, "
                  f"{len(pattern_loud)} loud")


def print_loud_files(
    files: list[AudioFile],
    config: NormalizationConfig,
    limit: int = 20
) -> None:
    """Print details about the loudest files."""
    loud_files = sorted(
        [f for f in files if f.dbfs > config.loud_threshold],
        key=lambda x: x.dbfs,
        reverse=True
    )

    if not loud_files:
        print(f"\nNo files found louder than {config.loud_threshold:.1f} dBFS")
        return

    print(f"\nLOUDEST FILES (above {config.loud_threshold:.1f} dBFS):")
    print("-" * 60)

    shown = loud_files[:limit]
    for f in shown:
        filename = os.path.basename(f.path)
        adjustment = config.target_dbfs - f.dbfs
        print(f"  {f.dbfs:6.1f} dBFS ({adjustment:+.1f}dB needed): {filename[:50]}")

    if len(loud_files) > limit:
        print(f"  ... and {len(loud_files) - limit} more files")


def normalize_file(
    filepath: str,
    target_dbfs: float,
    dry_run: bool = True
) -> tuple[bool, str]:
    """Normalize a single file to the target loudness.

    Returns (success, message) tuple.
    """
    try:
        audio = AudioSegment.from_mp3(filepath)
        current_dbfs = audio.dBFS
        adjustment = target_dbfs - current_dbfs

        if dry_run:
            return True, f"Would adjust by {adjustment:+.1f} dB"

        # Apply gain adjustment
        normalized = audio + adjustment

        # Export back to the same file
        normalized.export(filepath, format="mp3")

        return True, f"Adjusted by {adjustment:+.1f} dB"
    except Exception as e:
        return False, f"Error: {e}"


def normalize_loud_files(
    files: list[AudioFile],
    config: NormalizationConfig,
    dry_run: bool = True,
    patterns: Optional[list[str]] = None
) -> None:
    """Normalize files that are louder than the threshold."""
    # Filter to loud files
    loud_files = [f for f in files if f.dbfs > config.loud_threshold]

    # Filter by pattern if specified
    if patterns:
        loud_files = [f for f in loud_files if f.pattern in patterns]

    # Filter out files that don't need significant adjustment
    loud_files = [
        f for f in loud_files
        if abs(f.dbfs - config.target_dbfs) >= config.min_adjustment
    ]

    if not loud_files:
        print("No files need normalization.")
        return

    action = "Would normalize" if dry_run else "Normalizing"
    print(f"\n{action} {len(loud_files)} files to {config.target_dbfs:.1f} dBFS...")

    if dry_run:
        print("(DRY RUN - no files will be modified)")

    success_count = 0
    error_count = 0

    for f in tqdm(loud_files, desc="Normalizing", unit="file"):
        success, _ = normalize_file(f.path, config.target_dbfs, dry_run)

        if success:
            success_count += 1
        else:
            error_count += 1

    status = "Would process" if dry_run else "Processed"
    print(f"{status}: {success_count} successful, {error_count} errors")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze and normalize loudness of MP3 files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --analyze                    Analyze all files and show statistics
  %(prog)s --analyze --verbose          Show progress for each file
  %(prog)s --normalize --dry-run        Preview what would be normalized
  %(prog)s --normalize                  Actually normalize loud files
  %(prog)s --normalize --patterns emir_tts  Only normalize emir_tts files
  %(prog)s --target -18 --loud -14      Use custom thresholds
        """
    )

    # Actions
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument(
        "--analyze", "-a",
        action="store_true",
        help="Analyze files and show loudness statistics"
    )
    action_group.add_argument(
        "--normalize", "-n",
        action="store_true",
        help="Normalize loud files to target loudness"
    )

    # Options
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed progress"
    )
    parser.add_argument(
        "--patterns", "-p",
        nargs="+",
        choices=["tocfl-tts", "sapi5", "emir_tts", "dangdai"],
        help="Only process specific patterns (default: all)"
    )

    # Thresholds
    parser.add_argument(
        "--target",
        type=float,
        default=-20.0,
        help="Target loudness in dBFS (default: -20.0)"
    )
    parser.add_argument(
        "--loud",
        type=float,
        default=-16.0,
        help="Threshold above which files are considered loud (default: -16.0)"
    )
    parser.add_argument(
        "--quiet",
        type=float,
        default=-24.0,
        help="Threshold below which files are considered quiet (default: -24.0)"
    )
    parser.add_argument(
        "--min-adjustment",
        type=float,
        default=1.0,
        help="Minimum dB adjustment to make (default: 1.0)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Number of loud files to show in analysis (default: 20)"
    )

    args = parser.parse_args()

    # Build configuration
    config = NormalizationConfig(
        target_dbfs=args.target,
        loud_threshold=args.loud,
        quiet_threshold=args.quiet,
        min_adjustment=args.min_adjustment,
    )

    try:
        media_path = get_media_path()
        print(f"Media folder: {media_path}")

        # Get matching files
        files = get_matching_files(media_path)

        # Filter by pattern if specified
        if args.patterns:
            files = [(f, p) for f, p in files if p in args.patterns]

        print(f"Found {len(files)} matching files")

        if not files:
            print("No files to process.")
            return

        # Analyze all files
        analyzed = analyze_all_files(files, verbose=args.verbose)

        if args.analyze:
            print_statistics(analyzed, config)
            print_loud_files(analyzed, config, limit=args.limit)

        elif args.normalize:
            print_statistics(analyzed, config)
            normalize_loud_files(
                analyzed,
                config,
                dry_run=args.dry_run,
                patterns=args.patterns
            )

            if args.dry_run:
                print("\nTo apply changes, run again without --dry-run")

    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)


if __name__ == "__main__":
    main()
