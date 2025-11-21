import { useAsync } from "react-async-hook";
import type { HackChineseOutlierCharacter } from "~/types/hackchinese_outlier";

interface UseHackChineseOutlierResult {
  character: HackChineseOutlierCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load HackChinese Outlier character data from JSON file
 * @param char - The Chinese character to load (e.g., "串", "乘")
 * @returns Object with character data, loading state, and error state
 */
export function useHackChineseOutlier(char: string): UseHackChineseOutlierResult {
  const fetchCharacter = async (character: string): Promise<HackChineseOutlierCharacter> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/hackchinese/outlier/${character}.json`);
    if (!res.ok) {
      throw new Error(`Failed to load character "${character}": ${res.statusText}`);
    }
    return res.json();
  };

  const { result, loading, error } = useAsync(fetchCharacter, [char]);

  return {
    character: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
