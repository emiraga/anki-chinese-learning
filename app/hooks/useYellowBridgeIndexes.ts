import { useAsync } from "react-async-hook";
import type { YellowBridgeIndexes } from "~/types/yellowbridge_character";
import { fetchJson } from "~/utils/fetch_json";

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
  const fetchIndexes = (): Promise<YellowBridgeIndexes> =>
    fetchJson<YellowBridgeIndexes>("/data/yellowbridge/processed.json");

  const { result, loading, error } = useAsync(fetchIndexes, []);

  return {
    indexes: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
