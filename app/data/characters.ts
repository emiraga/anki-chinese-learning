import pinyin from "pinyin";
import { get_pinyin } from "./pinyin_function";
import { useCallback, useEffect, useState } from "react";
import anki from "~/apis/anki";
import type { CharsToPhrasesPinyin } from "./phrases";
import { useSettings } from "~/settings/SettingsContext";

export type CharacterType = {
  ankiId: number | null;
  traditional: string;
  sylable: string;
  tone: number;
  pinyin: string;
  meaning: string;
  meaning2: string;
  pinyin_anki_1: string;
  pinyin_anki_2: string;
  mnemonic: string;
  tags: string[];
  withSound: boolean;
  withMeaning: boolean;
};

export function getNewCharacter(traditional: string): CharacterType | null {
  let realPinyin = get_pinyin(traditional, pinyin.STYLE_TONE);
  let numberedPinyin = get_pinyin(traditional, pinyin.STYLE_TONE2);

  const toneMatch = numberedPinyin.match(/([a-z]+)([1-5])*$/);
  if (toneMatch === null) {
    return null;
  }
  let sylable = toneMatch[1];
  let tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;

  return {
    ankiId: null,
    traditional: traditional,
    sylable,
    tone,
    pinyin: realPinyin,
    meaning: "",
    meaning2: "",
    pinyin_anki_1: "",
    pinyin_anki_2: "",
    mnemonic: "",
    tags: [],
    withSound: true,
    withMeaning: true,
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
        console.log("p2", charPhrasesPinyin);
        // Load character info from phrases.
        for (const hanzi of Object.keys(charPhrasesPinyin)) {
          const primaryPinyin = Object.values(charPhrasesPinyin[hanzi]).sort(
            (a, b) => b.count - a.count
          )[0];
          let info: CharacterType = {
            ankiId: 0,
            traditional: hanzi,
            sylable: primaryPinyin.sylable,
            tone: primaryPinyin.tone,
            pinyin: primaryPinyin.pinyin,
            meaning: "",
            meaning2: "",
            pinyin_anki_1: primaryPinyin.pinyin,
            pinyin_anki_2: primaryPinyin.pinyin,
            mnemonic: "",
            tags: [],
            withSound: true,
            withMeaning: true,
          };
          console.log("info:", hanzi, info);
          if (loadedKnownSounds[info.sylable] === undefined) {
            loadedKnownSounds[info.sylable] = {};
          }
          if (loadedKnownSounds[info.sylable][info.tone] === undefined) {
            loadedKnownSounds[info.sylable][info.tone] = [];
          }
          loadedKnownSounds[info.sylable][info.tone].push(info);
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

          let realPinyin = get_pinyin(traditional, pinyin.STYLE_TONE);
          let numberedPinyin = get_pinyin(traditional, pinyin.STYLE_TONE2);

          const toneMatch = numberedPinyin.match(/([a-zü]+)([1-5])*$/);
          if (!toneMatch) {
            throw new Error("Mistake in Hanzi char: " + traditional);
          }
          if (
            note.tags.includes("not-learning-sound-yet") &&
            note.tags.includes("not-learning-meaning-yet")
          ) {
            throw new Error(
              "Not learning either meaning or sound for Hanzi char: " +
                traditional
            );
          }
          const sylable = toneMatch[1];
          const tone = toneMatch[2] ? parseInt(toneMatch[2], 10) : 5;
          let info: CharacterType = {
            ankiId: note.noteId,
            traditional,
            sylable,
            tone,
            pinyin: realPinyin,
            meaning: note.fields["Meaning"].value,
            meaning2:
              note.fields["Meaning2"]?.value || note.fields["Meaning"].value,
            pinyin_anki_1: note.fields["Pinyin"].value,
            pinyin_anki_2: note.fields["Pinyin 2"].value,
            mnemonic: note.fields["Mnemonic"].value,
            tags: note.tags,
            withSound: !note.tags.includes("not-learning-sound-yet"),
            withMeaning: !note.tags.includes("not-learning-meaning-yet"),
          };

          if (info.withSound) {
            if (loadedKnownSounds[sylable] === undefined) {
              loadedKnownSounds[sylable] = {};
            }
            if (loadedKnownSounds[sylable][tone] === undefined) {
              loadedKnownSounds[sylable][tone] = [];
            }
            loadedKnownSounds[sylable][tone].push(info);
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
  }, [charPhrasesPinyin]); // Empty dependency array means this function won't change

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
