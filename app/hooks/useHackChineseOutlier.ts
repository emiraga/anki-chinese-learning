import type { HackChineseOutlierCharacter } from "~/types/hackchinese_outlier";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load HackChinese Outlier character data from JSON file
 * @param char - The Chinese character to load (e.g., "串", "乘")
 * @returns Object with character data, loading state, and error state
 */
export function useHackChineseOutlier(char: string): UseCharacterJsonResult<HackChineseOutlierCharacter> {
  return useCharacterJson<HackChineseOutlierCharacter>("/data/hackchinese/outlier", char);
}
