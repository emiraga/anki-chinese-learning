import { type CharactersType, type CharacterType } from "~/data/characters";
import type { KnownPropsType } from "~/data/props";
import {
  IGNORE_PHRASE_CHARS,
  type CharsToPhrasesPinyin,
  type PhraseType,
} from "~/data/phrases";
import { removeDuplicateChars } from "~/utils/array";

export type ConflictReason =
  | { type: "missing_props"; props: string[] }
  | { type: "no_pinyin_from_phrases" }
  | { type: "pinyin_mismatch"; missingPinyin: string[] };

export type CharacterConflict = {
  character: CharacterType;
  reason: ConflictReason;
};

export function getConflictingChars(
  knownProps: KnownPropsType,
  characters: CharactersType,
  charPhrasesPinyin: CharsToPhrasesPinyin
): CharacterConflict[] {
  const conflicts: CharacterConflict[] = [];

  for (const v of Object.values(characters)) {
    // Check for missing props
    const missingProps = v.tags.filter(
      (tag) => tag.startsWith("prop::") && knownProps[tag] === undefined
    );
    if (missingProps.length > 0) {
      conflicts.push({
        character: v,
        reason: { type: "missing_props", props: missingProps },
      });
      continue;
    }

    const fromAnki = new Set(v.pinyin.map((x) => x.pinyinAccented));
    const fromPhrases = new Set(
      charPhrasesPinyin[v.traditional]
        ? Object.values(charPhrasesPinyin[v.traditional])
            .filter((x) => !x.ignoredFifthTone)
            .map((x) => x.pinyinAccented)
        : []
    );

    // Check for no pinyin from phrases
    if (fromPhrases.size === 0 && v.withSound) {
      conflicts.push({
        character: v,
        reason: { type: "no_pinyin_from_phrases" },
      });
      continue;
    }

    // Check for pinyin mismatch
    const missingPinyin: string[] = [];
    for (const p of fromPhrases) {
      if (!fromAnki.has(p)) {
        console.log("Missing", p, "in", fromAnki);
        missingPinyin.push(p);
      }
    }
    if (missingPinyin.length > 0) {
      conflicts.push({
        character: v,
        reason: { type: "pinyin_mismatch", missingPinyin },
      });
    }
  }

  return conflicts;
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

export type SoundRelationship =
  | { type: "none" }
  | { type: "char1_is_sound_of_char2" }
  | { type: "char2_is_sound_of_char1" }
  | { type: "shared_sound_component"; component: string }
  | { type: "common_ancestor"; ancestor: string; depth1: number; depth2: number };

export type CharacterPairWithSharedProps = {
  char1: CharacterType;
  char2: CharacterType;
  sharedProps: string[];
  sharedPropsCount: number;
  soundRelationship: SoundRelationship;
};

/**
 * Builds the chain of sound components from a character to its root ancestor
 * @param char Starting character
 * @param characters All characters map
 * @returns Array of characters in the chain, from char to root (excluding the starting char itself)
 */
function buildSoundChain(
  char: CharacterType,
  characters: CharactersType
): string[] {
  const chain: string[] = [];
  let current = char.soundComponentCharacter;
  const seen = new Set<string>([char.traditional]); // Prevent cycles

  while (current && characters[current] && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = characters[current].soundComponentCharacter;
  }

  return chain;
}

/**
 * Finds the closest common ancestor in the sound component chains of two characters
 * @param char1 First character
 * @param char2 Second character
 * @param characters All characters map
 * @returns The common ancestor and depths, or null if no common ancestor found
 */
function findClosestCommonAncestor(
  char1: CharacterType,
  char2: CharacterType,
  characters: CharactersType
): { ancestor: string; depth1: number; depth2: number } | null {
  const chain1 = buildSoundChain(char1, characters);
  const chain2 = buildSoundChain(char2, characters);

  // Check if char2 itself appears in chain1
  for (let i = 0; i < chain1.length; i++) {
    if (chain1[i] === char2.traditional) {
      return {
        ancestor: char2.traditional,
        depth1: i + 1, // depth starts at 1
        depth2: 0, // char2 IS the ancestor, so depth is 0
      };
    }
  }

  // Check if char1 itself appears in chain2
  for (let i = 0; i < chain2.length; i++) {
    if (chain2[i] === char1.traditional) {
      return {
        ancestor: char1.traditional,
        depth1: 0, // char1 IS the ancestor, so depth is 0
        depth2: i + 1, // depth starts at 1
      };
    }
  }

  // Create a map of character -> depth for chain2
  const chain2Map = new Map<string, number>();
  chain2.forEach((char, index) => {
    chain2Map.set(char, index + 1); // depth starts at 1
  });

  // Find the first character in chain1 that appears in chain2
  for (let i = 0; i < chain1.length; i++) {
    const depth2 = chain2Map.get(chain1[i]);
    if (depth2 !== undefined) {
      return {
        ancestor: chain1[i],
        depth1: i + 1, // depth starts at 1
        depth2,
      };
    }
  }

  return null;
}

function getSoundRelationship(
  char1: CharacterType,
  char2: CharacterType,
  characters: CharactersType
): SoundRelationship {
  // Check if char1 is the sound component of char2
  if (char2.soundComponentCharacter === char1.traditional) {
    return { type: "char1_is_sound_of_char2" };
  }

  // Check if char2 is the sound component of char1
  if (char1.soundComponentCharacter === char2.traditional) {
    return { type: "char2_is_sound_of_char1" };
  }

  // Check if they share the same sound component
  if (
    char1.soundComponentCharacter &&
    char2.soundComponentCharacter &&
    char1.soundComponentCharacter === char2.soundComponentCharacter
  ) {
    return {
      type: "shared_sound_component",
      component: char1.soundComponentCharacter,
    };
  }

  // Check for a common ancestor in the sound component chain
  const commonAncestor = findClosestCommonAncestor(char1, char2, characters);
  if (commonAncestor) {
    return {
      type: "common_ancestor",
      ancestor: commonAncestor.ancestor,
      depth1: commonAncestor.depth1,
      depth2: commonAncestor.depth2,
    };
  }

  return { type: "none" };
}

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
        const soundRelationship = getSoundRelationship(char1, char2, characters);
        pairs.push({
          char1,
          char2,
          sharedProps,
          sharedPropsCount: sharedProps.length,
          soundRelationship
        });
      }
    }
  }

  // Sort by number of shared props (descending)
  pairs.sort((a, b) => b.sharedPropsCount - a.sharedPropsCount);

  return pairs;
}
