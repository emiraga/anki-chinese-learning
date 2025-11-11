import type { CharacterType } from "~/data/characters";
import {
  ACTOR_TAGS_MAP,
  LOCATION_TAGS_MAP,
  PLACE_TAGS_MAP,
  REVERSE_FULL_MAP,
} from "~/data/pinyin_table";

export interface CharacterTagsResult {
  actorTag: string;
  placeTag: string;
  toneTag: string;
  allTags: string[];
  missingTags: string[];
}

/**
 * Generates mnemonic-based tags (actor, place, tone) for a character based on its pinyin.
 * Also determines which tags are missing from the character's current tags.
 *
 * @param char - The character to generate tags for
 * @returns Object containing the expected tags and missing tags
 * @throws Error if the character's pinyin syllable is not found in REVERSE_FULL_MAP
 */
export function getCharacterMnemonicTags(
  char: CharacterType,
): CharacterTagsResult {
  if (!char.pinyin[0]?.sylable) {
    throw new Error(
      `Character ${char.traditional} has no pinyin syllable defined`,
    );
  }

  const pinyinMapping = REVERSE_FULL_MAP[char.pinyin[0].sylable];
  if (!pinyinMapping) {
    throw new Error(
      `REVERSE_FULL_MAP does not contain syllable: ${char.pinyin[0].sylable}`,
    );
  }

  const { initial, final } = pinyinMapping;
  const tone = char.pinyin[0].tone;

  const actorTag = ACTOR_TAGS_MAP[initial];
  const placeTag = PLACE_TAGS_MAP[final];
  const toneTag = LOCATION_TAGS_MAP[tone];

  if (!actorTag) {
    throw new Error(`ACTOR_TAGS_MAP does not contain initial: ${initial}`);
  }
  if (!placeTag) {
    throw new Error(`PLACE_TAGS_MAP does not contain final: ${final}`);
  }
  if (!toneTag) {
    throw new Error(`LOCATION_TAGS_MAP does not contain tone: ${tone}`);
  }

  const allTags = [actorTag, placeTag, toneTag];
  const missingTags: string[] = [];

  if (!char.tags.includes(actorTag)) {
    missingTags.push(actorTag);
  }
  if (!char.tags.includes(placeTag)) {
    missingTags.push(placeTag);
  }
  if (!char.tags.includes(toneTag)) {
    missingTags.push(toneTag);
  }

  return {
    actorTag,
    placeTag,
    toneTag,
    allTags,
    missingTags,
  };
}

/**
 * Checks if a character should have mnemonic tags based on whether it has sound.
 *
 * @param char - The character to check
 * @returns true if the character should have mnemonic tags
 */
export function shouldHaveMnemonicTags(char: CharacterType): boolean {
  return char.withSound === true && char.pinyin[0]?.sylable !== undefined;
}
