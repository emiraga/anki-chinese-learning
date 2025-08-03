import { type CharactersType, type CharacterType } from "~/data/characters";
import type { KnownPropsType } from "~/data/props";
import {
  IGNORE_PHRASE_CHARS,
  type CharsToPhrasesPinyin,
  type PhraseType,
} from "~/data/phrases";
import { removeDuplicateChars } from "~/data/utils";

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

    const fromAnki = new Set(v.pinyin.map((x) => x.pinyinAccented));
    const fromPhrases = new Set(
      charPhrasesPinyin[v.traditional]
        ? Object.values(charPhrasesPinyin[v.traditional])
            .filter((x) => !x.ignoredFifthTone)
            .map((x) => x.pinyinAccented)
        : []
    );
    for (const p of fromPhrases) {
      if (!fromAnki.has(p)) {
        console.log("Missing", p, "in", fromAnki);
        return true;
      }
    }
    return false;
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
