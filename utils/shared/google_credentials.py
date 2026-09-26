"""
The Google Cloud credentials the scripts calling Google APIs share.

Text-to-speech, translation and Gemini all authenticate with the same
service-account file, which is not in the repository - see the README. Scripts
point the Google client libraries at it through `setup_google_credentials()`.
"""

import os
from pathlib import Path

from .project_paths import PROJECT_ROOT

GOOGLE_CREDENTIALS_PATH = PROJECT_ROOT / "utils" / "tts" / "gcloud_account.json"
"""Service-account JSON used by the Google Cloud client libraries."""

GEMINI_API_KEY_PATH = PROJECT_ROOT / "utils" / "tts" / "gcloud_api_key.txt"
"""Optional plain-text file holding just a Gemini API key."""


def setup_google_credentials(credentials_path: str | Path | None = None) -> Path:
    """
    Point the Google client libraries at the service-account credentials.

    Args:
        credentials_path: Credentials file to use instead of the default

    Returns:
        The credentials file that was selected

    Raises:
        FileNotFoundError: If the credentials file does not exist
    """
    path = Path(credentials_path) if credentials_path else GOOGLE_CREDENTIALS_PATH

    if not path.exists():
        raise FileNotFoundError(
            f"Google Cloud credentials file not found at {path}. Place the service-account JSON there, or pass --credentials with its path."
        )

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)
    return path
