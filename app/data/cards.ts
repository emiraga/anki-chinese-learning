// TODO: migrate this to config
export const CARDS_INFO: { [key: string]: { name: string; deck: string }[] } = {
  TOCFL: [
    // { name: "traditional", deck: "Chinese::.Phrases" },
    { name: "meaning", deck: "Chinese::.Phrases" },
    { name: "listening", deck: "Chinese::.Listening" },
    { name: "reading", deck: "Chinese::.Phrases" },
    { name: "cloze", deck: "Chinese::.Cloze" },
  ],
  Hanzi: [
    { name: "Recognize Hanzi", deck: "Chinese::.CharsProps" },
    { name: "Simplified", deck: "Chinese::.Simplified" },
  ],
  Props: [
    { name: "Recognize prop", deck: "Chinese::.CharsProps" },
    { name: "Name of prop", deck: "Chinese::.CharsProps" },
  ],
  Actors: [
    { name: "Actor", deck: "Chinese::.CharsProps" },
    { name: "Actor", deck: "Chinese::.CharsProps" },
  ],
  Places: [
    { name: "Place", deck: "Chinese::.CharsProps" },
    { name: "Place", deck: "Chinese::.CharsProps" },
  ],
  Location: [
    { name: "Location", deck: "Chinese::.CharsProps" },
    { name: "Location", deck: "Chinese::.CharsProps" },
  ],
};

// A deck path component starting with this character stands for "any single
// Latin letter here", e.g. "Chinese::.Connect" matches "Chinese::aConnect".
// The Chinese subdecks carry a sort-order letter prefix that changes whenever
// the decks are reordered, so we refer to them without it. Mirrors
// DECK_LETTER_PLACEHOLDER in utils/shared/anki_utils.py.
export const DECK_LETTER_PLACEHOLDER = ".";

// Whether an actual deck name (e.g. from a card's `deckName`) matches a deck
// name that may contain DECK_LETTER_PLACEHOLDER components.
export function deckMatches(pattern: string, deckName: string): boolean {
  const patternParts = pattern.split("::");
  const deckParts = deckName.split("::");
  return (
    patternParts.length === deckParts.length &&
    patternParts.every((part, i) =>
      part.startsWith(DECK_LETTER_PLACEHOLDER)
        ? /^[A-Za-z]/.test(deckParts[i]) &&
          deckParts[i].slice(1) === part.slice(DECK_LETTER_PLACEHOLDER.length)
        : part === deckParts[i],
    )
  );
}
