/**
 * Add single characters from Beginner SRTs to Chinese::SingleChars deck, tagged by
 * source filename and "single". If the character already exists in the deck, only add
 * the tags. New notes are created suspended.
 *
 * Usage: npx tsx utils/add_beginner_single_chars_by_file.ts
 */

import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const BEGINNER_DIR = "/Users/ankur/Documents/Lazy Chinese/Beginner";
const DECK_NAME = "Chinese::SingleChars";
const NOTE_TYPE = "TOCFL";

const CJK_REGEX = /[\u4e00-\u9fff]/;

function hasChinese(text: string): boolean {
  return CJK_REGEX.test(text);
}

function isChineseSubtitleLine(line: string): boolean {
  const t = line.trim();
  if (!t || !hasChinese(t)) return false;
  const nonSpace = t.replace(/\s/g, "");
  if (nonSpace.length === 0) return false;
  const chineseCount = (nonSpace.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseCount / nonSpace.length >= 0.5;
}

function parseSrt(content: string): string[] {
  const lines = content.split(/\r?\n/);
  return lines.filter((l) => isChineseSubtitleLine(l)).map((l) => l.trim());
}

function extractCharacters(text: string): Set<string> {
  const chars = new Set<string>();
  const match = text.match(/[\u4e00-\u9fff]/g);
  if (match) match.forEach((c) => chars.add(c));
  return chars;
}

function* walkSrtFiles(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walkSrtFiles(full);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".srt")) yield full;
  }
}

/** Safe Anki tag from relative path: src::bella::This_Jacket_... */
function pathToTag(relPath: string): string {
  const base = relPath.replace(/\.srt$/i, "").replace(/_traditional_pinyin$/i, "");
  return (
    "src::" +
    base
      .replace(/[/\\]+/g, "::")
      .replace(/\s+/g, "_")
      .replace(/[^\w:.-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
  );
}

/** Get existing SingleChars notes: char -> { noteId, tags } */
async function getSingleCharsNotes(): Promise<Map<string, { noteId: number; tags: string[] }>> {
  const noteIds = await anki.note.findNotes({
    query: `deck:"${DECK_NAME}" note:${NOTE_TYPE}`,
  });
  if (noteIds.length === 0) return new Map();

  const map = new Map<string, { noteId: number; tags: string[] }>();
  const batch = 100;
  for (let i = 0; i < noteIds.length; i += batch) {
    const chunk = noteIds.slice(i, i + batch);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      const trad = (note.fields?.Traditional?.value ?? "").trim();
      if (trad.length === 1) {
        map.set(trad, { noteId: note.noteId, tags: note.tags ?? [] });
      }
    }
  }
  return map;
}

async function main() {
  const srtFiles = [...walkSrtFiles(BEGINNER_DIR)].sort();
  console.log(`Found ${srtFiles.length} SRT files in Beginner\n`);

  const perFileChars = new Map<string, Set<string>>();

  for (const path of srtFiles) {
    const content = readFileSync(path, "utf-8");
    const chineseLines = parseSrt(content);
    const text = chineseLines.join("\n");
    perFileChars.set(path, extractCharacters(text));
  }


  // char -> Set of file tags (source filenames). Include ALL single chars from SRTs so
  // every SingleChars note gets tagged by file and "single", not just "to learn" chars.
  const charToFileTags = new Map<string, Set<string>>();
  const relPath = (p: string) => relative(BEGINNER_DIR, p);

  for (const path of srtFiles) {
    const chars = perFileChars.get(path);
    if (!chars) continue;
    const tag = pathToTag(relPath(path));
    for (const c of chars) {
      if (c.length === 1) {
        if (!charToFileTags.has(c)) charToFileTags.set(c, new Set());
        charToFileTags.get(c)!.add(tag);
      }
    }
  }

  const charsToProcess = [...charToFileTags.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  console.log(`Single chars to ensure in SingleChars (with file tags): ${charsToProcess.length}\n`);

  console.log("Loading existing SingleChars notes...");
  const existingByChar = await getSingleCharsNotes();
  console.log(`Existing single-char notes in deck: ${existingByChar.size}\n`);

  await anki.deck.createDeck({ deck: DECK_NAME });

  let added = 0;
  let tagged = 0;
  const createdNoteIds: number[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < charsToProcess.length; i++) {
    const [char, fileTags] = charsToProcess[i];
    const tagsToHave = ["single", ...fileTags];
    const existing = existingByChar.get(char);

    if (existing) {
      const missing = tagsToHave.filter((t) => !existing.tags.includes(t));
      if (missing.length > 0) {
        try {
          await anki.note.addTags({
            notes: [existing.noteId],
            tags: missing.join(" "),
          });
          tagged++;
          if (tagged % 100 === 0 && tagged > 0)
            console.log(`  Tagged ${tagged} existing notes...`);
        } catch (err) {
          console.log(`  ✗ Tag ${char} (nid ${existing.noteId}): ${err}`);
        }
      }
      continue;
    }

    try {
      const note = {
        deckName: DECK_NAME,
        modelName: NOTE_TYPE,
        fields: {
          ID: `SCHAR-${timestamp}-${i + 1}`,
          Traditional: char,
          Simplified: char,
          Pinyin: "?",
          POS: "",
          Meaning: "",
          "Meaning 2": "",
          Variants: "",
          Audio: "",
          Pleco: "",
          Mnemonic: "",
        },
        tags: ["single", ...fileTags],
      };

      const noteId = await anki.note.addNote({ note });
      if (noteId != null) {
        createdNoteIds.push(noteId);
        added++;
        if (added % 50 === 0) console.log(`  Added ${added} new notes...`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${char} - ${msg}`);
    }
  }

  console.log(`\nNew notes created: ${createdNoteIds.length}. Suspending their cards...`);

  const allCardIds: number[] = [];
  for (const nid of createdNoteIds) {
    const cardIds = await anki.card.findCards({ query: `nid:${nid}` });
    allCardIds.push(...cardIds);
  }
  if (allCardIds.length > 0) {
    await anki.card.suspend({ cards: allCardIds });
    console.log(`✓ Suspended ${allCardIds.length} card(s).`);
  }

  console.log(`\nDone. Deck: ${DECK_NAME}`);
  console.log(`  New notes added (suspended): ${added}`);
  console.log(`  Existing notes updated with tags: ${tagged}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
