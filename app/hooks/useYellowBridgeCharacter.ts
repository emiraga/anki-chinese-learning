import { useAsync } from "react-async-hook";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";

interface UseYellowBridgeCharacterResult {
  character: YellowBridgeCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load YellowBridge character data from processed JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useYellowBridgeCharacter(char: string): UseYellowBridgeCharacterResult {
  const fetchCharacter = async (character: string): Promise<YellowBridgeCharacter> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/yellowbridge/info/${character}.json`);
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
