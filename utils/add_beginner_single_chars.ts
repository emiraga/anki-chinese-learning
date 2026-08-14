/**
 * Create a new deck Chinese::SingleChars (same level as TOCFL) with single characters from
 * Beginner SRTs (that are not active in Anki). All cards are created suspended.
 *
 * Usage: npx tsx utils/add_beginner_single_chars.ts
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const BEGINNER_DIR = "/Users/ankur/Documents/Lazy Chinese/Beginner";
const DECK_NAME = "Chinese::SingleChars";

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

function normalizeForComparison(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/[\s，。、！？；：""''\u3000\u00a0]+/g, "")
    .replace(/^[\s，。、！？；：""''\u3000\u00a0]+|[\s，。、！？；：""''\u3000\u00a0]+$/g, "");
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

const VOCAB_FIELD_NAMES = ["Traditional", "Hanzi"];

async function getAnkiActiveVocab(): Promise<{ set: Set<string>; entries: string[] }> {
  const modelNames = await anki.model.modelNames();
  const noteTypesWithVocab: string[] = [];
  const modelToField: Record<string, string> = {};
  for (const name of modelNames) {
    const fields = await anki.model.modelFieldNames({ modelName: name });
    const f = VOCAB_FIELD_NAMES.find((x) => fields.includes(x));
    if (f) {
      noteTypesWithVocab.push(name);
      modelToField[name] = f;
    }
  }
  if (noteTypesWithVocab.length === 0) return { set: new Set(), entries: [] };

  const query = noteTypesWithVocab.map((n) => `note:${n}`).join(" OR ");
  const noteIds = await anki.note.findNotes({ query: `(${query})` });
  if (noteIds.length === 0) return { set: new Set(), entries: [] };

  const allCardIds: number[] = [];
  const notesByNoteId = new Map<
    number,
    { modelName: string; fields: Record<string, { value: string }> }
  >();
  const batch = 100;
  for (let i = 0; i < noteIds.length; i += batch) {
    const chunk = noteIds.slice(i, i + batch);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      notesByNoteId.set(note.noteId, {
        modelName: note.modelName,
        fields: note.fields,
      });
      const cardIds = note.cards || [];
      if (cardIds.length > 0) allCardIds.push(...cardIds);
    }
  }

  const activeNoteIds = new Set<number>();
  const cardBatch = 100;
  for (let i = 0; i < allCardIds.length; i += cardBatch) {
    const cards = allCardIds.slice(i, i + cardBatch);
    const infos = await anki.card.cardsInfo({ cards });
    for (const info of infos) {
      if (info.queue >= 0) activeNoteIds.add(info.note);
    }
  }

  const set = new Set<string>();
  const entries: string[] = [];
  for (const noteId of activeNoteIds) {
    const note = notesByNoteId.get(noteId);
    if (!note) continue;
    const fieldName = modelToField[note.modelName] ?? "Traditional";
    const raw = note.fields[fieldName]?.value;
    if (raw == null) continue;
    const n = normalizeForComparison(raw.trim());
    if (n) {
      set.add(n);
      entries.push(n);
    }
  }
  return { set, entries };
}

function isActiveInAnki(
  char: string,
  activeSet: Set<string>,
  activeEntries: string[]
): boolean {
  const n = normalizeForComparison(char);
  if (activeSet.has(n)) return true;
  return activeEntries.some((e) => e.includes(n));
}

async function main() {
  const srtFiles = [...walkSrtFiles(BEGINNER_DIR)];
  console.log(`Found ${srtFiles.length} SRT files in Beginner\n`);

  const allChars = new Set<string>();
  for (const path of srtFiles) {
    const content = readFileSync(path, "utf-8");
    const chineseLines = parseSrt(content);
    const text = chineseLines.join("\n");
    extractCharacters(text).forEach((c) => allChars.add(c));
  }

  console.log("Loading Anki (active vocab)...");
  const { set: activeSet, entries: activeEntries } = await getAnkiActiveVocab();
  console.log(`Active vocab: ${activeSet.size} entries\n`);

  const toAdd = [...allChars].filter(
    (c) => !isActiveInAnki(c, activeSet, activeEntries)
  );
  toAdd.sort((a, b) => a.localeCompare(b));

  console.log(`Single characters to add: ${toAdd.length}`);
  console.log(`Deck: ${DECK_NAME}\n`);

  await anki.deck.createDeck({ deck: DECK_NAME });

  const createdNoteIds: number[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < toAdd.length; i++) {
    const char = toAdd[i];
    try {
      const note = {
        deckName: DECK_NAME,
        modelName: "TOCFL",
        fields: {
          ID: `SCHAR-${timestamp}-${i + 1}`,
          Traditional: char,
          Simplified: char,
          Pinyin: "?", // placeholder; fill later if needed
          POS: "",
          Meaning: "",
          "Meaning 2": "",
          Variants: "",
          Audio: "",
          Pleco: "",
          Mnemonic: "",
        },
        tags: ["beginner-single-char"],
      };

      const noteId = await anki.note.addNote({ note });
      if (noteId != null) {
        createdNoteIds.push(noteId);
        if ((i + 1) % 50 === 0) console.log(`  Added ${i + 1}/${toAdd.length}...`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${char} - ${msg}`);
    }
  }

  console.log(`\nCreated ${createdNoteIds.length} notes. Suspending all cards...`);

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
