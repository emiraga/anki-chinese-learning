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
        raise Exception(f"Error connecting to AnkiConnect: {e}") from e

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


def suspend_cards(card_ids: list[int]) -> None:
    """Suspend the given cards."""
    if not card_ids:
        return
    anki_connect_request("suspend", {"cards": card_ids})


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


def set_due_date(card_ids: list[int], days: str) -> None:
    """
    Set the due date of the given cards using Anki's native set-due-date syntax.

    Args:
        card_ids: List of card IDs
        days: Anki set-due-date spec, e.g. "0" (today), "3" (in 3 days),
            "3-7" (random between 3 and 7 days). A trailing "!" also resets
            the interval; without it only the due date is moved.
    """
    if not card_ids:
        return
    anki_connect_request("setDueDate", {"cards": card_ids, "days": days})


def set_new_card_positions(positions: dict[int, int]) -> None:
    """
    Set the position of cards in the new-card queue.

    For a card that is still new, Anki stores its queue position in the `due`
    column, so repositioning is just a matter of writing that column. Cards are
    then introduced in ascending position order (subject to the deck's
    new-cards/day limit).

    Args:
        positions: Mapping of card id -> new queue position.

    Raises:
        Exception: If AnkiConnect rejects any of the writes.
    """
    if not positions:
        return

    items = list(positions.items())
    for i in range(0, len(items), 100):
        chunk = items[i : i + 100]
        actions = [
            {
                "action": "setSpecificValueOfCard",
                "params": {"card": card_id, "keys": ["due"], "newValues": [position]},
            }
            for card_id, position in chunk
        ]
        results = anki_connect_request("multi", {"actions": actions})["result"]
        for (card_id, position), result in zip(chunk, results, strict=True):
            # setSpecificValueOfCard returns one entry per key: True on success,
            # [False, message] otherwise. `multi` reports a failed action as a
            # dict holding the error message.
            if isinstance(result, dict) or any(entry is not True for entry in result):
                raise Exception(f"Failed to set position {position} on card {card_id}: {result}")


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
