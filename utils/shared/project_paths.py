"""
Locations of the project's data files, and loaders for the per-character ones.

Every script under `utils/` and `anki/` reaches the same set of files: the raw
downloads under `data/`, the converted data the app serves from `public/data/`,
and a few single files. Resolving them here means a script never has to count
`parent` hops of its own, and a directory that moves is renamed in one place.
"""

import json
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
"""The repository root: the directory holding `pyproject.toml` and `package.json`."""

# Raw downloads, kept out of `public/` because the app never serves them.
RAW_DATA_DIR = PROJECT_ROOT / "data"
FREQUENCY_CSV = RAW_DATA_DIR / "frequency.csv"
HACKCHINESE_WORDS_DIR = RAW_DATA_DIR / "hackchinese" / "words"
PLECO_OUTLIER_HTML_DIR = RAW_DATA_DIR / "pleco" / "outlier_series"
PLECO_OUTLIER_HTML_TC_DIR = RAW_DATA_DIR / "pleco" / "outlier_series_tc"
RTEGA_HTML_DIR = RAW_DATA_DIR / "rtega"
TOCFL_CSV_DIR = RAW_DATA_DIR / "tocfl" / "20240923"

# Converted data, served by the dev server and the built app from `public/`.
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
DONG_DIR = PUBLIC_DATA_DIR / "dong"
HACKCHINESE_OUTLIER_DIR = PUBLIC_DATA_DIR / "hackchinese" / "outlier"
HANZIYUAN_RAW_DIR = PUBLIC_DATA_DIR / "hanziyuan" / "raw"
HANZIYUAN_CONVERTED_DIR = PUBLIC_DATA_DIR / "hanziyuan" / "converted"
HANZIYUAN_IMAGES_DIR = PUBLIC_DATA_DIR / "hanziyuan" / "images" / "etymology"
PLECO_IMAGES_DIR = PUBLIC_DATA_DIR / "pleco" / "images"
PLECO_OUTLIER_SERIES_DIR = PUBLIC_DATA_DIR / "pleco" / "outlier_series"
RTEGA_DIR = PUBLIC_DATA_DIR / "rtega"
YELLOWBRIDGE_RAW_DIR = PUBLIC_DATA_DIR / "yellowbridge" / "raw"
YELLOWBRIDGE_INFO_DIR = PUBLIC_DATA_DIR / "yellowbridge" / "info"
YELLOWBRIDGE_PROCESSED_JSON = PUBLIC_DATA_DIR / "yellowbridge" / "processed.json"

DONG_IMAGES_DIR = PROJECT_ROOT / "public" / "images" / "dong"

POS_JSON = PROJECT_ROOT / "app" / "data" / "pos.json"


def load_char_json(directory: Path, character: str) -> dict[str, Any] | None:
    """
    Load the `<character>.json` file a data directory holds for one character.

    Args:
        directory: Directory of per-character JSON files (e.g. `DONG_DIR`)
        character: The character whose file to read

    Returns:
        The parsed file, or None when the directory has no file for the
        character - that simply means the character was never downloaded.

    Raises:
        json.JSONDecodeError: If the file exists but does not hold valid JSON
    """
    json_file = directory / f"{character}.json"
    if not json_file.exists():
        return None

    with json_file.open(encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
    return data


def load_pos_mapping() -> dict[str, Any]:
    """
    Load `app/data/pos.json`, the part-of-speech codes shared with the app.

    Returns:
        Mapping of POS code (e.g. "N") to its description entry
    """
    with POS_JSON.open(encoding="utf-8") as f:
        pos_data: dict[str, Any] = json.load(f)
    return pos_data
