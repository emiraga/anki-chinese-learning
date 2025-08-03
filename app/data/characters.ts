import pinyin from "pinyin";
import { getPinyinUnreliable, type PinyinType } from "./pinyin_function";
import { useCallback, useEffect, useState } from "react";
import anki from "~/apis/anki";
import type { CharsToPhrasesPinyin } from "./phrases";
import { useSettings } from "~/settings/SettingsContext";
import { cleanPinyinAnkiField, comparePinyin } from "./pinyin_function";
import { diacriticToNumber, removeTone } from "pinyin-tools";

export type CharacterType = {
  ankiId: number | null;
  traditional: string;
  meaning: string;
  meaning2: string;
  pinyin: PinyinType[];
  pinyinAnki?: string[];
  mnemonic: string;
  tags: string[];
  withSound: boolean;
  withMeaning: boolean;
  todoMoreWork: boolean;
};

function fromAccentedPinyin(pinyin: string): PinyinType {
  const sylable = removeTone(pinyin);
  const toneMatch = diacriticToNumber(pinyin).match(/([a-z]+)([1-5])*$/);
  if (!toneMatch) {
    console.log(pinyin);
    throw new Error("invalid pinyin: " + pinyin);
  }
  let tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;
  return { pinyinAccented: pinyin, sylable, tone };
}

export function getNewCharacter(traditional: string): CharacterType | null {
  let realPinyin = getPinyinUnreliable(traditional, pinyin.STYLE_TONE);
  let numberedPinyin = getPinyinUnreliable(traditional, pinyin.STYLE_TONE2);

  const toneMatch = numberedPinyin.match(/([a-z]+)([1-5])*$/);
  if (toneMatch === null) {
    return null;
  }
  let sylable = toneMatch[1];
  let tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;

  return {
    ankiId: null,
    traditional: traditional,
    meaning: "",
    meaning2: "",
    pinyin: [{ pinyinAccented: realPinyin, tone, sylable }],
    mnemonic: "",
    tags: [],
    withSound: true,
    withMeaning: true,
    todoMoreWork: false,
  };
}

export type KnownSoundsType = {
  [key1: string]: {
    [key2: number]: CharacterType[];
  };
};

export type CharactersType = { [key1: string]: CharacterType };

// Create a custom hook to load and manage Anki data with reload capability
export function useAnkiCharacters(charPhrasesPinyin: CharsToPhrasesPinyin) {
  const [characters, setCharacters] = useState<CharactersType>({});
  const [knownSounds, setKnownSounds] = useState<KnownSoundsType>({});
  const [characterList, setCharacterList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { settings } = useSettings();

  // Define the load function with useCallback so it doesn't recreate on every render
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const loadedChars: CharactersType = {};
      const loadedKnownSounds: KnownSoundsType = {};
      const loadedCharacterList: string[] = [];
      const characterNoteType = settings.characterNote?.noteType;
      if (!characterNoteType || characterNoteType.length === 0) {
        // Load character info from phrases.
        for (const hanzi of Object.keys(charPhrasesPinyin)) {
          const pinyinSorted = Object.values(charPhrasesPinyin[hanzi]).sort(
            comparePinyin
          );
          let info: CharacterType = {
            ankiId: 0,
            traditional: hanzi,
            meaning: "",
            meaning2: "",
            pinyin: pinyinSorted,
            mnemonic: "",
            tags: [],
            withSound: true,
            withMeaning: true,
            todoMoreWork: false,
          };
          const first = pinyinSorted[0];
          if (loadedKnownSounds[first.sylable] === undefined) {
            loadedKnownSounds[first.sylable] = {};
          }
          if (loadedKnownSounds[first.sylable][first.tone] === undefined) {
            loadedKnownSounds[first.sylable][first.tone] = [];
          }
          loadedKnownSounds[first.sylable][first.tone].push(info);
          loadedCharacterList.push(info.traditional);
          loadedChars[hanzi] = info;
        }
      } else {
        // Load characters from Anki
        const notesId = await anki.note.findNotes({
          query: `note:${characterNoteType} -is:suspended`,
        });
        const notes = await anki.note.notesInfo({ notes: notesId });

        for (const note of notes) {
          const traditional = note.fields["Traditional"].value;
          if (traditional.length !== 1) {
            throw new Error("should be a single character: " + traditional);
          }
          const notLearningSound1 =
            (note.fields["Meaning 2"]?.value?.length ?? 0) === 0;
          const notLearningSound2 = note.tags.includes(
            "not-learning-sound-yet"
          );
          if (notLearningSound1 !== notLearningSound2) {
            throw new Error("Not learning sound conflict: " + traditional);
          }

          const pinyinAnki1 = note.fields["Pinyin"].value;
          const pinyinAnki2 = note.fields["Pinyin others"]?.value
            ?.split(",")
            .map((p) => cleanPinyinAnkiField(p));
          const pinyin1 = fromAccentedPinyin(
            cleanPinyinAnkiField(note.fields["Pinyin"].value)
          );

          const pinyin2 =
            note.tags.includes("multiple-pronounciation-character") &&
            note.fields["Pinyin others"]?.value?.length > 0
              ? note.fields["Pinyin others"]?.value
                  .split(",")
                  .map((p) => fromAccentedPinyin(cleanPinyinAnkiField(p)))
              : undefined;

          if (
            note.tags.includes("not-learning-sound-yet") &&
            note.tags.includes("not-learning-meaning-yet")
          ) {
            throw new Error(
              "Not learning either meaning or sound for Hanzi char: " +
                traditional
            );
          }
          let info: CharacterType = {
            ankiId: note.noteId,
            traditional,
            meaning: note.fields["Meaning"].value,
            meaning2:
              note.fields["Meaning2"]?.value || note.fields["Meaning"].value,
            pinyin: [pinyin1].concat(pinyin2 || []),
            pinyinAnki: [pinyinAnki1].concat(pinyinAnki2 || []),
            mnemonic: note.fields["Mnemonic"].value,
            tags: note.tags,
            withSound: !note.tags.includes("not-learning-sound-yet"),
            withMeaning: !note.tags.includes("not-learning-meaning-yet"),
            todoMoreWork:
              note.tags.includes("TODO") ||
              note.tags.length < 2 ||
              note.tags.includes("some-props-missing") ||
              note.tags.filter((t) => t.startsWith("prop::")).length === 0,
          };

          if (info.withSound) {
            for (const p of info.pinyin) {
              if (loadedKnownSounds[p.sylable] === undefined) {
                loadedKnownSounds[p.sylable] = {};
              }
              if (loadedKnownSounds[p.sylable][p.tone] === undefined) {
                loadedKnownSounds[p.sylable][p.tone] = [];
              }
              loadedKnownSounds[p.sylable][p.tone].push(info);
            }
          }
          if (loadedChars[info.traditional] !== undefined) {
            throw new Error("Duplicate char: " + info.traditional);
          }

          loadedCharacterList.push(info.traditional);
          loadedChars[info.traditional] = info;
        }
      }

      setCharacters(loadedChars);
      setKnownSounds(loadedKnownSounds);
      setCharacterList(loadedCharacterList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [charPhrasesPinyin, settings.characterNote?.noteType]); // Empty dependency array means this function won't change

  // Initial load on component mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Return the data and the reload function
  return {
    characters,
    knownSounds,
    characterList,
    loading,
    error,
    reload: loadData, // Expose the reload function
  };
}
