"""
The order in which Anki shows due cards, reproduced outside of Anki.

Scripts that prepare notes a little at a time (for example, generating content
for the cards due today) handle the cards that are about to be reviewed first.
AnkiConnect has no call that returns the review queue, so the v3 scheduler's
ordering is rebuilt here from the cards and their deck options. It follows
`review_order_sql` in Anki's `rslib/src/storage/card/mod.rs`:

- the deck options' review sort order picks the leading keys: due day and/or
  deck position (decks in deck-tree order);
- ties are broken by `fnvhash(id, mod)`: an FNV-1a hash of the card id and its
  modification time, which looks random but is stable until the card changes.

Learning cards (intraday and interday) are placed before reviews. Anki mixes
them in by due time instead, so this part is an approximation.

New cards are only predictable when the deck options gather them by ascending
position: then they come up in the order of their position (the `due` value of
a new card). The random gather orders are seeded by the day and cannot be
predicted for the days ahead.
"""

from typing import Any

from .anki_utils import AnkiCardInfo, anki_connect_request, find_cards_by_query, get_cards_info

# ReviewCardOrder values from Anki's proto/anki/deck_config.proto
REVIEW_ORDER_DAY = 0
REVIEW_ORDER_DAY_THEN_DECK = 1
REVIEW_ORDER_DECK_THEN_DAY = 2
SUPPORTED_REVIEW_ORDERS = {
    REVIEW_ORDER_DAY: "Due date, then random",
    REVIEW_ORDER_DAY_THEN_DECK: "Due date, then deck",
    REVIEW_ORDER_DECK_THEN_DAY: "Deck, then due date",
}

# NewCardGatherPriority value from Anki's proto/anki/deck_config.proto
NEW_GATHER_LOWEST_POSITION = 1

# Card queues (Anki's `queue` column)
QUEUE_LEARNING = 1
QUEUE_INTERDAY_LEARNING = 3

FNV_OFFSET_BASIS = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
UINT64_MASK = 0xFFFFFFFFFFFFFFFF


def anki_fnvhash(*values: int) -> int:
    """
    Compute Anki's `fnvhash()` SQL function.

    Anki feeds each argument to Rust's `FnvHasher::write_i64`, i.e. FNV-1a over
    the value's 8 little-endian bytes, and returns the hash as a signed 64-bit
    integer - so it is compared (and sorted) as signed.

    Args:
        values: The 64-bit integer arguments, in order

    Returns:
        The hash as a signed 64-bit integer
    """
    hash_value = FNV_OFFSET_BASIS
    for value in values:
        for byte in (value & UINT64_MASK).to_bytes(8, "little"):
            hash_value = ((hash_value ^ byte) * FNV_PRIME) & UINT64_MASK
    return hash_value - (1 << 64) if hash_value >= 1 << 63 else hash_value


def get_review_order(deck_names: set[str]) -> int:
    """
    Read the review sort order the given decks' options use.

    Raises:
        ValueError: If the decks use different review sort orders, or one that
            this module cannot reproduce
    """
    orders: dict[int, list[str]] = {}
    for deck_name, config in get_deck_configs(deck_names).items():
        orders.setdefault(int(config["reviewOrder"]), []).append(deck_name)

    if len(orders) > 1:
        raise ValueError(f"Decks use different review sort orders: {orders}")
    (order,) = orders
    if order not in SUPPORTED_REVIEW_ORDERS:
        raise ValueError(f"Review sort order {order} is not supported, only: {SUPPORTED_REVIEW_ORDERS}")
    return order


def get_deck_configs(deck_names: set[str]) -> dict[str, dict[str, Any]]:
    """
    Read the deck options of the given decks.

    Returns:
        Deck name mapped to its deck options (AnkiConnect's getDeckConfig result)
    """
    return {deck_name: anki_connect_request("getDeckConfig", {"deck": deck_name})["result"] for deck_name in sorted(deck_names)}


def sort_cards_in_review_order(cards: list[AnkiCardInfo]) -> list[AnkiCardInfo]:
    """
    Sort due cards in the order Anki's review queue shows them.

    Args:
        cards: Due cards, e.g. from `get_cards_info` on an `is:due` search

    Returns:
        The cards, first-shown first

    Raises:
        ValueError: If the decks' review sort order is not supported
    """
    if not cards:
        return []

    order = get_review_order({card["deckName"] for card in cards})
    # Decks are listed in deck-tree order: by each level's name, case-insensitively
    deck_names = sorted({card["deckName"] for card in cards}, key=lambda name: [part.lower() for part in name.split("::")])
    deck_position = {name: position for position, name in enumerate(deck_names)}

    def sort_key(card: AnkiCardInfo) -> tuple[int, ...]:
        if "mod" not in card:
            raise ValueError(f"Card {card['cardId']} has no modification time; AnkiConnect's cardsInfo should return it")
        learning_first = 0 if card["queue"] in (QUEUE_LEARNING, QUEUE_INTERDAY_LEARNING) else 1
        deck = deck_position[card["deckName"]]
        tie_breaker = anki_fnvhash(card["cardId"], card["mod"])
        if order == REVIEW_ORDER_DECK_THEN_DAY:
            return (learning_first, deck, card["due"], tie_breaker)
        if order == REVIEW_ORDER_DAY_THEN_DECK:
            return (learning_first, card["due"], deck, tie_breaker)
        return (learning_first, card["due"], tie_breaker)

    return sorted(cards, key=sort_key)


def sort_new_cards_in_queue_order(cards: list[AnkiCardInfo]) -> list[AnkiCardInfo]:
    """
    Sort new cards in the order Anki introduces them: by ascending position,
    siblings sharing a position by template.

    Args:
        cards: New cards, e.g. from `get_cards_info` on an `is:new` search

    Returns:
        The cards, first-introduced first

    Raises:
        ValueError: If a deck does not gather new cards by ascending position,
            since then the order cannot be predicted
    """
    if not cards:
        return []

    random_decks = [
        deck_name
        for deck_name, config in get_deck_configs({card["deckName"] for card in cards}).items()
        if int(config["newGatherPriority"]) != NEW_GATHER_LOWEST_POSITION
    ]
    if random_decks:
        raise ValueError(
            f"Decks {random_decks} do not gather new cards by ascending position, so their order cannot be predicted."
            " Set 'New card gather order' to 'Ascending position' in the deck options."
        )
    return sorted(cards, key=lambda card: (card["due"], card["ord"]))


def find_note_ids_in_upcoming_order(base_query: str, upcoming_days: int, include_new: bool = False) -> list[int]:
    """
    Find the notes with a card matching base_query that is due now (overdue or
    today) or within upcoming_days days, ordered by when their first such card
    comes up: due-now cards in review order, then the upcoming ones likewise
    ordered, then (with include_new) the new cards in the order they are introduced.

    Args:
        base_query: Anki search the cards must match, e.g. "note:TOCFL -is:suspended"
        upcoming_days: How many days ahead to include cards that are not due yet
        include_new: Also include notes with a new card, after the due ones

    Returns:
        Note ids, first-shown first, without duplicates

    Raises:
        ValueError: If the decks' review sort order or new card gather order
            is not supported
    """
    cards = sort_cards_in_review_order(get_cards_info(find_cards_by_query(f"{base_query} is:due")))
    cards += sort_cards_in_review_order(get_cards_info(find_cards_by_query(f"{base_query} -is:due prop:due>=1 prop:due<={upcoming_days}")))
    if include_new:
        cards += sort_new_cards_in_queue_order(get_cards_info(find_cards_by_query(f"{base_query} is:new")))
    return list(dict.fromkeys(card["note"] for card in cards))
