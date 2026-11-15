import type { PlecoOutlier } from "~/types/pleco_outlier";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load Pleco Outlier series character data from JSON file
 * @param char - The Chinese character to load (e.g., "神", "口")
 * @returns Object with character data, loading state, and error state
 */
export function usePlecoOutlier(char: string): UseCharacterJsonResult<PlecoOutlier> {
  return useCharacterJson<PlecoOutlier>("/data/pleco/outlier_series", char);
}
