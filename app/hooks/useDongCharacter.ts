import type { DongCharacter } from "~/types/dong_character";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load a Dong Chinese character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useDongCharacter(char: string): UseCharacterJsonResult<DongCharacter> {
  return useCharacterJson<DongCharacter>("/data/dong", char);
}
