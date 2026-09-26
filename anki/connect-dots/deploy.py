#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///
"""
Deploy ConnectDots templates and styling to Anki via AnkiConnect.

Only updates templates/styling if the content has changed. The deploying itself
is shared with the other note types (see utils/shared/anki_model_deploy.py).
"""

import sys
from pathlib import Path

# Add shared utilities to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "utils"))
from shared.anki_model_deploy import deploy_model_templates
from shared.cli import parse_no_arguments

MODEL_NAME = "ConnectDots"


def main() -> None:
    parse_no_arguments(__doc__)

    deploy_model_templates(MODEL_NAME, Path(__file__).resolve().parent)


if __name__ == "__main__":
    main()
