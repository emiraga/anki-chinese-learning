/**
 * Fill "Traditional Colored" and "Pinyin Colored" for TOCFL notes in Chinese::SingleChars.
 * Pre-rendered HTML makes tone colors work on Anki mobile (no JavaScript needed).
 *
 * Run with Anki open and AnkiConnect enabled:
 *   npx tsx utils/fill_tocfl_colored_fields.ts
 */

import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();
const DECK = "Chinese::SingleChars";
const NOTE_TYPE = "TOCFL";

const TONE_MAP: Record<string, number> = {
  "\u0101": 1, "\u0113": 1, "\u012b": 1, "\u014d": 1, "\u016b": 1, "\u01d6": 1,
  "\u00e1": 2, "\u00e9": 2, "\u00ed": 2, "\u00f3": 2, "\u00fa": 2, "\u01d8": 2,
  "\u01ce": 3, "\u011b": 3, "\u01d0": 3, "\u01d2": 3, "\u01d4": 3, "\u01da": 3,
  "\u00e0": 4, "\u00e8": 4, "\u00ec": 4, "\u00f2": 4, "\u00f9": 4, "\u01dc": 4,
};
const VOWELS =
  "aeiou\u00fc\u0101\u0113\u012b\u014d\u016b\u01d6\u00e1\u00e9\u00ed\u00f3\u00fa\u01d8\u01ce\u011b\u01d0\u01d2\u01d4\u01da\u00e0\u00e8\u00ec\u00f2\u00f9\u01dc";
const INITIALS_2: Record<string, boolean> = { zh: true, ch: true, sh: true };
const INITIALS_1 = "bpmfdtnlgkhjqxyzcsrwy";

function getTone(syl: string): number {
  for (let i = 0; i < syl.length; i++) {
    const t = TONE_MAP[syl[i]];
    if (t) return t;
  }
  return 5;
}

function isVowel(c: string): boolean {
  return VOWELS.includes(c);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitPinyin(str: string): string[] {
  str = str.trim();
  if (!str) return [];
  const bySpace = str.split(/\s+/).filter((s) => s.length > 0);
  if (bySpace.length > 1) return bySpace;
  const s = str;
  const out: string[] = [];
  let cur = "";
  let seenVowel = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const c2 = s.slice(i, i + 2);
    const isInit2 = i < s.length - 1 && INITIALS_2[c2];
    const isInit = isInit2 || INITIALS_1.includes(c);
    if (i > 0 && isInit && seenVowel) {
      if (isInit2) {
        if (cur) out.push(cur);
        cur = c2;
        i++;
        seenVowel = isVowel(s[i]);
        continue;
      }
      if (
        c === "n" &&
        (cur.slice(-1) === "a" ||
          cur.slice(-1) === "e" ||
          cur.slice(-1) === "i" ||
          cur.slice(-1) === "o" ||
          cur.slice(-1) === "u" ||
          cur.slice(-1) === "\u00fc" ||
          TONE_MAP[cur.slice(-1)])
      ) {
        cur += c;
        continue;
      }
      if (c === "g" && cur.slice(-1) === "n") {
        cur += c;
        continue;
      }
      if (c === "r" && cur.length > 0 && i === s.length - 1) {
        cur += c;
        continue;
      }
      if (cur) out.push(cur);
      cur = c;
      seenVowel = isVowel(c);
    } else {
      cur += c;
      if (isVowel(c) || TONE_MAP[c]) seenVowel = true;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [str];
}

function buildColoredHtml(
  trad: string,
  pinyinRaw: string
): { traditionalColored: string; pinyinColored: string } {
  const syllables = splitPinyin(pinyinRaw);
  const chars = [...trad];
  const charParts: string[] = [];
  const pinyinParts: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const syl = syllables[i] || syllables[0] || "";
    const t = getTone(syl.trim());
    charParts.push(
      `<span class="char-syllable tone-${t}">${escapeHtml(chars[i])}</span>`
    );
  }
  for (let j = 0; j < syllables.length; j++) {
    const syl = syllables[j].trim();
    if (!syl) continue;
    const t = getTone(syl);
    pinyinParts.push(
      `<span class="pinyin-syllable tone-${t}">${escapeHtml(syl)}</span>`
    );
  }
  return {
    traditionalColored: charParts.join(""),
    pinyinColored: pinyinParts.join(" "),
  };
}

async function main() {
  const nids = await anki.note.findNotes({
    query: `deck:"${DECK}" note:${NOTE_TYPE}`,
  });
  if (nids.length === 0) {
    console.log(`No notes found in deck ${DECK}.`);
    return;
  }
  console.log(`Found ${nids.length} note(s) in ${DECK}. Filling colored fields...`);

  let done = 0;
  for (let i = 0; i < nids.length; i += 50) {
    const chunk = nids.slice(i, i + 50);
    const infos = await anki.note.notesInfo({ notes: chunk });
    for (const note of infos) {
      const trad = (note.fields?.Traditional?.value ?? "").trim();
      const pinyin = (note.fields?.Pinyin?.value ?? "").trim();
      if (!trad) continue;
      const { traditionalColored, pinyinColored } = buildColoredHtml(
        trad,
        pinyin
      );
      await anki.note.updateNoteFields({
        note: {
          id: note.noteId,
          fields: {
            "Traditional Colored": traditionalColored,
            "Pinyin Colored": pinyinColored,
          },
        },
      });
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${nids.length}...`);
    }
  }
  console.log(`Done. Filled colored fields for ${done} notes. Sync Anki to get colors on mobile.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
