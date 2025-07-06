import requests
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

class AnkiConnect:
    def __init__(self, url: str = "http://localhost:8765"):
        self.url = url

    def invoke(self, action: str, params: dict = None) -> dict:
        """Send request to anki-connect"""
        request_data = {
            "action": action,
            "version": 6,
            "params": params or {}
        }

        try:
            response = requests.post(self.url, json=request_data)
            response.raise_for_status()
            result = response.json()

            if result.get("error"):
                raise Exception(f"AnkiConnect error: {result['error']}")

            return result.get("result")
        except requests.RequestException as e:
            raise Exception(f"Failed to connect to Anki: {e}")


def chunk_list(lst: List, chunk_size: int) -> List[List]:
    """Split list into chunks of specified size"""
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def get_detailed_learning_info(note_type: str = "Hanzi", batch_size: int = 100) -> List[Dict]:
    """
    Get detailed information about when Hanzi notes were first learned using batch processing.

    Args:
        note_type: The note type to search for
        batch_size: Number of items to process in each batch

    Returns:
        List of dictionaries with detailed note and learning information
    """
    anki = AnkiConnect()

    print("Finding notes...")
    # Get all notes of the specified type
    note_ids = anki.invoke("findNotes", {"query": f"note:{note_type} -is:suspended -is:new"})

    if not note_ids:
        print(f"No notes found for note type: {note_type}")
        return []

    print(f"Found {len(note_ids)} notes. Processing in batches of {batch_size}...")

    # Get note info in batches
    all_notes_info = []
    note_chunks = chunk_list(note_ids, batch_size)

    for i, chunk in enumerate(note_chunks):
        print(f"Processing note batch {i+1}/{len(note_chunks)} ({len(chunk)} notes)")
        notes_info = anki.invoke("notesInfo", {"notes": chunk})
        all_notes_info.extend(notes_info)

    # Get all card IDs for all notes at once
    print("Getting card IDs for all notes...")
    all_card_ids = []
    note_to_cards = {}

    for note_info in all_notes_info:
        note_id = note_info["noteId"]
        card_ids = note_info["cards"]
        if card_ids:
            first_card_id = card_ids[0]
            all_card_ids.append(first_card_id)
            note_to_cards[note_id] = first_card_id

    if not all_card_ids:
        print("No cards found for any notes")
        return []

    print(f"Found {len(all_card_ids)} cards. Getting card info and reviews...")

    # Get all card info in batches
    all_cards_info = []
    card_chunks = chunk_list(all_card_ids, batch_size)

    for i, chunk in enumerate(card_chunks):
        print(f"Processing card info batch {i+1}/{len(card_chunks)} ({len(chunk)} cards)")
        cards_info = anki.invoke("cardsInfo", {"cards": chunk})
        all_cards_info.extend(cards_info)

    # Get all reviews in batches
    all_reviews = {}
    for i, chunk in enumerate(card_chunks):
        print(f"Processing reviews batch {i+1}/{len(card_chunks)} ({len(chunk)} cards)")
        reviews_batch = anki.invoke("getReviewsOfCards", {"cards": chunk})
        all_reviews.update(reviews_batch)

    print("Processing learning data...")

    # Create lookup dictionaries for efficient access
    card_info_lookup = {card['cardId']: card for card in all_cards_info}

    learning_data = []

    for note_info in all_notes_info:
        note_id = note_info["noteId"]

        if note_id not in note_to_cards:
            continue

        card_id = note_to_cards[note_id]
        card_reviews = all_reviews.get(str(card_id), [])

        if card_reviews:
            # Find the earliest review
            earliest_review = min(card_reviews, key=lambda x: x['id'])
            first_review_timestamp = earliest_review['id']

            # Convert from milliseconds to datetime
            first_review_date = datetime.fromtimestamp(first_review_timestamp / 1000)

            # Get note fields
            fields = note_info.get("fields", {})

            # Get card info from lookup
            card_info = card_info_lookup.get(card_id, {})

            learning_info = {
                "note_id": str(note_id),
                "traditional": fields.get("Traditional", {}).get("value", ""),
                "hanzi": fields.get("Hanzi", {}).get("value", ""),
                "first_review_date": first_review_date,
                "card_id": card_id,
                "total_reviews": len(card_reviews),
                "card_reps": card_info.get("reps", 0),
                "fields": fields
            }

            learning_data.append(learning_info)

    # Sort by first review date
    learning_data.sort(key=lambda x: x["first_review_date"])

    # Add order numbers
    for i, item in enumerate(learning_data, 1):
        item["learning_order"] = i

    return learning_data


def main():
    hanzi = get_detailed_learning_info(note_type="Hanzi", batch_size=100)
    for info in hanzi:
        traditional = info.get("traditional", "N/A")
        date_str = info['first_review_date'].strftime('%Y-%m-%d %H:%M:%S')
        reviews = info['total_reviews']
        print(f"{info['learning_order']:3d}. {traditional:2s} - {date_str} ({reviews} reviews)")

    props = get_detailed_learning_info(note_type="Props", batch_size=100)
    for info in props:
        hanzi = info.get("hanzi", "N/A")
        date_str = info['first_review_date'].strftime('%Y-%m-%d %H:%M:%S')
        reviews = info['total_reviews']
        print(f"{info['learning_order']:3d}. {hanzi:2s} - {date_str} ({reviews} reviews)")

if __name__ == "__main__":
    main()
