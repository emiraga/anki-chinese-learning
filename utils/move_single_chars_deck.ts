/**
 * Move all cards from Chinese::TOCFL::SingleChars to Chinese::SingleChars
 * so SingleChars appears at the same level as TOCFL, not under it.
 *
 * Usage: npx tsx utils/move_single_chars_deck.ts
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const OLD_DECK = "Chinese::TOCFL::SingleChars";
const NEW_DECK = "Chinese::SingleChars";

async function main() {
  const cardIds = await anki.card.findCards({ query: `deck:${OLD_DECK}` });
  if (cardIds.length === 0) {
    console.log(`No cards found in "${OLD_DECK}". Nothing to move.`);
    return;
  }

  console.log(`Found ${cardIds.length} card(s) in ${OLD_DECK}`);
  await anki.deck.createDeck({ deck: NEW_DECK });
  await anki.deck.changeDeck({ cards: cardIds, deck: NEW_DECK });
  console.log(`✓ Moved all cards to ${NEW_DECK}`);

  const remaining = await anki.card.findCards({ query: `deck:${OLD_DECK}` });
  if (remaining.length === 0) {
    console.log(`\nOld deck "${OLD_DECK}" is now empty. You can delete it in Anki (right-click deck → Delete).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
