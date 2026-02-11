#!/usr/bin/env python3
"""
Shared utilities for Anki Connect API interactions.

This module provides a common interface for communicating with the AnkiConnect addon.
"""

from typing import Any
import requests


def anki_connect_request(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Send a request to AnkiConnect.

    Args:
        action: The AnkiConnect action to perform
        params: Parameters for the action

    Returns:
        Response from AnkiConnect

    Raises:
        Exception: If the request fails or AnkiConnect returns an error
    """
    if params is None:
        params = {}

    request_data = {
        "action": action,
        "params": params,
        "version": 6
    }

    try:
        response = requests.post("http://localhost:8765", json=request_data)
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error connecting to AnkiConnect: {e}")

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    return result
