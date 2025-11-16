import { useAsync } from "react-async-hook";
import type { YellowBridgeIndexes } from "~/types/yellowbridge_character";

interface UseYellowBridgeIndexesResult {
  indexes: YellowBridgeIndexes | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load YellowBridge aggregated indexes from processed.json
 * This includes sounds_component_in and other indexes
 * @returns Object with indexes, loading state, and error state
 */
export function useYellowBridgeIndexes(): UseYellowBridgeIndexesResult {
  const fetchIndexes = async (): Promise<YellowBridgeIndexes> => {
    const res = await fetch("/data/yellowbridge/processed.json");
    if (!res.ok) {
      throw new Error(`Failed to load YellowBridge indexes: ${res.statusText}`);
    }
    return res.json();
  };

  const { result, loading, error } = useAsync(fetchIndexes, []);

  return {
    indexes: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
