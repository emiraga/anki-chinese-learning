#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
# ]
# ///
"""
Deploy ConnectDots templates and styling to Anki via AnkiConnect.

Only updates templates/styling if the content has changed.
"""

import difflib
from pathlib import Path
from typing import Any

import requests


# ANSI colors
RED = "\033[91m"
GREEN = "\033[92m"
CYAN = "\033[96m"
RESET = "\033[0m"


def anki_connect_request(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Send a request to AnkiConnect."""
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    response = requests.post("http://localhost:8765", json=request_data)
    response.raise_for_status()
    result = response.json()

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    return result

MODEL_NAME = "ConnectDots"
CARD_NAME = "Card 1"


def get_local_files() -> tuple[str, str, str]:
    """Read local template and styling files."""
    base_dir = Path(__file__).parent

    front_template = (base_dir / "front-template.html").read_text()
    back_template = (base_dir / "back-template.html").read_text()
    styling = (base_dir / "styling.css").read_text()

    return front_template, back_template, styling


def get_current_templates() -> dict[str, dict[str, str]]:
    """Get current templates from Anki."""
    response = anki_connect_request("modelTemplates", {"modelName": MODEL_NAME})
    return response.get("result", {})


def get_current_styling() -> str:
    """Get current CSS styling from Anki."""
    response = anki_connect_request("modelStyling", {"modelName": MODEL_NAME})
    result = response.get("result", {})
    return result.get("css", "")


def update_templates(front: str, back: str) -> None:
    """Update templates in Anki."""
    anki_connect_request("updateModelTemplates", {
        "model": {
            "name": MODEL_NAME,
            "templates": {
                CARD_NAME: {
                    "Front": front,
                    "Back": back
                }
            }
        }
    })


def update_styling(css: str) -> None:
    """Update CSS styling in Anki."""
    anki_connect_request("updateModelStyling", {
        "model": {
            "name": MODEL_NAME,
            "css": css
        }
    })


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace for comparison."""
    return text.strip()


def show_diff(name: str, old: str, new: str, max_lines: int = 8) -> None:
    """Show a compact diff of changes."""
    old_lines = old.strip().splitlines()
    new_lines = new.strip().splitlines()

    diff = list(difflib.unified_diff(old_lines, new_lines, lineterm=""))
    if len(diff) <= 2:  # Just headers, no actual diff
        return

    # Skip the --- and +++ headers
    diff_lines = diff[2:]

    print(f"    {CYAN}Diff for {name}:{RESET}")
    shown = 0
    for line in diff_lines:
        if shown >= max_lines:
            remaining = len(diff_lines) - shown
            if remaining > 0:
                print(f"    ... and {remaining} more lines")
            break
        if line.startswith("+"):
            print(f"    {GREEN}{line}{RESET}")
            shown += 1
        elif line.startswith("-"):
            print(f"    {RED}{line}{RESET}")
            shown += 1
        elif line.startswith("@@"):
            print(f"    {CYAN}{line}{RESET}")
            shown += 1


def main() -> None:
    print(f"Deploying {MODEL_NAME} templates to Anki...")

    # Read local files
    local_front, local_back, local_css = get_local_files()

    # Get current state from Anki
    current_templates = get_current_templates()
    current_css = get_current_styling()

    if not current_templates:
        raise Exception(f"Model '{MODEL_NAME}' not found in Anki")

    card_template = current_templates.get(CARD_NAME, {})
    current_front = card_template.get("Front", "")
    current_back = card_template.get("Back", "")

    updates_made = []

    # Compare and update templates
    front_changed = normalize_whitespace(local_front) != normalize_whitespace(current_front)
    back_changed = normalize_whitespace(local_back) != normalize_whitespace(current_back)

    if front_changed or back_changed:
        if front_changed:
            print("  Front template: changed")
            show_diff("front-template.html", current_front, local_front)
        if back_changed:
            print("  Back template: changed")
            show_diff("back-template.html", current_back, local_back)
        print("  Updating templates...")
        update_templates(local_front, local_back)
        updates_made.append("templates")
    else:
        print("  Templates: no changes")

    # Compare and update styling
    if normalize_whitespace(local_css) != normalize_whitespace(current_css):
        print("  Styling: changed")
        show_diff("styling.css", current_css, local_css)
        print("  Updating styling...")
        update_styling(local_css)
        updates_made.append("styling")
    else:
        print("  Styling: no changes")

    if updates_made:
        print(f"\nUpdated: {', '.join(set(updates_made))}")
    else:
        print("\nNo updates needed - everything is in sync.")


if __name__ == "__main__":
    main()
