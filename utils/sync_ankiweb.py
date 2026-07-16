#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests",
# ]
# ///
"""
Trigger a synchronization between the local Anki desktop client and AnkiWeb.

This is the same as pressing the sync button in the Anki desktop app. It uses
the AnkiWeb credentials already configured in the desktop client, so the profile
must already be logged in to AnkiWeb.
"""

import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.anki_utils import anki_connect_request


def sync() -> None:
    """Trigger a synchronization with AnkiWeb (same as the desktop sync button)."""
    print("⋯ Syncing with AnkiWeb...")
    anki_connect_request("sync")
    print("✓ Sync triggered")


if __name__ == "__main__":
    try:
        sync()
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)
