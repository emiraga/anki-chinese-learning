import type { RtegaCharacter } from "~/types/rtega_character";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load Rtega character data from JSON file
 * @param char - The Chinese character to load (e.g., "串", "乘")
 * @returns Object with character data, loading state, and error state
 */
export function useRtegaCharacter(char: string): UseCharacterJsonResult<RtegaCharacter> {
  return useCharacterJson<RtegaCharacter>("/data/rtega", char);
}
