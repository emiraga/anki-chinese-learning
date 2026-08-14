/**
 * Remove duplicate notes from Chinese::SingleChars deck. Each character (Traditional
 * field) should appear only once. Keeps the note with the most tags, merges tags from
 * duplicates into it, then deletes the duplicate notes.
 *
 * Usage: npx tsx utils/dedupe_singlechars_deck.ts
 *        npx tsx utils/dedupe_singlechars_deck.ts --dry-run
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const DECK = "Chinese::SingleChars";
const NOTE_TYPE = "TOCFL";
const BATCH = 100;

function normalizeKey(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("DRY RUN – no notes will be deleted.\n");

  const noteIds = await anki.note.findNotes({
    query: `deck:"${DECK}" note:${NOTE_TYPE}`,
  });
  console.log(`Total notes in ${DECK}: ${noteIds.length}`);

  if (noteIds.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const notesByTraditional = new Map<string, { noteId: number; tags: string[]; raw: string }[]>();
  let singleCharCount = 0;
  let multiCharCount = 0;

  for (let i = 0; i < noteIds.length; i += BATCH) {
    const chunk = noteIds.slice(i, i + BATCH);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      const raw = (note.fields?.Traditional?.value ?? "").trim();
      if (!raw) continue;
      const key = normalizeKey(raw);
      if (key.length === 1) singleCharCount++;
      else multiCharCount++;
      const entry = { noteId: note.noteId, tags: note.tags ?? [], raw };
      if (!notesByTraditional.has(key)) {
        notesByTraditional.set(key, []);
      }
      notesByTraditional.get(key)!.push(entry);
    }
  }

  console.log(`  Single-character (Traditional length 1): ${singleCharCount}`);
  console.log(`  Multi-character (word/phrase): ${multiCharCount}`);
  console.log(`  Unique Traditional values (after normalize): ${notesByTraditional.size}`);

  const duplicates = [...notesByTraditional.entries()].filter(
    ([, notes]) => notes.length > 1
  );
  const totalDuplicates = duplicates.reduce((s, [, notes]) => s + notes.length - 1, 0);
  const notesToDelete: number[] = [];

  if (duplicates.length === 0) {
    console.log("No duplicates found. Each Traditional value appears once.");
    return;
  }

  console.log(`\nFound ${duplicates.length} Traditional values with duplicates (${totalDuplicates} extra notes to remove).\n`);

  for (const [trad, notes] of duplicates) {
    // Keep the note with the most tags (preserve most source info)
    const sorted = [...notes].sort((a, b) => b.tags.length - a.tags.length);
    const keep = sorted[0];
    const remove = sorted.slice(1);
    const allTags = new Set<string>(keep.tags);
    for (const n of remove) n.tags.forEach((t) => allTags.add(t));
    const missingOnKeep = [...allTags].filter((t) => !keep.tags.includes(t));

    if (missingOnKeep.length > 0 && !dryRun) {
      try {
        await anki.note.addTags({
          notes: [keep.noteId],
          tags: missingOnKeep.join(" "),
        });
      } catch (e) {
        console.warn(`  Could not merge tags into note ${keep.noteId}: ${e}`);
      }
    }

    for (const n of remove) notesToDelete.push(n.noteId);
  }

  if (dryRun) {
    console.log(`Would delete ${notesToDelete.length} duplicate note(s).`);
    console.log("\nExample duplicates (first 10):");
    for (const [trad, notes] of duplicates.slice(0, 10)) {
      const sorted = [...notes].sort((a, b) => b.tags.length - a.tags.length);
      const keep = sorted[0];
      const remove = sorted.slice(1);
      console.log(`  "${trad}": ${notes.length} notes (keep nid ${keep.noteId}, remove nids ${remove.map((n) => n.noteId).join(", ")})`);
    }
    return;
  }

  if (notesToDelete.length === 0) return;

  console.log(`Deleting ${notesToDelete.length} duplicate notes...`);
  const deleteBatch = 50;
  for (let i = 0; i < notesToDelete.length; i += deleteBatch) {
    const chunk = notesToDelete.slice(i, i + deleteBatch);
    await anki.note.deleteNotes({ notes: chunk });
    if (i + deleteBatch < notesToDelete.length) {
      process.stdout.write(`  Deleted ${Math.min(i + deleteBatch, notesToDelete.length)} / ${notesToDelete.length}\r`);
    }
  }
  console.log(`\nDone. Deleted ${notesToDelete.length} duplicate notes.`);
  console.log(`Deck should now have ${noteIds.length - notesToDelete.length} notes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
