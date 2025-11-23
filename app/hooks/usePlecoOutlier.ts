import { useAsync } from "react-async-hook";
import type { PlecoOutlier } from "~/types/pleco_outlier";

interface UsePlecoOutlierResult {
  character: PlecoOutlier | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load Pleco Outlier dictionary data from JSON file
 * @param char - The Chinese character to load (e.g., "神", "口")
 * @returns Object with character data, loading state, and error state
 */
export function usePlecoOutlier(char: string): UsePlecoOutlierResult {
  const fetchCharacter = async (character: string): Promise<PlecoOutlier> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/pleco/outlier_series/${character}.json`);
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
