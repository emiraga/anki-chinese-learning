"""
Deploying a note type's card templates and styling from the repository to Anki.

Each note type under `anki/<name>/` keeps its front template, back template and
CSS as files, so they can be edited and reviewed like any other source. The
deploy script in that directory hands the directory and the model's name to
`deploy_model_templates()`, which pushes whatever differs from what Anki
currently has - showing a diff of every change it makes.
"""

import difflib
from pathlib import Path

from .anki_utils import anki_connect_request

# ANSI colors
RED = "\033[91m"
GREEN = "\033[92m"
CYAN = "\033[96m"
RESET = "\033[0m"

FRONT_TEMPLATE_FILE = "front-template.html"
BACK_TEMPLATE_FILE = "back-template.html"
STYLING_FILE = "styling.css"


def _get_current_templates(model_name: str) -> dict[str, dict[str, str]]:
    """Get a model's current templates from Anki, keyed by card name."""
    response = anki_connect_request("modelTemplates", {"modelName": model_name})
    return response.get("result", {})


def _get_current_styling(model_name: str) -> str:
    """Get a model's current CSS styling from Anki."""
    response = anki_connect_request("modelStyling", {"modelName": model_name})
    result = response.get("result", {})
    return result.get("css", "")


def _normalize_whitespace(text: str) -> str:
    """Normalize whitespace for comparison."""
    return text.strip()


def _show_diff(name: str, old: str, new: str, max_lines: int = 10**9) -> None:
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


def deploy_model_templates(model_name: str, base_dir: Path, card_name: str = "Card 1") -> None:
    """
    Push a note type's templates and styling to Anki, if they changed.

    Args:
        model_name: Name of the note type in Anki (e.g. "ConnectDots")
        base_dir: Directory holding front-template.html, back-template.html and styling.css
        card_name: Name of the card template to update

    Raises:
        Exception: If the model does not exist in Anki, or AnkiConnect fails
        OSError: If one of the local files is missing
    """
    print(f"Deploying {model_name} templates to Anki...")

    local_front = (base_dir / FRONT_TEMPLATE_FILE).read_text()
    local_back = (base_dir / BACK_TEMPLATE_FILE).read_text()
    local_css = (base_dir / STYLING_FILE).read_text()

    current_templates = _get_current_templates(model_name)
    current_css = _get_current_styling(model_name)

    if not current_templates:
        raise Exception(f"Model '{model_name}' not found in Anki")

    card_template = current_templates.get(card_name, {})
    current_front = card_template.get("Front", "")
    current_back = card_template.get("Back", "")

    updates_made: list[str] = []

    # Compare and update templates
    front_changed = _normalize_whitespace(local_front) != _normalize_whitespace(current_front)
    back_changed = _normalize_whitespace(local_back) != _normalize_whitespace(current_back)

    if front_changed or back_changed:
        if front_changed:
            print("  Front template: changed")
            _show_diff(FRONT_TEMPLATE_FILE, current_front, local_front)
        if back_changed:
            print("  Back template: changed")
            _show_diff(BACK_TEMPLATE_FILE, current_back, local_back)
        print("  Updating templates...")
        anki_connect_request(
            "updateModelTemplates",
            {"model": {"name": model_name, "templates": {card_name: {"Front": local_front, "Back": local_back}}}},
        )
        updates_made.append("templates")
    else:
        print("  Templates: no changes")

    # Compare and update styling
    if _normalize_whitespace(local_css) != _normalize_whitespace(current_css):
        print("  Styling: changed")
        _show_diff(STYLING_FILE, current_css, local_css)
        print("  Updating styling...")
        anki_connect_request("updateModelStyling", {"model": {"name": model_name, "css": local_css}})
        updates_made.append("styling")
    else:
        print("  Styling: no changes")

    if updates_made:
        print(f"\nUpdated: {', '.join(updates_made)}")
    else:
        print("\nNo updates needed - everything is in sync.")
