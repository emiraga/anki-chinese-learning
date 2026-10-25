import { useCallback, useEffect, useState } from "react";
import anki from "~/apis/anki";
import pinyinSplit from "pinyin-split";
import { diacriticToNumber, removeTone } from "pinyin-tools";
import { useSettings } from "~/settings/SettingsContext";
import type { PinyinType } from "~/utils/pinyin";
import type { InvalidDataRecord } from "./types";

export type PhraseExample = {
  traditional: string;
  english: string;
};

// Example sentences grouped by part of speech (e.g. "N", "V").
export type PhraseExamplesByPos = Record<string, PhraseExample[]>;

// Schema of "Connections JSON", written by utils/hanzi/fill_connections_field.py.
// Notes with an older schema version are treated as having no connections,
// since the script regenerates them.
const CONNECTIONS_SCHEMA_VERSION = 4;

export const CONNECTIONS_REGISTERS = [
  "colloquial",
  "neutral",
  "formal",
  "written",
] as const;
export type ConnectionsRegister = (typeof CONNECTIONS_REGISTERS)[number];

export const CONNECTIONS_REGIONS = { tw: "Taiwan", cn: "Mainland China" };
export type ConnectionsRegion = keyof typeof CONNECTIONS_REGIONS;

// A related word with how the phrase differs from or contrasts with it.
export type WordDiff = { w: string; diff: string };

export type PhraseConnections = {
  hint: string;
  synonyms: WordDiff[];
  antonyms: WordDiff[];
  measureWords: string[];
  register: ConnectionsRegister;
  region: {
    usage: ConnectionsRegion | "both";
    equivalents: { w: string; region: ConnectionsRegion }[];
  };
  pairsWith: { w: string; pattern: string }[];
};

// A run of text in an Anki cloze field: plain text, or a cloze deletion with
// its answer and optional hint ("{{c1::愛::to love}}").
export type ClozePart =
  | { kind: "text"; text: string }
  | { kind: "cloze"; text: string; hint?: string };

export type SentenceCloze = {
  parts: ClozePart[];
  english: string;
};

export type PhraseType = {
  noteId: number;
  source: string;
  traditional: string;
  sentenceTraditional: string;
  sentenceCloze?: SentenceCloze;
  meaning: string;
  partOfSpeech?: string;
  examples?: PhraseExamplesByPos;
  connections?: PhraseConnections;
  pinyin: string;
  zhuyin?: string;
  tags: string[];
  audio: string;
};

/** The "/"-separated forms of a phrase's Traditional field (e.g. "台灣/臺灣"). */
export function phraseForms(phrase: PhraseType): string[] {
  return phrase.traditional
    .split("/")
    .map((form) => form.trim())
    .filter((form) => form.length > 0);
}

const CLOZE_PATTERN = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g;

/** Split text with Anki cloze markup into plain text and cloze deletions. */
export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let last = 0;
  for (const match of text.matchAll(CLOZE_PATTERN)) {
    if (match.index > last) {
      parts.push({ kind: "text", text: text.slice(last, match.index) });
    }
    parts.push({ kind: "cloze", text: match[1], hint: match[2] || undefined });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ kind: "text", text: text.slice(last) });
  }
  return parts;
}

function parseSentenceCloze(
  traditional: string | undefined,
  english: string | undefined,
): SentenceCloze | undefined {
  if (!traditional || traditional.trim().length === 0) {
    return undefined;
  }
  return { parts: parseCloze(traditional.trim()), english: english ?? "" };
}

function parseExamplesJson(
  raw: string | undefined,
  noteId: number,
): PhraseExamplesByPos | undefined {
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Note ${noteId}: "Examples JSON" must be an object keyed by POS`,
    );
  }
  const result: PhraseExamplesByPos = {};
  for (const [pos, list] of Object.entries(parsed)) {
    if (!Array.isArray(list)) {
      throw new Error(
        `Note ${noteId}: "Examples JSON" value for POS "${pos}" must be an array`,
      );
    }
    result[pos] = list.map((example: unknown) => {
      const e = example as Record<string, unknown> | null;
      const traditional = e?.["Traditional"];
      const english = e?.["English"];
      if (typeof traditional !== "string" || typeof english !== "string") {
        throw new Error(
          `Note ${noteId}: "Examples JSON" entry for POS "${pos}" must have string "Traditional" and "English"`,
        );
      }
      return { traditional, english };
    });
  }
  return result;
}

function parseConnectionsJson(
  raw: string | undefined,
  noteId: number,
): PhraseConnections | undefined {
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }
  const where = `Note ${noteId}: "Connections JSON"`;

  const asObject = (value: unknown, path: string): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${where}: ${path} must be an object`);
    }
    return value as Record<string, unknown>;
  };
  const asString = (value: unknown, path: string): string => {
    if (typeof value !== "string") {
      throw new Error(`${where}: ${path} must be a string`);
    }
    return value;
  };
  const asArray = (value: unknown, path: string): unknown[] => {
    if (!Array.isArray(value)) {
      throw new Error(`${where}: ${path} must be an array`);
    }
    return value;
  };
  const asOneOf = <T extends string>(
    value: unknown,
    allowed: readonly T[],
    path: string,
  ): T => {
    const s = asString(value, path);
    if (!(allowed as readonly string[]).includes(s)) {
      throw new Error(`${where}: ${path} has unknown value "${s}"`);
    }
    return s as T;
  };

  const asWordDiffs = (value: unknown, path: string): WordDiff[] =>
    asArray(value, path).map((item, i) => {
      const o = asObject(item, `${path}[${i}]`);
      return {
        w: asString(o["w"], `${path}[${i}].w`),
        diff: asString(o["diff"], `${path}[${i}].diff`),
      };
    });

  const parsed = asObject(JSON.parse(raw), "the value");
  if (parsed["v"] !== CONNECTIONS_SCHEMA_VERSION) {
    return undefined;
  }

  const regionNames = Object.keys(CONNECTIONS_REGIONS) as ConnectionsRegion[];
  const region = asObject(parsed["region"], "region");
  return {
    hint: asString(parsed["hint"], "hint"),
    synonyms: asWordDiffs(parsed["synonyms"], "synonyms"),
    antonyms: asWordDiffs(parsed["antonyms"], "antonyms"),
    measureWords: asArray(parsed["measure_words"], "measure_words").map(
      (item, i) => asString(item, `measure_words[${i}]`),
    ),
    register: asOneOf(parsed["register"], CONNECTIONS_REGISTERS, "register"),
    region: {
      usage: asOneOf(
        region["usage"],
        [...regionNames, "both" as const],
        "region.usage",
      ),
      equivalents: asArray(region["equivalents"], "region.equivalents").map(
        (item, i) => {
          const o = asObject(item, `region.equivalents[${i}]`);
          return {
            w: asString(o["w"], `region.equivalents[${i}].w`),
            region: asOneOf(
              o["region"],
              regionNames,
              `region.equivalents[${i}].region`,
            ),
          };
        },
      ),
    },
    pairsWith: asArray(parsed["pairs_with"], "pairs_with").map((item, i) => {
      const o = asObject(item, `pairs_with[${i}]`);
      return {
        w: asString(o["w"], `pairs_with[${i}].w`),
        pattern: asString(o["pattern"], `pairs_with[${i}].pattern`),
      };
    }),
  };
}

export type CharsToPhrasesPinyin = {
  [key: string]: {
    [key: string]: PinyinType;
  };
};

const IGNORE_PHRASE_CHARS = new Set([
  ...Array.from({ length: 128 }, (_, i) => String.fromCharCode(1 + i)),
  ..."–；《》—⋯Ａ？āēīōūǖáéíóúǘǎěǐǒǔǚàèìòùǜ、，。…（）＝’！→ 【】“”「」ㄒ～：ㄧˊ ㄍㄨㄢˋㄈㄤㄔㄜㄐㄑㄠˇ ㄊㄚㄥㄗㄟㄩㄓㄖㄕㄌㄅㄆㄇㄉㄎㄏㄞㄣㄛㄦㄙㄘㄋㄝㄡ ̀◆ ́ ̌ ̄・",
]);
const IGNORE_PHRASES = new Set([
  "我要",
  "一碗",
  "一杯",
  "不要",
  "兩碗",
  "兩杯",
  "你的",
  "我是",
  "這是",
  "一天",
  "要用",
  "你來",
]);

export { IGNORE_PHRASE_CHARS, IGNORE_PHRASES };

// Create a custom hook to load and manage Anki data with reload capability
export function useAnkiPhrases() {
  const [phrases, setPhrases] = useState<PhraseType[]>([]);
  const [charPhrasesPinyin, setCharPhrasesPinyin] =
    useState<CharsToPhrasesPinyin>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [invalidData, setInvalidData] = useState<InvalidDataRecord[]>([]);
  const { settings } = useSettings();

  const addInvalidData = (n: InvalidDataRecord) =>
    setInvalidData((data) => [...data, n]);

  // Define the load function with useCallback so it doesn't recreate on every render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setInvalidData([]);

      // Load from Anki
      const notesId = await anki.note.findNotes({
        query:
          "(" +
          settings.phraseNotes.map((pn) => "note:" + pn.noteType).join(" OR ") +
          ") -is:suspended -is:new",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });

      const loaded: PhraseType[] = [];
      const chars: CharsToPhrasesPinyin = {};

      for (const note of notes) {
        const pinyin = note.fields["Pinyin"].value.toLowerCase();
        const traditional = note.fields["Traditional"].value;
        const info: PhraseType = {
          noteId: note.noteId,
          source: note.modelName,
          traditional,
          sentenceTraditional: note.fields["Sentence Traditional"]?.value ?? "",
          sentenceCloze: parseSentenceCloze(
            note.fields["Sentence Cloze Traditional"]?.value,
            note.fields["Sentence Cloze English"]?.value,
          ),
          meaning: note.fields["Meaning"].value,
          partOfSpeech: note.fields["POS"]?.value,
          examples: parseExamplesJson(
            note.fields["Examples JSON"]?.value,
            note.noteId,
          ),
          connections: parseConnectionsJson(
            note.fields["Connections JSON"]?.value,
            note.noteId,
          ),
          pinyin,
          zhuyin: note.fields["Zhuyin"]?.value,
          tags: note.tags,
          audio: note.fields["Audio"].value,
        };

        const processPinyin = (sPinyin: string, sTraditional: string) => {
          if (
            sPinyin.endsWith("r") &&
            !sPinyin.endsWith("ér") &&
            sTraditional.endsWith("兒")
          ) {
            sPinyin = sPinyin.slice(0, sPinyin.length - 1);
            sTraditional = sTraditional.slice(0, sTraditional.length - 1);
          }
          const split = pinyinSplit(sPinyin);
          if (split.length === sTraditional.length) {
            for (var i = 0; i < split.length; i++) {
              const t = sTraditional[i];
              const p = split[i];
              if (chars[t] === undefined) {
                chars[t] = {};
              }
              if (chars[t][p] === undefined) {
                const sylable = removeTone(p);
                const toneMatch =
                  diacriticToNumber(p).match(/([a-z]+)([1-5])*$/);
                if (!toneMatch) {
                  addInvalidData({
                    message: "Invalid pinyin, could not determine the tone",
                    details: {
                      pinyinPart: p,
                      pinyin: sPinyin,
                      traditional: sTraditional,
                    },
                  });
                  return;
                }
                let tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;
                chars[t][p] = { pinyinAccented: p, sylable, tone, count: 0 };
              }
              chars[t][p].count!++;
            }
          } else {
            addInvalidData({
              message:
                "Invalid Pinyin, could not match all characters to pinyin",
              details: { pinyin: sPinyin, traditional: sTraditional },
            });
          }
        };

        const variants = note.fields["Variants"]?.value || "";

        if (variants.length > 0) {
          for (const variant of JSON.parse(variants)) {
            processPinyin(
              variant["Pinyin"].toLowerCase(),
              variant["Traditional"],
            );
          }
        } else {
          processPinyin(
            pinyin
              .replace("<div>", "")
              .replace("</div>", "")
              .replace("?", "")
              .replace(",", "")
              .replace("&nbsp;", ""),
            traditional
              .replace("？", "")
              .replace("?", "")
              .replace("，", "")
              .replace(",", "")
              .replace(" ", ""),
          );
        }
        loaded.push(info);
      }

      for (const c of Object.keys(chars)) {
        const keys = Object.keys(chars[c]);
        for (var i = 0; i < keys.length; i++) {
          for (var j = i + 1; j < keys.length; j++) {
            if (chars[c][keys[i]].sylable === chars[c][keys[j]].sylable) {
              if (chars[c][keys[i]].tone === 5) {
                chars[c][keys[i]].ignoredFifthTone = true;
              }
              if (chars[c][keys[j]].tone === 5) {
                chars[c][keys[j]].ignoredFifthTone = true;
              }
            }
          }
        }
      }

      setPhrases(loaded);
      setCharPhrasesPinyin(chars);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [settings.phraseNotes]);

  // Initial load on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Return the data and the reload function
  return {
    phrases,
    charPhrasesPinyin,
    invalidData,
    loading,
    error,
    reload: loadData, // Expose the reload function
  };
}
