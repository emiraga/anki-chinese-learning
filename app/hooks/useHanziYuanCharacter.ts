import type { HanziYuanCharacter } from "~/types/hanziyuan_character";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load HanziYuan character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useHanziYuanCharacter(char: string): UseCharacterJsonResult<HanziYuanCharacter> {
  return useCharacterJson<HanziYuanCharacter>("/data/hanziyuan/converted", char);
}
