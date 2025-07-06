import { useCallback, useEffect, useState } from "react";
import anki from "~/apis/anki";
import pinyinSplit from "pinyin-split";
import { diacriticToNumber, removeTone } from "pinyin-tools";

export type PhraseType = {
  source: string;
  traditional: string;
  meaning: string;
  pinyin: string;
  tags: string[];
};

export type CharsToPhrasesPinyin = {
  [key: string]: {
    [key: string]: {
      pinyin: string;
      tone: number;
      sylable: string;
      count: number;
    };
  };
};

const IGNORE_PHRASE_CHARS = new Set([
  ...Array.from({ length: 128 }, (_, i) => String.fromCharCode(1 + i)),
  "？",
  "ā",
  "ē",
  "ī",
  "ō",
  "ū",
  "ǖ",
  "á",
  "é",
  "í",
  "ó",
  "ú",
  "ǘ",
  "ǎ",
  "ě",
  "ǐ",
  "ǒ",
  "ǔ",
  "ǚ",
  "à",
  "è",
  "ì",
  "ò",
  "ù",
  "ǜ",
  "，",
  "。",
  "（",
  "）",
  "＝",
  "’",
]);
export { IGNORE_PHRASE_CHARS };

// Create a custom hook to load and manage Anki data with reload capability
export function useAnkiPhrases() {
  const [phrases, setPhrases] = useState<PhraseType[]>([]);
  const [charPhrasesPinyin, setCharPhrasesPinyin] =
    useState<CharsToPhrasesPinyin>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Define the load function with useCallback so it doesn't recreate on every render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load from Anki
      const notesId = await anki.note.findNotes({
        query:
          "(((note:Dangdai OR note:TOCFL) -is:suspended -is:new) OR (note:MyWords -is:suspended))",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });

      const loaded: PhraseType[] = [];
      const chars: CharsToPhrasesPinyin = {};

      for (const note of notes) {
        const pinyin = note.fields["Pinyin"].value;
        const traditional = note.fields["Traditional"].value;
        const info: PhraseType = {
          source: note.modelName,
          traditional,
          meaning: note.fields["Meaning"].value,
          pinyin,
          tags: note.tags,
        };

        const sTraditional = traditional
          .replace("？", "")
          .replace("?", "")
          .replace("，", "")
          .replace(",", "")
          .replace(" ", "");
        const sPinyin = pinyin
          .replace(/\<span style="color: rgb\([0-9, ]+\);"\>/g, "")
          .replace(/\<\/span\>/g, "")
          .replace("<div>", "")
          .replace("</div>", "")
          .replace("?", "")
          .replace(",", "")
          .replace("&nbsp;", "");
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
              const toneMatch = diacriticToNumber(p).match(/([a-z]+)([1-5])*$/);
              if (!toneMatch) {
                throw new Error("invalid pinyin: " + p);
              }
              let tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;
              chars[t][p] = { pinyin: p, sylable, tone, count: 0 };
            }
            chars[t][p].count++;
          }
        } else {
          // TODO: show this somewhere more prominent
          console.log(
            "Warning invalid Pinyin: " +
              sPinyin +
              " Traditional: " +
              sTraditional
          );
        }

        loaded.push(info);
      }

      setPhrases(loaded);
      setCharPhrasesPinyin(chars);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array means this function won't change

  // Initial load on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Return the data and the reload function
  return {
    phrases,
    charPhrasesPinyin,
    loading,
    error,
    reload: loadData, // Expose the reload function
  };
}
