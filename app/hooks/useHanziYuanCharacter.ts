import { useAsync } from "react-async-hook";
import type { HanziYuanCharacter } from "~/types/hanziyuan_character";

interface UseHanziYuanCharacterResult {
  character: HanziYuanCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load HanziYuan character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useHanziYuanCharacter(char: string): UseHanziYuanCharacterResult {
  const fetchCharacter = async (character: string): Promise<HanziYuanCharacter> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/hanziyuan/converted/${character}.json`);
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
