"""
Locating the local video/audio clips referenced by LocalMediaClips notes.

The clips live outside the repository, in the directory the dev server mounts at
`/local-media/` (see `vite_serve_media.ts`). A note locates its clip with a
single `RelativeFilePath` field (the clip's movie folder plus its filename),
resolved against that directory - a relative path survives moving or renaming
the media directory, which an absolute one does not.

The media directory comes from the `MEDIA_DIR` environment variable, falling
back to the same default as `vite.config.ts`. Unlike Vite, these scripts do not
read `.env`, so pass it inline when it is not the default:

    MEDIA_DIR="~/clips" ./utils/video/fill_trimmed_audio.py
"""

import os
from pathlib import Path

# Keep in sync with DEFAULT_MEDIA_DIR in vite.config.ts.
DEFAULT_MEDIA_DIR = "~/InProgressTemporary/you are the apple of my eye"


def get_media_dir() -> Path:
    """Return the directory holding the clips, from `MEDIA_DIR` or the default."""
    return Path(os.environ.get("MEDIA_DIR") or DEFAULT_MEDIA_DIR).expanduser()


def resolve_clip_path(relative_path: str) -> Path:
    """
    Find a note's clip on disk, under the media directory.

    Args:
        relative_path: Value of the note's `RelativeFilePath` field

    Returns:
        The clip's path

    Raises:
        FileNotFoundError: If the field is empty, or the clip does not exist
    """
    if not relative_path:
        raise FileNotFoundError("note has an empty RelativeFilePath")

    clip_path = get_media_dir() / relative_path
    if not clip_path.is_file():
        raise FileNotFoundError(f"clip not found: {clip_path}; set MEDIA_DIR if the clips moved")
    return clip_path
