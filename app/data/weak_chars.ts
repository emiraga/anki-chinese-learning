import type { PhraseType } from "./phrases";
import type { CharactersType } from "./characters";

export interface WeakCharacterInfo {
  char: string;
  totalPhraseCount: number;
}

export function getWeakCharacters(
  phrases: PhraseType[],
  characters: CharactersType,
  limit: number = 20
): WeakCharacterInfo[] {
  const count: { [key: string]: number } = {};
  for (const [c] of Object.entries(characters).filter(([, v]) => v.withSound)) {
    count[c] = 0;
  }
  for (const phrase of phrases) {
    for (const c of [...phrase.traditional]) {
      if (count[c] !== undefined) {
        count[c]++;
      }
    }
  }

  const weakChars: WeakCharacterInfo[] = Object.entries(count).map(
    ([char, totalPhraseCount]) => ({ char, totalPhraseCount })
  );

  return weakChars
    .sort((a, b) => a.totalPhraseCount - b.totalPhraseCount)
    .slice(0, limit);
}
