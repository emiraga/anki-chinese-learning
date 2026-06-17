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

    request_data = {"action": action, "params": params, "version": 6}

    try:
        response = requests.post("http://localhost:8765", json=request_data)
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Error connecting to AnkiConnect: {e}")

    if result.get("error"):
        raise Exception(f"AnkiConnect error: {result['error']}")

    return result


def find_notes_by_query(query: str) -> list[int]:
    """
    Find notes matching a query.

    Args:
        query: Anki search query

    Returns:
        List of note IDs
    """
    response = anki_connect_request("findNotes", {"query": query})
    return response.get("result", [])


def find_cards_by_query(query: str) -> list[int]:
    """
    Find cards matching a query.

    Args:
        query: Anki search query

    Returns:
        List of card IDs
    """
    response = anki_connect_request("findCards", {"query": query})
    return response.get("result", [])


def get_cards_info(card_ids: list[int]) -> list[dict[str, Any]]:
    """
    Get detailed information about multiple cards.

    Args:
        card_ids: List of card IDs

    Returns:
        List of card information dictionaries (includes 'note', 'queue', 'type', 'ord', ...)
    """
    if not card_ids:
        return []

    response = anki_connect_request("cardsInfo", {"cards": card_ids})
    return response.get("result", [])


def unsuspend_cards(card_ids: list[int]) -> None:
    """Unsuspend the given cards."""
    if not card_ids:
        return
    anki_connect_request("unsuspend", {"cards": card_ids})


def forget_cards(card_ids: list[int]) -> None:
    """Reset the given cards to the 'new' state, discarding scheduling history."""
    if not card_ids:
        return
    anki_connect_request("forgetCards", {"cards": card_ids})


def add_tags(note_ids: list[int], tags: str) -> None:
    """Add the given space-separated tags to the notes."""
    if not note_ids:
        return
    anki_connect_request("addTags", {"notes": note_ids, "tags": tags})


def remove_tags(note_ids: list[int], tags: str) -> None:
    """Remove the given space-separated tags from the notes."""
    if not note_ids:
        return
    anki_connect_request("removeTags", {"notes": note_ids, "tags": tags})


def get_notes_info(note_ids: list[int]) -> list[dict[str, Any]]:
    """
    Get detailed information about multiple notes.

    Args:
        note_ids: List of note IDs

    Returns:
        List of note information dictionaries
    """
    if not note_ids:
        return []

    response = anki_connect_request("notesInfo", {"notes": note_ids})

    if response and response.get("result"):
        return response["result"]

    raise Exception("Failed to fetch notes")


def get_meaning_field(note: dict[str, Any]) -> str:
    """
    Get the meaning from a note, preferring "Meaning 2" over "Meaning".

    Args:
        note: Note dictionary with fields

    Returns:
        The meaning value, trying "Meaning 2" first, then "Meaning"
    """
    meaning_2 = note["fields"].get("Meaning 2", {}).get("value", "").strip()
    if meaning_2:
        return meaning_2
    return note["fields"].get("Meaning", {}).get("value", "").strip()


def update_note_fields(note_id: int, fields: dict[str, str]) -> None:
    """
    Update fields on an existing note.

    Args:
        note_id: The note ID to update
        fields: Dictionary of field names to new values

    Raises:
        Exception: If the update fails
    """
    anki_connect_request("updateNoteFields", {"note": {"id": note_id, "fields": fields}})
