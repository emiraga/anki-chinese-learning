/**
 * Print card count for Chinese::SingleChars deck.
 * Usage: npx tsx utils/count_singlechars_cards.ts
 */
import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const DECK = "Chinese::SingleChars";

async function main() {
  const cardIds = await anki.card.findCards({ query: `deck:"${DECK}"` });
  const noteIds = await anki.note.findNotes({ query: `deck:"${DECK}"` });
  console.log(`Deck: ${DECK}`);
  console.log(`Cards: ${cardIds.length}`);
  console.log(`Notes: ${noteIds.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
