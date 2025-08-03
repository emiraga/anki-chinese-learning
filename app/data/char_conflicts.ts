import { type CharactersType, type CharacterType } from "~/data/characters";
import type { KnownPropsType } from "~/data/props";
import {
  IGNORE_PHRASE_CHARS,
  type CharsToPhrasesPinyin,
  type PhraseType,
} from "~/data/phrases";
import { type PinyinType } from "~/data/pinyin_function";
import { comparePinyin } from "~/data/pinyin_function";
import { removeDuplicateChars } from "~/data/utils";

function isConflictingPinyin(
  charPhrasesPinyin: { [key: string]: PinyinType },
  withSound: boolean,
  pinyin: string | undefined,
  pinyinAnki: string,
  index: number
) {
  if (!pinyinAnki.includes(">" + pinyin + "<") && pinyin !== pinyinAnki) {
    return true;
  }

  if (withSound) {
    if (!charPhrasesPinyin) {
      return true;
    }
    if (pinyin && !charPhrasesPinyin[pinyin]) {
      return true;
    }
  }
  if (charPhrasesPinyin) {
    const best = Object.values(charPhrasesPinyin).sort(comparePinyin)[index];
    if (best.pinyinAccented !== pinyin) {
      return true;
    }
  }
}

export function getConflictingChars(
  knownProps: KnownPropsType,
  characters: CharactersType,
  charPhrasesPinyin: CharsToPhrasesPinyin
): CharacterType[] {
  return Object.values(characters).filter((v) => {
    for (const tag of v.tags) {
      if (tag.startsWith("prop::")) {
        if (knownProps[tag] === undefined) {
          return true;
        }
      }
    }

    if (
      v?.pinyinAnki &&
      isConflictingPinyin(
        charPhrasesPinyin[v.traditional],
        v.withSound,
        v.pinyin[0].pinyinAccented,
        v?.pinyinAnki[0],
        0
      )
    ) {
      return true;
    }
    if (v.tags.includes("multiple-pronounciation-character")) {
      if (
        v?.pinyinAnki &&
        v.pinyinAnki.length > 1 &&
        v.pinyin.length > 1 &&
        isConflictingPinyin(
          charPhrasesPinyin[v.traditional],
          v.withSound,
          v.pinyin[1].pinyinAccented,
          v.pinyinAnki[1],
          1
        )
      ) {
        return true;
      }
    }
  });
}

export function getMissingPhraseChars(
  phrases: PhraseType[],
  characters: CharactersType
) {
  return [
    ...removeDuplicateChars(
      phrases.map((p) => p.traditional).join(""),
      IGNORE_PHRASE_CHARS
    ),
  ].filter(
    (c) => characters[c] === undefined || characters[c].withSound === false
  );
}
