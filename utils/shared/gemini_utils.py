#!/usr/bin/env python3
"""
Shared utilities for Google Gemini API interactions.

This module provides a common interface for working with the Google Gemini API.
"""

import os
import time
from pathlib import Path
from typing import Any


def get_gemini_api_key(credentials_path: str | Path | None = None) -> str:
    """
    Get Gemini API key from various sources.

    Attempts to find the API key in the following order:
    1. API key file (utils/tts/gcloud_api_key.txt)
    2. Credentials JSON file (gemini_api_key field)
    3. GEMINI_API_KEY environment variable

    Args:
        credentials_path: Optional path to credentials JSON file.
                         If not provided, uses utils/tts/gcloud_account.json

    Returns:
        The Gemini API key

    Raises:
        Exception: If no API key is found
    """
    api_key = None

    # Find project root (parent of utils/shared)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent

    # Try to get from API key file first
    api_key_path = project_root / 'utils' / 'tts' / 'gcloud_api_key.txt'
    if api_key_path.exists():
        with open(api_key_path) as f:
            api_key = f.read().strip()
            if api_key:
                return api_key

    # Try credentials JSON file
    if credentials_path is None:
        credentials_path = project_root / 'utils' / 'tts' / 'gcloud_account.json'
    else:
        credentials_path = Path(credentials_path)

    if credentials_path.exists():
        import json
        with open(credentials_path) as f:
            creds = json.load(f)
            api_key = creds.get('gemini_api_key')
            if api_key:
                return api_key

    # Try environment variable
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        return api_key

    raise Exception(
        "Gemini API key not found. Please either:\n"
        "1. Create utils/tts/gcloud_api_key.txt with your API key\n"
        "2. Add 'gemini_api_key' field to utils/tts/gcloud_account.json\n"
        "3. Set GEMINI_API_KEY environment variable\n\n"
        "Get an API key at: https://aistudio.google.com/apikey"
    )


def create_gemini_client(api_key: str | None = None) -> Any:
    """
    Create a Google Gemini client.

    Args:
        api_key: Optional API key. If not provided, will be retrieved
                 using get_gemini_api_key()

    Returns:
        A genai.Client instance

    Raises:
        Exception: If API key is not found or client creation fails
    """
    from google import genai

    if api_key is None:
        api_key = get_gemini_api_key()

    return genai.Client(api_key=api_key)


def gemini_generate(
    prompt: str,
    client: Any | None = None,
    model_name: str = "gemini-2.5-flash",
    max_retries: int = 3,
    retry_delay: float = 2.0
) -> str:
    """
    Generate content using Google Gemini API.

    Args:
        prompt: The prompt to send to the model
        client: Optional genai.Client instance. If not provided, one will be created.
        model_name: Model name to use (default: gemini-2.5-flash)
        max_retries: Maximum number of retry attempts
        retry_delay: Delay in seconds between retries

    Returns:
        Generated text response

    Raises:
        ValueError: If prompt is empty
        Exception: If generation fails after all retries
    """
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")

    if client is None:
        client = create_gemini_client()

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
            return response.text.strip()
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Generation attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(retry_delay)
            else:
                raise Exception(f"Generation failed after {max_retries} attempts: {e}")

    # This should never be reached, but satisfies type checker
    raise Exception("Unexpected error in gemini_generate")


def translate_with_gemini(
    traditional_text: str,
    client: Any | None = None,
    model_name: str = "gemini-2.5-flash",
    max_retries: int = 3
) -> str:
    """
    Use Google Gemini API to translate Chinese text to English.
    Better at understanding idioms and colloquial expressions.

    Args:
        traditional_text: Traditional Chinese text
        client: Optional genai.Client instance. If not provided, one will be created.
        model_name: Model name to use
        max_retries: Maximum number of retry attempts

    Returns:
        English translation

    Raises:
        ValueError: If text is empty
        Exception: If translation fails after all retries
    """
    if not traditional_text or not traditional_text.strip():
        raise ValueError("Text cannot be empty")

    prompt = f"""Translate this Traditional Chinese text to English. If it contains idioms or colloquial expressions, translate the meaning, not literally.

Traditional Chinese: {traditional_text}

Provide only the English translation, nothing else."""

    return gemini_generate(
        prompt=prompt,
        client=client,
        model_name=model_name,
        max_retries=max_retries
    )
