import { useAsync } from "react-async-hook";
import { fetchJson } from "~/utils/fetch_json";

export interface UseCharacterJsonResult<T> {
  character: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the per-character JSON file `${directory}/${char}.json`.
 * @param directory - URL directory of the data source, e.g. "/data/dong"
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useCharacterJson<T>(
  directory: string,
  char: string,
): UseCharacterJsonResult<T> {
  const fetchCharacter = async (
    dir: string,
    character: string,
  ): Promise<T> => {
    if (!character) {
      throw new Error("No character provided");
    }
    return fetchJson<T>(`${dir}/${character}.json`);
  };

  const { result, loading, error } = useAsync(fetchCharacter, [
    directory,
    char,
  ]);

  return {
    character: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
