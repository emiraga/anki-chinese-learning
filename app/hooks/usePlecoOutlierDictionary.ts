import { useAsync } from "react-async-hook";
import type { PlecoOutlierDictionary } from "~/types/pleco_outlier";

interface UsePlecoOutlierDictionaryResult {
  dictionary: PlecoOutlierDictionary | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load Pleco Outlier Dictionary data from JSON file
 * @param char - The Chinese character to load (e.g., "神", "口")
 * @returns Object with dictionary data, loading state, and error state
 */
export function usePlecoOutlierDictionary(
  char: string
): UsePlecoOutlierDictionaryResult {
  const fetchDictionary = async (
    character: string
  ): Promise<PlecoOutlierDictionary> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const res = await fetch(`/data/pleco/outlier_dictionary/${character}.json`);
    if (!res.ok) {
      throw new Error(
        `Failed to load dictionary "${character}": ${res.statusText}`
      );
    }
    return res.json();
  };

  const { result, loading, error } = useAsync(fetchDictionary, [char]);

  return {
    dictionary: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
