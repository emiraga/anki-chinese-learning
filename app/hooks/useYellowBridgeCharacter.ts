import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import {
  useCharacterJson,
  type UseCharacterJsonResult,
} from "~/hooks/useCharacterJson";

/**
 * Custom hook to load YellowBridge character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useYellowBridgeCharacter(char: string): UseCharacterJsonResult<YellowBridgeCharacter> {
  return useCharacterJson<YellowBridgeCharacter>("/data/yellowbridge/info", char);
}
