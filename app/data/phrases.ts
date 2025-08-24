import { useCallback, useEffect, useState } from "react";
import anki from "~/apis/anki";
import pinyinSplit from "pinyin-split";
import { diacriticToNumber, removeTone } from "pinyin-tools";
import { useSettings } from "~/settings/SettingsContext";
import type { PinyinType } from "./pinyin_function";
import type { InvalidDataRecord } from "./types";

export type PhraseType = {
  noteId: number;
  source: string;
  traditional: string;
  meaning: string;
  partOfSpeech?: string;
  pinyin: string;
  zhuyin?: string;
  tags: string[];
  audio: string;
};

export type CharsToPhrasesPinyin = {
  [key: string]: {
    [key: string]: PinyinType;
  };
};

const IGNORE_PHRASE_CHARS = new Set([
  ...Array.from({ length: 128 }, (_, i) => String.fromCharCode(1 + i)),
  ..."？āēīōūǖáéíóúǘǎěǐǒǔǚàèìòùǜ、，。…（）＝’！→ 【】“”「」ㄒ～：ㄧˊ ㄍㄨㄢˋㄈㄤㄔㄜㄐㄑㄠˇ ㄊㄚㄥㄗㄟㄩㄓㄖㄕㄌㄅㄆㄇㄉㄎㄏㄞㄣㄛㄦㄙㄘㄋㄝㄡ",
]);
export { IGNORE_PHRASE_CHARS };

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
        const pinyin = note.fields["Pinyin"].value;
        const traditional = note.fields["Traditional"].value;
        const info: PhraseType = {
          noteId: note.noteId,
          source: note.modelName,
          traditional,
          meaning: note.fields["Meaning"].value,
          partOfSpeech: note.fields["POS"]?.value,
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
            processPinyin(variant["Pinyin"], variant["Traditional"]);
          }
        } else {
          processPinyin(
            pinyin
              .replace(/\<span style="color: rgb\([0-9, ]+\);"\>/g, "")
              .replace(/\<\/span\>/g, "")
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
              .replace(" ", "")
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
