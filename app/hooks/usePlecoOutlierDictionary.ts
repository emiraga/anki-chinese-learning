import { useAsync } from "react-async-hook";
import type {
  PlecoOutlierEntry,
  PlecoOutlierIndex,
} from "~/types/pleco_outlier_dictionary";
import { fetchJson } from "~/utils/fetch_json";

export const PLECO_OUTLIER_DIR = "/data/pleco";
const ENTRIES_DIR = `${PLECO_OUTLIER_DIR}/tc_dictionary_entries_json`;

interface UsePlecoOutlierDictionaryResult {
  /** All entries for the character (some characters have several). */
  entries: PlecoOutlierEntry[];
  loading: boolean;
  error: string | null;
}

// headword -> entry ids, loaded once and shared by all hook instances.
let headwordIndexPromise: Promise<Map<string, number[]>> | null = null;

function loadHeadwordIndex(): Promise<Map<string, number[]>> {
  if (!headwordIndexPromise) {
    headwordIndexPromise = fetchJson<PlecoOutlierIndex>(
      `${ENTRIES_DIR}/index.json`,
    ).then((index) => {
      const byHeadword = new Map<string, number[]>();
      const add = (key: string, id: number) => {
        const ids = byHeadword.get(key);
        if (ids) ids.push(id);
        else byHeadword.set(key, [id]);
      };
      for (const { id, headword } of index.entries) {
        if (!headword) continue;
        add(headword, id);
        // Component entries such as "舌(𠯑)" belong to the character before
        // the parenthesis.
        const paren = headword.indexOf("(");
        if (paren > 0) add(headword.substring(0, paren), id);
      }
      return byHeadword;
    });
    // Allow a retry after a failed load.
    headwordIndexPromise.catch(() => {
      headwordIndexPromise = null;
    });
  }
  return headwordIndexPromise;
}

/**
 * Custom hook to load the Pleco Outlier Dictionary entries of a character
 * @param char - The Chinese character to load (e.g., "神", "口")
 * @returns Object with the entries, loading state, and error state
 */
export function usePlecoOutlierDictionary(
  char: string,
): UsePlecoOutlierDictionaryResult {
  const fetchEntries = async (
    character: string,
  ): Promise<PlecoOutlierEntry[]> => {
    if (!character) {
      throw new Error("No character provided");
    }
    const ids = (await loadHeadwordIndex()).get(character) ?? [];
    return Promise.all(
      ids.map((id) =>
        fetchJson<PlecoOutlierEntry>(`${ENTRIES_DIR}/${id}.json`),
      ),
    );
  };

  const { result, loading, error } = useAsync(fetchEntries, [char]);

  return {
    entries: result ?? [],
    loading,
    error: error?.message ?? null,
  };
}
