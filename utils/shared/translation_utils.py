#!/usr/bin/env python3
"""
Shared utilities for Google Cloud Translation API interactions.

This module provides a common interface for translating Chinese text to
English using the Google Cloud Translation API. The client is initialized
lazily and translations are stored in an in-memory cache to avoid redundant
API calls.
"""

import time
from typing import Any

# In-memory cache for translations
_translation_cache: dict[str, str] = {}
# Lazy-initialized translation client
_translation_client: Any = None


def get_translation_client() -> Any:
    """
    Get or initialize the Google Cloud Translation client lazily.

    Returns:
        Google Cloud Translation client
    """
    global _translation_client
    if _translation_client is None:
        print("Initializing Google Cloud Translation client...")
        from google.cloud import translate_v2 as translate  # type: ignore[attr-defined]

        _translation_client = translate.Client()
    return _translation_client


def get_translation_cache() -> dict[str, str]:
    """
    Get the in-memory translation cache.

    Returns:
        Dictionary mapping original text to its translation
    """
    return _translation_cache


def cache_translation(text: str, translation: str) -> None:
    """
    Add a text/translation pair to the in-memory cache.

    Args:
        text: Original text
        translation: Existing translation to cache
    """
    if text:
        _translation_cache[text] = translation


def clear_translation_cache() -> None:
    """Clear the in-memory translation cache."""
    _translation_cache.clear()


def translate_text_with_google(text: str, max_retries: int = 3, retry_delay: float = 2.0) -> str:
    """
    Translate Chinese text to English using Google Cloud Translation API.
    Uses in-memory cache to avoid redundant API calls.

    Args:
        text: Chinese text to translate
        max_retries: Maximum number of retry attempts
        retry_delay: Delay in seconds between retries

    Returns:
        Translated English text

    Raises:
        Exception: If translation fails after max retries
    """
    if not text or not text.strip():
        return ""

    # Check cache first
    cache = get_translation_cache()
    if text in cache:
        return cache[text]

    # Get client lazily
    client = get_translation_client()

    # Not in cache, translate it
    for attempt in range(max_retries):
        try:
            result = client.translate(text, source_language="zh-CN", target_language="en")
            translated_text = result["translatedText"]

            # Store in cache
            cache[text] = translated_text

            return translated_text
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Translation attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(retry_delay)
            else:
                raise Exception(f"Translation failed after {max_retries} attempts: {e}") from e

    # Unreachable when max_retries >= 1; satisfies the type checker.
    raise Exception("Translation failed: no attempts were made")
