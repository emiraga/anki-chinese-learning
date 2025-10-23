import { useAsync } from "react-async-hook";
import type { RtegaCharacter } from "~/types/rtega_character";

interface UseRtegaCharacterResult {
  character: RtegaCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load a Rtega character data from JSON file
 * @param char - The Chinese character to load (e.g., "串", "乘")
 * @returns Object with character data, loading state, and error state
 */
export function useRtegaCharacter(char: string): UseRtegaCharacterResult {
  const fetchCharacter = async (character: string): Promise<RtegaCharacter> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/rtega/${character}.json`);
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
