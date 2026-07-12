import type { CharactersType, CharacterType } from "~/data/characters";
import type { PhraseType } from "~/data/phrases";
import type { PropType } from "~/data/props";
import { REVERSE_FULL_MAP } from "~/data/pinyin_table";
import pinyinToZhuyin from "zhuyin-improved";
import {
  getCharacterMnemonicTags,
  shouldHaveMnemonicTags,
} from "~/data/character_tags";

/**
 * Pure (fetch-free) integrity checks that only depend on already-loaded state
 * (characters, phrases, props). These power the `/conflicts` and
 * `/phrase_conflicts` pages as well as the conflict counters in the toolbar.
 *
 * Checks that require fetching all cards/decks from Anki intentionally live in
 * `~/components/Integrity` instead.
 */

function computeExpectedZhuyin(pinyinAccented: string): string {
  return pinyinToZhuyin(pinyinAccented)
    .map((x) => (Array.isArray(x) ? x.join("") : x))
    .map((x) => (x?.startsWith("˙") ? x.substring(1) + x[0] : x))
    .join("");
}

// --- Character checks -------------------------------------------------------

export type ActorPlaceToneMigration = CharacterType & {
  needTags: string[];
  initial: string;
  final: string;
  actorTag: string;
  placeTag: string;
  toneTag: string;
};

export function getActorPlaceToneMigrations(
  characters: CharactersType,
): ActorPlaceToneMigration[] {
  return Object.values(characters)
    .filter((char) => shouldHaveMnemonicTags(char))
    .map((char) => {
      const { missingTags, actorTag, placeTag, toneTag } =
        getCharacterMnemonicTags(char);
      const { initial, final } = REVERSE_FULL_MAP[char.pinyin[0].sylable];
      return {
        ...char,
        needTags: missingTags,
        initial,
        final,
        actorTag,
        placeTag,
        toneTag,
      };
    })
    .filter((char) => {
      if (
        char.tags.filter((t) => t.startsWith("actor::")).length === 1 &&
        char.tags.filter((t) => t.startsWith("place::")).length === 1 &&
        char.tags.filter((t) => t.startsWith("tone::")).length === 1 &&
        char.needTags.length === 0
      ) {
        return false;
      }
      return true;
    });
}

export function getPropNameMigrations(props: PropType[]): PropType[] {
  return props.filter((prop) => prop.mainTagname !== "prop::" + prop.prop);
}

export function getLowercasePinyinChars(
  characters: CharactersType,
): CharacterType[] {
  return Object.values(characters).filter(
    (char) =>
      char.pinyin[0].pinyinAccented !==
        char.pinyin[0].pinyinAccented.toLowerCase() ||
      char.pinyin[1]?.pinyinAccented !==
        char.pinyin[1]?.pinyinAccented?.toLowerCase(),
  );
}

export type CharZhuyinIssue = CharacterType & {
  expectedZhuyin: string;
  isConsistent: boolean;
};

export function getCharacterZhuyinInconsistencies(
  characters: CharactersType,
): CharZhuyinIssue[] {
  return Object.values(characters)
    .filter((char) => char.ankiId && char.pinyinAnki && char.pinyinAnki.length > 0)
    .map((char) => {
      let expectedZhuyin = "";
      try {
        expectedZhuyin = computeExpectedZhuyin(char.pinyin[0].pinyinAccented);
      } catch (error) {
        console.warn(
          "Failed to convert character pinyin to zhuyin:",
          char.pinyin[0].pinyinAccented,
          error,
        );
        return null;
      }

      const actualZhuyin = char.zhuyinAnki?.[0]?.trim();
      const isConsistent = actualZhuyin === expectedZhuyin;

      return { ...char, expectedZhuyin, isConsistent };
    })
    .filter(
      (char): char is CharZhuyinIssue => char !== null && !char.isConsistent,
    );
}

// --- Phrase checks ----------------------------------------------------------

export function getLowercasePinyinPhrases(phrases: PhraseType[]): PhraseType[] {
  return phrases.filter(
    (phrase) => phrase.pinyin !== phrase.pinyin.toLowerCase(),
  );
}

export type PhraseZhuyinIssue = PhraseType & {
  expectedZhuyin: string;
  isConsistent: boolean;
};

export function getPhraseZhuyinInconsistencies(
  phrases: PhraseType[],
): PhraseZhuyinIssue[] {
  return phrases
    .filter((phrase) => phrase.zhuyin && phrase.pinyin)
    .map((phrase) => {
      let expectedZhuyin = "";
      try {
        expectedZhuyin = computeExpectedZhuyin(
          phrase.pinyin.replaceAll("<div>", "").replaceAll("</div>", ""),
        );
      } catch (error) {
        console.warn(
          "Failed to convert pinyin to zhuyin:",
          phrase.pinyin,
          error,
        );
        return null;
      }

      const actualZhuyin = phrase.zhuyin
        ?.trim()
        .replaceAll("?", "")
        .replaceAll("'", "")
        .replaceAll(",", "")
        .replaceAll(/\s/g, "");
      const isConsistent = actualZhuyin === expectedZhuyin;

      return { ...phrase, expectedZhuyin, isConsistent };
    })
    .filter(
      (phrase): phrase is PhraseZhuyinIssue =>
        phrase !== null && !phrase.isConsistent,
    );
}

export const DUPLICATE_PHRASE_SOURCES = ["TOCFL", "Hanzi"] as const;

/**
 * Returns all phrase entries from a given source whose `traditional` appears
 * more than once (i.e. every entry that is part of a duplicate group).
 */
export function getDuplicatePhrases(
  phrases: PhraseType[],
  source: string,
): PhraseType[] {
  const sourcePhrases = phrases.filter((phrase) => phrase.source === source);

  const traditionalCounts = new Map<string, number>();
  for (const phrase of sourcePhrases) {
    traditionalCounts.set(
      phrase.traditional,
      (traditionalCounts.get(phrase.traditional) || 0) + 1,
    );
  }

  const duplicateTraditionals = new Set(
    [...traditionalCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([traditional]) => traditional),
  );

  return sourcePhrases.filter((phrase) =>
    duplicateTraditionals.has(phrase.traditional),
  );
}

// --- Aggregate counts (for the toolbar) -------------------------------------

/**
 * Number of extra character conflicts that were migrated out of `/integrity`
 * into `/conflicts`. Added on top of `getConflictingChars` for the total count.
 */
export function getCharacterConflictsExtrasCount(
  characters: CharactersType,
  props: PropType[],
): number {
  return (
    getActorPlaceToneMigrations(characters).length +
    getPropNameMigrations(props).length +
    getCharacterZhuyinInconsistencies(characters).length +
    getLowercasePinyinChars(characters).length
  );
}

/** Total number of phrase conflicts shown on `/phrase_conflicts`. */
export function getPhraseConflictsCount(phrases: PhraseType[]): number {
  const duplicates = DUPLICATE_PHRASE_SOURCES.reduce(
    (sum, source) => sum + getDuplicatePhrases(phrases, source).length,
    0,
  );
  return (
    duplicates +
    getPhraseZhuyinInconsistencies(phrases).length +
    getLowercasePinyinPhrases(phrases).length
  );
}
