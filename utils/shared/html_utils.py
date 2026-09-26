"""
HTML helpers for the fields these scripts build and write into Anki notes.
"""


def escape_html(text: str) -> str:
    """
    Escape the characters that would otherwise be read as HTML markup.

    Args:
        text: Text to escape

    Returns:
        The text with `&`, `<`, `>`, `"` and `'` replaced by entities
    """
    if not text:
        return text
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")
