import { useMemo } from "react";
import { parsePOSString } from "~/data/pos";
import type { PhraseType } from "~/data/phrases";

/** Groups phrases by each POS code listed in their POS field. */
export function usePhrasesByPos(
  phrases: PhraseType[],
): Map<string, PhraseType[]> {
  return useMemo(() => {
    const byPos = new Map<string, PhraseType[]>();
    for (const phrase of phrases) {
      for (const code of new Set(parsePOSString(phrase.partOfSpeech ?? ""))) {
        const list = byPos.get(code) ?? [];
        list.push(phrase);
        byPos.set(code, list);
      }
    }
    return byPos;
  }, [phrases]);
}
