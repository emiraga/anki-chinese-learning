/**
 * Fill the "Sample Sentences" field for Chinese::SingleChars with easy, simple
 * example sentences that help understand each character. No API – uses
 * meaning-aware templates and each note's Pinyin/Meaning.
 *
 * Prerequisite: Fill Pinyin and Meaning first so sentences make sense:
 *   uv run utils/fill_single_chars_tocfl.py
 * That script uses the chinese-english-lookup package (CC-CEDICT, local, no API).
 *
 * Each sentence: Chinese (short, easy chars only) + pinyin + English translation.
 * Only notes with empty Sample Sentences are updated.
 *
 * Usage: npx tsx utils/fill_single_chars_sample_sentences_local.ts
 *        npx tsx utils/fill_single_chars_sample_sentences_local.ts --dry-run
 *        npx tsx utils/fill_single_chars_sample_sentences_local.ts --limit 5
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const DECK = "Chinese::SingleChars";
const NOTE_TYPE = "TOCFL";
const SAMPLE_FIELD = "Sample Sentences";
const BATCH = 100;
const UPDATE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Take first meaning (before ; or /) and shorten for display */
function firstMeaning(meaning: string, maxWords = 4): string {
  const raw = (meaning || "").trim();
  const first = raw.split(/\s*[;/]\s*/)[0]?.trim() || raw;
  const words = first.split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.join(" ") || "this character";
}

/** Escape for HTML text content */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type SentenceTemplate = {
  zh: (char: string) => string;
  py: (pinyin: string) => string;
  en: (meaning: string) => string;
};

/**
 * Easy example sentences – all use simple characters only (e.g. 這 是 一 個 好 不 我 很 了 有 在 人 會 要 去 來 天 日 年 喜 歡 多 大 小 今 每 等).
 * Templates are chosen by meaning so the examples help understand the character.
 */
const TEMPLATES: Record<string, SentenceTemplate[]> = {
  /** Noun-like: person, thing, place, object */
  noun: [
    { zh: (c) => `這是${c}。`, py: (py) => `Zhè shì ${py}.`, en: (m) => `This is ${m}.` },
    { zh: (c) => `${c}在這裡。`, py: (py) => `${py} zài zhèlǐ.`, en: (m) => `The ${m} is here.` },
    { zh: (c) => `我有很多${c}。`, py: (py) => `Wǒ yǒu hěn duō ${py}.`, en: (m) => `I have a lot of ${m}.` },
    { zh: (c) => `一個${c}。`, py: (py) => `Yī gè ${py}.`, en: (m) => `One ${m}.` },
  ],
  /** Adjective-like: good, big, happy, etc. */
  adj: [
    { zh: (c) => `${c}很好。`, py: (py) => `${py} hěn hǎo.`, en: (m) => `Very good / ${m} is good.` },
    { zh: (c) => `我很${c}。`, py: (py) => `Wǒ hěn ${py}.`, en: (m) => `I am very ${m}.` },
    { zh: (c) => `這個很${c}。`, py: (py) => `Zhège hěn ${py}.`, en: (m) => `This one is very ${m}.` },
  ],
  /** Verb-like: action */
  verb: [
    { zh: (c) => `我會${c}。`, py: (py) => `Wǒ huì ${py}.`, en: (m) => `I can ${m}.` },
    { zh: (c) => `不要${c}。`, py: (py) => `Bù yào ${py}.`, en: (m) => `Don't ${m}.` },
    { zh: (c) => `${c}了。`, py: (py) => `${py} le.`, en: (m) => `(Already) ${m}.` },
    { zh: (c) => `我要${c}。`, py: (py) => `Wǒ yào ${py}.`, en: (m) => `I want to ${m}.` },
  ],
  /** Generic when meaning is unclear – simple “this is / I like” style */
  generic: [
    { zh: (c) => `這是${c}。`, py: (py) => `Zhè shì ${py}.`, en: (m) => `This is ${m}.` },
    { zh: (c) => `${c}很好。`, py: (py) => `${py} hěn hǎo.`, en: (m) => `${m} is very good.` },
    { zh: (c) => `我喜歡${c}。`, py: (py) => `Wǒ xǐhuān ${py}.`, en: (m) => `I like ${m}.` },
  ],
};

/** Pick category from first meaning (lowercase) so examples fit the character. */
function pickCategory(meaning: string): keyof typeof TEMPLATES {
  const m = (meaning || "").toLowerCase();
  if (/\b(person|thing|place|water|book|day|year|word|name|country|city|hand|eye|heart|mouth|number|sun|moon|time)\b/.test(m)) return "noun";
  if (/\b(good|big|small|happy|sad|new|old|high|long|many|few|right|wrong|beautiful|easy|hard)\b/.test(m)) return "adj";
  if (/\b(go|come|want|like|see|say|do|make|eat|drink|give|take|know|can|will|don't)\b/.test(m)) return "verb";
  return "generic";
}

/** Choose up to 3 templates from the category (and fallback to generic for variety). */
function selectTemplates(meaning: string): SentenceTemplate[] {
  const cat = pickCategory(meaning);
  const primary = TEMPLATES[cat];
  const fallback = TEMPLATES.generic;
  const combined = [...primary];
  if (cat !== "generic") {
    combined.push(fallback[0]);
  }
  return combined.slice(0, 3);
}

function buildSampleSentencesHtml(
  char: string,
  pinyin: string,
  meaning: string
): string {
  const py = (pinyin || "").trim() === "" || (pinyin || "").trim() === "?" ? "(see above)" : (pinyin || "").trim();
  const meaningShort = firstMeaning(meaning);
  const chosen = selectTemplates(meaning);

  const paragraphs = chosen.map((t) => {
    const zh = t.zh(char);
    const pyLine = t.py(py);
    const enLine = t.en(meaningShort);
    return `<p>${esc(zh)}<br>${esc(pyLine)}<br>${esc(enLine)}</p>`;
  });
  return paragraphs.join("\n");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 && process.argv[limitArg + 1] ? parseInt(process.argv[limitArg + 1], 10) : undefined;
  if (dryRun) console.log("DRY RUN – no notes will be updated.\n");

  const noteIds = await anki.note.findNotes({
    query: `deck:"${DECK}" note:${NOTE_TYPE}`,
  });
  if (!noteIds.length) {
    console.log("No notes in deck.");
    return;
  }

  const notes: Array<{ noteId: number; traditional: string; pinyin: string; meaning: string }> = [];
  for (let i = 0; i < noteIds.length; i += BATCH) {
    const chunk = noteIds.slice(i, i + BATCH);
    const infos = await anki.note.notesInfo({ notes: chunk });
    for (const info of infos) {
      const trad = (info.fields?.Traditional?.value ?? "").trim();
      if (trad.length !== 1) continue;
      const sample = (info.fields?.[SAMPLE_FIELD]?.value ?? "").trim();
      if (sample) continue; // only fill empty
      notes.push({
        noteId: info.noteId,
        traditional: trad,
        pinyin: (info.fields?.Pinyin?.value ?? "").trim(),
        meaning: (info.fields?.Meaning?.value ?? "").trim(),
      });
    }
  }

  const toProcess = limit != null ? notes.slice(0, limit) : notes;
  if (!toProcess.length) {
    console.log("No notes with empty Sample Sentences found.");
    return;
  }
  console.log(`Found ${toProcess.length} note(s) with empty Sample Sentences (${limit != null ? `limit ${limit}` : "no limit"}).\n`);

  for (let i = 0; i < toProcess.length; i++) {
    const n = toProcess[i];
    const html = buildSampleSentencesHtml(n.traditional, n.pinyin, n.meaning);
    if (dryRun) {
      console.log(`  [dry-run] ${n.traditional}  Sample:\n${html.slice(0, 120)}...`);
      continue;
    }
    try {
      await anki.note.updateNoteFields({
        note: { id: n.noteId, fields: { [SAMPLE_FIELD]: html } },
      });
      console.log(`  [${i + 1}/${toProcess.length}] ${n.traditional}`);
      if (i < toProcess.length - 1) await sleep(UPDATE_DELAY_MS);
    } catch (e) {
      console.log(`  [${i + 1}/${toProcess.length}] ${n.traditional} error: ${e}`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
