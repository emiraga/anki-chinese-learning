/**
 * Remove from Chinese::SingleChars any note whose character already exists as a
 * non-suspended TOCFL note outside the SingleChars deck. Does not change the TOCFL deck.
 *
 * Usage: npx tsx utils/remove_singlechars_in_tocfl.ts
 *        npx tsx utils/remove_singlechars_in_tocfl.ts --dry-run
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const SINGLECHARS_DECK = "Chinese::SingleChars";
const NOTE_TYPE = "TOCFL";
const BATCH = 100;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("DRY RUN – no notes will be deleted.\n");

  // TOCFL notes that are NOT suspended and NOT in SingleChars deck
  const activeTocflNoteIds = await anki.note.findNotes({
    query: `note:${NOTE_TYPE} -is:suspended -deck:"${SINGLECHARS_DECK}"`,
  });
  console.log(`TOCFL notes (active, outside SingleChars): ${activeTocflNoteIds.length}`);

  const activeSingleCharsInTocfl = new Set<string>();
  for (let i = 0; i < activeTocflNoteIds.length; i += BATCH) {
    const chunk = activeTocflNoteIds.slice(i, i + BATCH);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      const trad = (note.fields?.Traditional?.value ?? "").trim();
      if (trad.length === 1) activeSingleCharsInTocfl.add(trad);
    }
  }
  console.log(`Single-character Traditionals in that set: ${activeSingleCharsInTocfl.size}\n`);

  const singleCharsNoteIds = await anki.note.findNotes({
    query: `deck:"${SINGLECHARS_DECK}" note:${NOTE_TYPE}`,
  });
  console.log(`Notes in ${SINGLECHARS_DECK}: ${singleCharsNoteIds.length}`);

  const toRemove: number[] = [];
  for (let i = 0; i < singleCharsNoteIds.length; i += BATCH) {
    const chunk = singleCharsNoteIds.slice(i, i + BATCH);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      const trad = (note.fields?.Traditional?.value ?? "").trim();
      if (trad.length === 1 && activeSingleCharsInTocfl.has(trad)) {
        toRemove.push(note.noteId);
      }
    }
  }

  if (toRemove.length === 0) {
    console.log("No SingleChars notes to remove (none of their characters exist as active TOCFL outside SingleChars).");
    return;
  }

  console.log(`\nSingleChars notes to remove (char already in TOCFL, not suspended): ${toRemove.length}`);
  if (dryRun) {
    console.log("Would delete note IDs:", toRemove.slice(0, 20).join(", "), toRemove.length > 20 ? "..." : "");
    return;
  }

  const deleteBatch = 50;
  for (let i = 0; i < toRemove.length; i += deleteBatch) {
    const chunk = toRemove.slice(i, i + deleteBatch);
    await anki.note.deleteNotes({ notes: chunk });
  }
  console.log(`Done. Deleted ${toRemove.length} notes from ${SINGLECHARS_DECK}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
