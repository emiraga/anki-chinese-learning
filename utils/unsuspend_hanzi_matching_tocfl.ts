/**
 * Unsuspend Hanzi (single-character) notes whose character appears in active TOCFL notes.
 *
 * Active TOCFL = note:TOCFL -is:suspended. Each note's Traditional field is scanned:
 * single-character notes add that character; multi-character phrases are split into CJK chars.
 *
 * Dry run by default (list only). Use --apply to unsuspend matching suspended Hanzi cards.
 *
 * Default Hanzi deck: "Chinese::CharsProps". Override: --hanzi-deck "YourDeckName"
 *
 * Usage:
 *   npx tsx utils/unsuspend_hanzi_matching_tocfl.ts
 *   npx tsx utils/unsuspend_hanzi_matching_tocfl.ts --apply
 *   npx tsx utils/unsuspend_hanzi_matching_tocfl.ts --hanzi-deck "Hanzi"
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const BATCH = 100;

const NOTE_TOCFL = "TOCFL";
const NOTE_HANZI = "Hanzi";

const CJK = /[\u4e00-\u9fff]/g;

/** Every CJK character in Traditional (phrases are broken into individual characters). */
function cjkCharsFromTraditional(traditional: string): string[] {
  const t = traditional.trim();
  if (!t) return [];
  return t.match(CJK) ?? [];
}

function isSingleCjkTraditional(s: string): boolean {
  const t = s.trim();
  return t.length === 1 && /[\u4e00-\u9fff]/.test(t);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const deckArg = process.argv.indexOf("--hanzi-deck");
  const hanziDeck =
    deckArg >= 0 && process.argv[deckArg + 1]
      ? process.argv[deckArg + 1]
      : "Chinese::CharsProps";

  console.log(
    "AnkiConnect: loading active TOCFL notes (singles + characters from phrases)...\n",
  );

  const tocflNoteIds = await anki.note.findNotes({
    query: `note:${NOTE_TOCFL} -is:suspended`,
  });
  const tocflActiveChars = new Set<string>();
  let multiCharPhraseCount = 0;
  let singleCharNoteCount = 0;
  for (let i = 0; i < tocflNoteIds.length; i += BATCH) {
    const chunk = tocflNoteIds.slice(i, i + BATCH);
    const infos = await anki.note.notesInfo({ notes: chunk });
    for (const n of infos) {
      const t = (n.fields?.Traditional?.value ?? "").trim();
      const chars = cjkCharsFromTraditional(t);
      for (const ch of chars) tocflActiveChars.add(ch);
      if (chars.length > 1) multiCharPhraseCount++;
      else if (chars.length === 1) singleCharNoteCount++;
    }
  }
  console.log(
    `Active TOCFL notes: ${tocflNoteIds.length} total; ${singleCharNoteCount} single-char; ${multiCharPhraseCount} multi-character phrase(s).`,
  );
  console.log(
    `Unique CJK character(s) covered (including from phrase breakdown): ${tocflActiveChars.size}.\n`,
  );

  const hanziQuery = `deck:"${hanziDeck}" note:${NOTE_HANZI} is:suspended`;
  const hanziNoteIds = await anki.note.findNotes({ query: hanziQuery });
  const candidates: Array<{ char: string; noteId: number; cardIds: number[] }> = [];

  for (let i = 0; i < hanziNoteIds.length; i += BATCH) {
    const chunk = hanziNoteIds.slice(i, i + BATCH);
    const infos = await anki.note.notesInfo({ notes: chunk });
    for (const n of infos) {
      const t = (n.fields?.Traditional?.value ?? "").trim();
      if (!isSingleCjkTraditional(t)) continue;
      if (!tocflActiveChars.has(t)) continue;
      const cardIds = n.cards ?? [];
      candidates.push({ char: t, noteId: n.noteId, cardIds });
    }
  }

  const chars = [...new Set(candidates.map((c) => c.char))].sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  );

  console.log("=".repeat(60));
  console.log(
    `Hanzi deck: "${hanziDeck}" | Suspended Hanzi notes whose character appears in active TOCFL (incl. phrase characters):`,
  );
  console.log(`Count: ${candidates.length} note(s), ${chars.length} unique character(s).\n`);
  console.log("Characters (will be unsuspended" + (apply ? "):" : " with --apply):"));
  console.log("-".repeat(60));
  console.log(chars.join(""));
  console.log("-".repeat(60));
  if (chars.length > 0) {
    console.log("\nOne per line:");
    for (const ch of chars) console.log(ch);
  }

  if (!apply) {
    console.log(
      "\nNo changes made. Run with --apply to unsuspend these Hanzi cards (Anki must be open).",
    );
    return;
  }

  if (candidates.length === 0) {
    console.log("\nNothing to unsuspend.");
    return;
  }

  const allCardIds = candidates.flatMap((c) => c.cardIds);
  console.log(`\nUnsuspending ${allCardIds.length} card(s) from ${candidates.length} note(s)...`);
  await anki.card.unsuspend({ cards: allCardIds });
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
