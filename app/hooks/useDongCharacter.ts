import { useAsync } from "react-async-hook";
import type { DongCharacter } from "~/types/dong_character";

interface UseDongCharacterResult {
  character: DongCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load a Dong Chinese character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useDongCharacter(char: string): UseDongCharacterResult {
  const fetchCharacter = async (character: string): Promise<DongCharacter> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/dong/${character}.json`);
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
