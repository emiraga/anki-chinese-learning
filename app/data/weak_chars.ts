import type { CharsToPhrasesPinyin } from "./phrases";
import type { CharactersType } from "./characters";

export interface WeakCharacterInfo {
  char: string;
  totalPhraseCount: number;
  pronunciationCount: number;
}

export function getWeakCharacters(
  charPhrasesPinyin: CharsToPhrasesPinyin,
  characters: CharactersType,
  limit: number = 20
): WeakCharacterInfo[] {
  const weakChars: WeakCharacterInfo[] = [];

  for (const [char, pronunciations] of Object.entries(charPhrasesPinyin)) {
    if (!characters[char]) continue;

    let totalPhraseCount = 0;
    let pronunciationCount = 0;

    for (const pronunciation of Object.values(pronunciations)) {
      if (pronunciation.count && !pronunciation.ignoredFifthTone) {
        totalPhraseCount += pronunciation.count;
        pronunciationCount++;
      }
    }

    if (totalPhraseCount > 0) {
      weakChars.push({
        char,
        totalPhraseCount,
        pronunciationCount,
      });
    }
  }

  return weakChars
    .sort((a, b) => a.totalPhraseCount - b.totalPhraseCount)
    .slice(0, limit);
}