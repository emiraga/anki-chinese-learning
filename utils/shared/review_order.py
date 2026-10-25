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
"""

from typing import Any

from .anki_utils import AnkiCardInfo, anki_connect_request

# ReviewCardOrder values from Anki's proto/anki/deck_config.proto
REVIEW_ORDER_DAY = 0
REVIEW_ORDER_DAY_THEN_DECK = 1
REVIEW_ORDER_DECK_THEN_DAY = 2
SUPPORTED_REVIEW_ORDERS = {
    REVIEW_ORDER_DAY: "Due date, then random",
    REVIEW_ORDER_DAY_THEN_DECK: "Due date, then deck",
    REVIEW_ORDER_DECK_THEN_DAY: "Deck, then due date",
}

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
    for deck_name in sorted(deck_names):
        config: dict[str, Any] = anki_connect_request("getDeckConfig", {"deck": deck_name})["result"]
        orders.setdefault(int(config["reviewOrder"]), []).append(deck_name)

    if len(orders) > 1:
        raise ValueError(f"Decks use different review sort orders: {orders}")
    (order,) = orders
    if order not in SUPPORTED_REVIEW_ORDERS:
        raise ValueError(f"Review sort order {order} is not supported, only: {SUPPORTED_REVIEW_ORDERS}")
    return order


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
