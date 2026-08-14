/**
 * Find Chinese words/phrases in an SRT subtitle file that are NOT already in your Anki deck.
 *
 * Usage: npx tsx utils/subtitle_vocab_diff.ts <path-to-.srt>
 * Example: npx tsx utils/subtitle_vocab_diff.ts "/Users/ankur/Documents/Lazy Chinese/bella/Beginner/This Jacket is Too Expensive!_traditional_pinyin.srt"
 */

import { readFileSync } from "fs";
import { YankiConnect } from "yanki-connect";
import { segmentChineseText } from "../app/utils/text";

const anki = new YankiConnect();

/** Match CJK unified ideographs (Chinese characters) */
const CJK_REGEX = /[\u4e00-\u9fff]/;

function hasChinese(text: string): boolean {
  return CJK_REGEX.test(text);
}

/** Line is likely Chinese (has Chinese chars; not a pinyin-only line with spaces between syllables) */
function isChineseSubtitleLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!hasChinese(t)) return false;
  // Pinyin lines often have spaces between every syllable; Chinese lines have chars adjacent
  // If more than half of non-space chars are Chinese, treat as Chinese line
  const nonSpace = t.replace(/\s/g, "");
  if (nonSpace.length === 0) return false;
  const chineseCount = (nonSpace.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseCount / nonSpace.length >= 0.5;
}

function parseSrt(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const chineseLines: string[] = [];
  for (const line of lines) {
    if (isChineseSubtitleLine(line)) {
      chineseLines.push(line.trim());
    }
  }
  return chineseLines;
}

/** Extract full text from Chinese subtitle lines (remove punctuation for segmentation if needed) */
function extractChineseText(chineseLines: string[]): string {
  return chineseLines.join("\n");
}

/** Normalize for comparison: trim, strip punctuation, Unicode NFC so "衣服" matches "衣服。" or variants */
function normalizeForComparison(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/[\s，。、！？；：""''\u3000\u00a0]+/g, "") // strip spaces and common punctuation
    .replace(/^[\s，。、！？；：""''\u3000\u00a0]+|[\s，。、！？；：""''\u3000\u00a0]+$/g, "");
}

/** Get unique words/phrases from segmented text (Intl.Segmenter segments) */
function extractVocabulary(text: string): Set<string> {
  const vocab = new Set<string>();
  const segments = segmentChineseText(text, "intl-tw");

  for (const seg of segments) {
    const t = seg.text.trim();
    if (!t) continue;
    // Only keep segments that contain at least one Chinese character
    if (!hasChinese(t)) continue;
    // Strip common punctuation for consistency
    const cleaned = t.replace(/^[，。、！？；：""''\s]+|[，。、！？；：""''\s]+$/g, "").trim();
    if (cleaned.length >= 1) {
      vocab.add(cleaned);
    }
  }

  return vocab;
}

/** Field names we treat as "vocabulary form" (Traditional or Hanzi for Chinese model) */
const VOCAB_FIELD_NAMES = ["Traditional", "Hanzi"];

/** Discover all note types that have Traditional or Hanzi field and load their vocabulary */
async function getAnkiTraditionalSet(): Promise<{
  set: Set<string>;
  entries: string[];
  noteTypesUsed: string[];
}> {
  const modelNames = await anki.model.modelNames();
  const noteTypesWithVocabField: string[] = [];
  const modelToFieldName: Record<string, string> = {};
  for (const name of modelNames) {
    const fields = await anki.model.modelFieldNames({ modelName: name });
    const vocabField = VOCAB_FIELD_NAMES.find((f) => fields.includes(f));
    if (vocabField) {
      noteTypesWithVocabField.push(name);
      modelToFieldName[name] = vocabField;
    }
  }

  if (noteTypesWithVocabField.length === 0) {
    return { set: new Set(), entries: [], noteTypesUsed: [] };
  }

  const query = noteTypesWithVocabField.map((n) => `note:${n}`).join(" OR ");
  const noteIds = await anki.note.findNotes({ query: `(${query})` });
  if (noteIds.length === 0) {
    return { set: new Set(), entries: [], noteTypesUsed: noteTypesWithVocabField };
  }

  const set = new Set<string>();
  const entries: string[] = [];
  const batchSize = 100;
  for (let i = 0; i < noteIds.length; i += batchSize) {
    const chunk = noteIds.slice(i, i + batchSize);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      const fieldName = modelToFieldName[note.modelName] ?? "Traditional";
      const raw = note.fields[fieldName]?.value;
      if (raw == null) continue;
      const normalized = normalizeForComparison(raw.trim());
      if (normalized) {
        set.add(normalized);
        entries.push(normalized);
      }
    }
  }
  return { set, entries, noteTypesUsed: noteTypesWithVocabField };
}

/** True if this word is covered by Anki: exact match or appears as substring of any note's Traditional/Hanzi */
function isInAnki(
  word: string,
  ankiSet: Set<string>,
  ankiEntries: string[]
): boolean {
  const n = normalizeForComparison(word);
  if (ankiSet.has(n)) return true;
  return ankiEntries.some((e) => e.includes(n));
}

async function main() {
  const srtPath = process.argv[2];
  if (!srtPath) {
    console.error("Usage: npx tsx utils/subtitle_vocab_diff.ts <path-to-.srt>");
    process.exit(1);
  }

  let content: string;
  try {
    content = readFileSync(srtPath, "utf-8");
  } catch (e) {
    console.error("Failed to read file:", srtPath, e);
    process.exit(1);
  }

  const chineseLines = parseSrt(content);
  const fullText = extractChineseText(chineseLines);
  const subtitleVocab = extractVocabulary(fullText);

  console.log(`\nSubtitle: ${srtPath}`);
  console.log(`Chinese lines: ${chineseLines.length}`);
  console.log(`Unique words/phrases in subtitle: ${subtitleVocab.size}\n`);

  console.log("Loading vocabulary from Anki (all note types with Traditional/Hanzi field)...");
  const { set: ankiSet, entries: ankiEntries, noteTypesUsed } =
    await getAnkiTraditionalSet();
  console.log(`Note types: ${noteTypesUsed.join(", ")}`);
  console.log(`Already in Anki: ${ankiSet.size} entries (exact + substring match)\n`);

  let missing: string[] = [];
  for (const w of subtitleVocab) {
    if (!isInAnki(w, ankiSet, ankiEntries)) missing.push(w);
  }
  missing.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });

  // Re-verify: some notes might be in decks we didn't match (e.g. exact Traditional match)
  const verify = process.argv.includes("--verify");
  if (verify && missing.length > 0) {
    console.log("Re-verifying missing list against Anki (exact Traditional query)...");
    const actuallyMissing: string[] = [];
    for (const w of missing) {
      const quoted = w.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const noteIds = await anki.note.findNotes({ query: `Traditional:"${quoted}"` });
      if (noteIds.length === 0) actuallyMissing.push(w);
    }
    missing = actuallyMissing;
    console.log(`After verification: ${missing.length} not in Anki\n`);
  }

  console.log("--- Not in your Anki (words/phrases to add) ---\n");
  if (missing.length === 0) {
    console.log("(none – everything from the subtitle is already in Anki)");
    return;
  }
  missing.forEach((w) => console.log(w));
  console.log(`\nTotal: ${missing.length} words/phrases not in Anki`);
  if (!verify && missing.length > 0) {
    console.log("\nTip: Run with --verify to double-check against Anki (exact Traditional match).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
