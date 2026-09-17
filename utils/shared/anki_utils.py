"""
Shared utilities for Anki Connect API interactions.

This module provides a common interface for communicating with the AnkiConnect addon.
"""

import base64
from typing import Any, NotRequired, TypedDict

import requests


class AnkiField(TypedDict):
    """A single field of a note, as returned inside `notesInfo` / `cardsInfo`."""

    value: str
    order: int


class AnkiNoteInfo(TypedDict):
    """
    One entry of AnkiConnect's `notesInfo` result.

    Only the keys AnkiConnect always returns are required; `cards` and `profile`
    depend on the AnkiConnect version, so they are optional.
    """

    noteId: int
    modelName: str
    tags: list[str]
    fields: dict[str, AnkiField]
    mod: NotRequired[int]
    cards: NotRequired[list[int]]
    profile: NotRequired[str]


class AnkiCardInfo(TypedDict):
    """
    One entry of AnkiConnect's `cardsInfo` result.

    `queue` and `type` use Anki's scheduler constants (e.g. queue -1 = suspended,
    0 = new; type 0 = new). For a new card, `due` is its position in the
    new-card queue rather than a timestamp.
    """

    cardId: int
    note: int
    deckName: str
    modelName: str
    fields: dict[str, AnkiField]
    ord: int
    type: int
    queue: int
    due: int
    ivl: NotRequired[int]
    interval: NotRequired[int]
    factor: NotRequired[int]
    reps: NotRequired[int]
    lapses: NotRequired[int]
    left: NotRequired[int]
    mod: NotRequired[int]


def get_field_value(note: AnkiNoteInfo, field_name: str, default: str = "") -> str:
    """
    Read a field's value off a note, stripped of surrounding whitespace.

    Args:
        note: Note dictionary as returned by `get_notes_info`
        field_name: Name of the field to read (e.g. "Traditional")
        default: Value to return when the field is absent or empty

    Returns:
        The field's stripped value, or `default` if the field is missing or blank
    """
    field = note["fields"].get(field_name)
    if field is None:
        return default
    return field["value"].strip() or default


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


def get_cards_info(card_ids: list[int]) -> list[AnkiCardInfo]:
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


def move_cards_to_deck(card_ids: list[int], deck: str) -> None:
    """
    Move the given cards to the specified deck, creating it if needed.

    Args:
        card_ids: List of card IDs to move
        deck: Name of the destination deck (e.g. "Chinese::MediaClips")
    """
    if not card_ids:
        return
    anki_connect_request("changeDeck", {"cards": card_ids, "deck": deck})
    print(f"Moved {len(card_ids)} card(s) to deck '{deck}'")


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


def get_notes_info(note_ids: list[int]) -> list[AnkiNoteInfo]:
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


def get_meaning_field(note: AnkiNoteInfo) -> str:
    """
    Get the meaning from a note, preferring "Meaning 2" over "Meaning".

    Args:
        note: Note dictionary with fields

    Returns:
        The meaning value, trying "Meaning 2" first, then "Meaning"
    """
    return get_field_value(note, "Meaning 2") or get_field_value(note, "Meaning")


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


def store_media_file(filename: str, data: bytes) -> str:
    """
    Store a file in Anki's media collection.

    Args:
        filename: Name of the file in Anki's media folder
        data: Raw file contents

    Returns:
        The stored filename as reported by AnkiConnect

    Raises:
        Exception: If AnkiConnect fails or reports an error
    """
    encoded = base64.b64encode(data).decode("utf-8")
    response = anki_connect_request("storeMediaFile", {"filename": filename, "data": encoded})

    stored = response.get("result")
    if not stored:
        raise Exception(f"Failed to store media file '{filename}' in Anki")
    print(f"Stored '{filename}' in Anki's media collection")
    return stored


def update_note_audio_field(note_id: int, audio_filename: str, field_name: str = "Audio") -> None:
    """
    Update an audio field of a note with a [sound:...] tag.

    Args:
        note_id: The note ID to update
        audio_filename: Name of the audio file in Anki's media collection
        field_name: Name of the audio field to update (default "Audio")

    Raises:
        Exception: If the update fails
    """
    update_note_fields(note_id, {field_name: f"[sound:{audio_filename}]"})
    print(f"Updated {field_name} field for note {note_id}")
