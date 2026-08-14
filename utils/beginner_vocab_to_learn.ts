/**
 * Scan all SRT files in Lazy Chinese Beginner folder and build a document of
 * characters/words/2–3 char phrases to learn: not in Anki OR only in suspended cards.
 *
 * Usage: npx tsx utils/beginner_vocab_to_learn.ts
 * Output: /Users/ankur/Documents/Lazy Chinese/Beginner/vocab_to_learn.md
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync } from "fs";
import { join, relative } from "path";
import { YankiConnect } from "yanki-connect";
import { segmentChineseText } from "../app/utils/text";

const anki = new YankiConnect();
const BEGINNER_DIR = "/Users/ankur/Documents/Lazy Chinese/Beginner";
const OUTPUT_PATH = join(BEGINNER_DIR, "vocab_to_learn.md");

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

/** Extract words from segmented text */
function extractSegments(text: string): Set<string> {
  const vocab = new Set<string>();
  const segments = segmentChineseText(text, "intl-tw");
  for (const seg of segments) {
    const t = seg.text.trim().replace(/^[，。、！？；：""''\s]+|[，。、！？；：""''\s]+$/g, "").trim();
    if (t && hasChinese(t)) vocab.add(t);
  }
  return vocab;
}

/** Extract 2- and 3-character n-grams from Chinese-only string with counts */
function extractNgramCounts(text: string): Map<string, number> {
  const count = new Map<string, number>();
  const chineseOnly = (text.match(/[\u4e00-\u9fff]+/g) || []).join("");
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i <= chineseOnly.length - len; i++) {
      const slice = chineseOnly.slice(i, i + len);
      if (slice.length === len) count.set(slice, (count.get(slice) || 0) + 1);
    }
  }
  return count;
}

/** N-grams that appear in text (set of keys from extractNgramCounts) */
function extractNgramSet(text: string): Set<string> {
  const count = extractNgramCounts(text);
  return new Set(count.keys());
}

/** All unique Chinese characters in text */
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

/** Get vocabulary that has at least one non-suspended card (active = already learning) */
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
  const notesByNoteId = new Map<number, { modelName: string; fields: Record<string, { value: string }> }>();
  const batch = 100;
  for (let i = 0; i < noteIds.length; i += batch) {
    const chunk = noteIds.slice(i, i + batch);
    const notes = await anki.note.notesInfo({ notes: chunk });
    for (const note of notes) {
      notesByNoteId.set(note.noteId, { modelName: note.modelName, fields: note.fields });
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
  word: string,
  activeSet: Set<string>,
  activeEntries: string[]
): boolean {
  const n = normalizeForComparison(word);
  if (activeSet.has(n)) return true;
  return activeEntries.some((e) => e.includes(n));
}

/** Relative path from BEGINNER_DIR for display */
function relativePath(fullPath: string): string {
  return relative(BEGINNER_DIR, fullPath) || fullPath;
}

type PerFileVocab = {
  chars: Set<string>;
  segments: Set<string>;
  ngrams: Set<string>;
};

async function main() {
  const srtFiles = [...walkSrtFiles(BEGINNER_DIR)].sort();
  console.log(`Found ${srtFiles.length} SRT files in Beginner\n`);

  const allText: string[] = [];
  const allSegments = new Set<string>();
  const allChars = new Set<string>();
  const perFile = new Map<string, PerFileVocab>();

  for (const path of srtFiles) {
    const content = readFileSync(path, "utf-8");
    const chineseLines = parseSrt(content);
    const text = chineseLines.join("\n");
    allText.push(text);
    const chars = extractCharacters(text);
    const segments = extractSegments(text);
    const ngrams = extractNgramSet(text);
    chars.forEach((c) => allChars.add(c));
    segments.forEach((w) => allSegments.add(w));
    perFile.set(path, { chars, segments, ngrams });
  }

  const fullText = allText.join("\n");
  const ngramCounts = extractNgramCounts(fullText);
  const frequentNgrams = new Set<string>();
  for (const [w, count] of ngramCounts) {
    if (count >= 5) frequentNgrams.add(w); // 2–3 char phrases that appear 5+ times
  }
  const combinedVocab = new Set<string>([...allChars, ...allSegments, ...frequentNgrams]);

  console.log("Loading Anki (active = at least one non-suspended card)...");
  const { set: activeSet, entries: activeEntries } = await getAnkiActiveVocab();
  console.log(`Active vocab in Anki: ${activeSet.size} entries\n`);

  const toLearnSet = new Set<string>();
  for (const w of combinedVocab) {
    if (!isActiveInAnki(w, activeSet, activeEntries)) toLearnSet.add(w);
  }

  const byLen = (a: string, b: string) =>
    a.length !== b.length ? a.length - b.length : a.localeCompare(b);

  /** For a file, get vocab items that appear in it and are in toLearn, grouped by length */
  function vocabInFile(path: string): { chars: string[]; two: string[]; three: string[]; longer: string[] } {
    const data = perFile.get(path);
    if (!data) return { chars: [], two: [], three: [], longer: [] };
    const chars = [...data.chars].filter((c) => toLearnSet.has(c)).sort(byLen);
    const twoSet = new Set<string>();
    for (const w of data.segments) if (w.length === 2 && toLearnSet.has(w)) twoSet.add(w);
    for (const w of data.ngrams) if (w.length === 2 && toLearnSet.has(w)) twoSet.add(w);
    const threeSet = new Set<string>();
    for (const w of data.segments) if (w.length === 3 && toLearnSet.has(w)) threeSet.add(w);
    for (const w of data.ngrams) if (w.length === 3 && toLearnSet.has(w)) threeSet.add(w);
    const longer = [...data.segments].filter((w) => w.length > 3 && toLearnSet.has(w)).sort(byLen);
    return {
      chars,
      two: [...twoSet].sort(byLen),
      three: [...threeSet].sort(byLen),
      longer,
    };
  }

  const mdLines: string[] = [
    "# Vocabulary to learn – Beginner (Lazy Chinese)",
    "",
    "Characters, words, and 2–3 character phrases from Beginner SRTs that are **not** in your Anki or are **only on suspended cards**, **categorized by source file**.",
    "",
    `- **Source:** ${srtFiles.length} SRT files in \`Beginner\``,
    `- **Total items (across all files):** ${toLearnSet.size}`,
    "",
    "---",
    "",
  ];

  for (const path of srtFiles) {
    const rel = relativePath(path);
    const { chars, two, three, longer } = vocabInFile(path);
    const total = chars.length + two.length + three.length + longer.length;
    if (total === 0) continue;
    mdLines.push(`## ${rel}`);
    mdLines.push("");
    mdLines.push("*" + total + " item(s) to learn from this file.*");
    mdLines.push("");
    if (chars.length) {
      mdLines.push("**Single characters:** " + chars.join(" "));
      mdLines.push("");
    }
    if (two.length) {
      mdLines.push("**2-character:** " + two.join(" · "));
      mdLines.push("");
    }
    if (three.length) {
      mdLines.push("**3-character:** " + three.join(" · "));
      mdLines.push("");
    }
    if (longer.length) {
      mdLines.push("**Longer:** " + longer.join(" · "));
      mdLines.push("");
    }
    mdLines.push("---");
    mdLines.push("");
  }

  mdLines.push("*Generated by utils/beginner_vocab_to_learn.ts. Re-run to refresh.*");

  writeFileSync(OUTPUT_PATH, mdLines.join("\n"), "utf-8");
  const filesWithVocab = srtFiles.filter(
    (p) =>
      vocabInFile(p).chars.length +
      vocabInFile(p).two.length +
      vocabInFile(p).three.length +
      vocabInFile(p).longer.length >
      0
  ).length;
  console.log("Written: " + OUTPUT_PATH);
  console.log("  Files with vocab: " + filesWithVocab + ", total items: " + toLearnSet.size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
