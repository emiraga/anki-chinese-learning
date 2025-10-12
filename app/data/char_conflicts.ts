import { type CharactersType, type CharacterType } from "~/data/characters";
import type { KnownPropsType } from "~/data/props";
import {
  IGNORE_PHRASE_CHARS,
  type CharsToPhrasesPinyin,
  type PhraseType,
} from "~/data/phrases";
import { removeDuplicateChars } from "~/utils/array";

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

    if (fromPhrases.size === 0 && v.withSound) {
      return true;
    }

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

export type CharacterPairWithSharedProps = {
  char1: CharacterType;
  char2: CharacterType;
  sharedProps: string[];
  sharedPropsCount: number;
};

export function getCharacterPairsWithSimilarProps(
  characters: CharactersType
): CharacterPairWithSharedProps[] {
  const pairs: CharacterPairWithSharedProps[] = [];

  // Get all characters with props
  const charsWithProps = Object.values(characters).filter(char =>
    char.tags.some(tag => tag.startsWith("prop::"))
  );

  // Compare each character with characters that come after it to avoid duplicates
  for (let i = 0; i < charsWithProps.length; i++) {
    const char1 = charsWithProps[i];
    const char1Props = char1.tags.filter(tag => tag.startsWith("prop::"));

    for (let j = i + 1; j < charsWithProps.length; j++) {
      const char2 = charsWithProps[j];
      const char2Props = char2.tags.filter(tag => tag.startsWith("prop::"));

      const sharedProps = char1Props.filter(prop => char2Props.includes(prop));

      if (sharedProps.length >= 3) {
        pairs.push({
          char1,
          char2,
          sharedProps,
          sharedPropsCount: sharedProps.length
        });
      }
    }
  }

  // Sort by number of shared props (descending)
  pairs.sort((a, b) => b.sharedPropsCount - a.sharedPropsCount);

  return pairs;
}
