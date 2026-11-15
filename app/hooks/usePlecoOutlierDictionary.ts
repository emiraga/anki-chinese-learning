import { useAsync } from "react-async-hook";
import type {
  PlecoOutlierEntry,
  PlecoOutlierIndex,
  PlecoOutlierTraditionalIndex,
} from "~/types/pleco_outlier_dictionary";
import { fetchJson } from "~/utils/fetch_json";

export const PLECO_OUTLIER_DIR = "/data/pleco";

/** Converts between traditional characters and a dictionary's script. */
export interface PlecoScriptForms {
  /** Forms of a traditional character in the dictionary's script */
  fromTraditional: (char: string) => string[];
  /** Traditional forms of a character in the dictionary's script */
  toTraditional: (char: string) => string[];
}

/** One of the Pleco Outlier dictionaries (traditional or simplified). */
export interface PlecoDictionary {
  /** Id (and URL hash) of the dictionary's tab on the character page */
  tab: string;
  label: string;
  entriesDir: string;
  pagesDir: string;
  pngsDir: string;
  /** Sound/semantic series JSON, one file per character in the dictionary's script */
  seriesDir: string;
  /** Loads the map from a traditional character to its entry ids */
  loadIndex: () => Promise<Map<string, number[]>>;
  loadScriptForms: () => Promise<PlecoScriptForms>;
}

/** Loads an index once and shares it by all callers; retries after failure. */
function cached<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) {
      promise = load();
      promise.catch(() => {
        promise = null;
      });
    }
    return promise;
  };
}

/**
 * Character a headword belongs to: component entries such as "舌(𠯑)" belong
 * to the character before the parenthesis.
 */
function headwordCharacter(headword: string): string {
  const paren = headword.indexOf("(");
  return paren > 0 ? headword.substring(0, paren) : headword;
}

function addTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const values = map.get(key);
  if (!values) map.set(key, [value]);
  else if (!values.includes(value)) values.push(value);
}

const IDENTITY_SCRIPT_FORMS: PlecoScriptForms = {
  fromTraditional: (char) => [char],
  toTraditional: (char) => [char],
};

const TC_DIR = `${PLECO_OUTLIER_DIR}/tc_dictionary_entries_json`;
const SC_DIR = `${PLECO_OUTLIER_DIR}/sc_dictionary_entries_json`;

/** Traditional dictionary, indexed by the headwords of its entries. */
export const PLECO_TC_DICTIONARY: PlecoDictionary = {
  tab: "plecooutlier",
  label: "Pleco Outlier",
  entriesDir: TC_DIR,
  pagesDir: `${PLECO_OUTLIER_DIR}/tc_pages_html`,
  pngsDir: `${PLECO_OUTLIER_DIR}/tc_pngs`,
  loadIndex: cached(async () => {
    const index = await fetchJson<PlecoOutlierIndex>(`${TC_DIR}/index.json`);
    const byHeadword = new Map<string, number[]>();
    for (const { id, headword } of index.entries) {
      if (!headword) continue;
      addTo(byHeadword, headword, id);
      addTo(byHeadword, headwordCharacter(headword), id);
    }
    return byHeadword;
  }),
  seriesDir: `${PLECO_OUTLIER_DIR}/outlier_series_tc`,
  loadScriptForms: () => Promise.resolve(IDENTITY_SCRIPT_FORMS),
};

/**
 * Simplified dictionary; its headwords are simplified, so it is indexed by
 * traditional_index.json, which links traditional forms to its entries.
 */
export const PLECO_SC_DICTIONARY: PlecoDictionary = {
  tab: "plecoscoutlier",
  label: "Pleco SC Outlier",
  entriesDir: SC_DIR,
  pagesDir: `${PLECO_OUTLIER_DIR}/sc_pages_html`,
  pngsDir: `${PLECO_OUTLIER_DIR}/sc_pngs`,
  loadIndex: cached(async () => {
    const index = await fetchJson<PlecoOutlierTraditionalIndex>(
      `${SC_DIR}/traditional_index.json`,
    );
    return new Map(Object.entries(index));
  }),
  seriesDir: `${PLECO_OUTLIER_DIR}/outlier_series_sc`,
  // Links simplified headwords to their traditional forms through the entries
  // they share, e.g. 發 and 髮 -> entry 1261 -> 发.
  loadScriptForms: cached(async () => {
    const [index, traditionalIndex] = await Promise.all([
      fetchJson<PlecoOutlierIndex>(`${SC_DIR}/index.json`),
      fetchJson<PlecoOutlierTraditionalIndex>(
        `${SC_DIR}/traditional_index.json`,
      ),
    ]);
    const simplifiedById = new Map<number, string>();
    for (const { id, headword } of index.entries) {
      if (headword) simplifiedById.set(id, headwordCharacter(headword));
    }
    const toSimplified = new Map<string, string[]>();
    const toTraditional = new Map<string, string[]>();
    for (const [traditional, ids] of Object.entries(traditionalIndex)) {
      for (const id of ids) {
        const simplified = simplifiedById.get(id);
        if (!simplified) continue;
        addTo(toSimplified, traditional, simplified);
        addTo(toTraditional, simplified, traditional);
      }
    }
    // Characters without an entry are assumed to be the same in both scripts.
    return {
      fromTraditional: (char) => toSimplified.get(char) ?? [char],
      toTraditional: (char) => toTraditional.get(char) ?? [char],
    };
  }),
};

interface UsePlecoOutlierDictionaryResult {
  /** All entries for the character (some characters have several). */
  entries: PlecoOutlierEntry[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load the Pleco Outlier Dictionary entries of a character
 * @param char - The traditional Chinese character to load (e.g., "神", "口")
 * @param dictionary - The dictionary to load the entries from
 * @returns Object with the entries, loading state, and error state
 */
export function usePlecoOutlierDictionary(
  char: string,
  dictionary: PlecoDictionary,
): UsePlecoOutlierDictionaryResult {
  const fetchEntries = async (
    character: string,
    dict: PlecoDictionary,
  ): Promise<PlecoOutlierEntry[]> => {
    if (!character) {
      throw new Error("No character provided");
    }
    const ids = (await dict.loadIndex()).get(character) ?? [];
    return Promise.all(
      ids.map((id) =>
        fetchJson<PlecoOutlierEntry>(`${dict.entriesDir}/${id}.json`),
      ),
    );
  };

  const { result, loading, error } = useAsync(fetchEntries, [char, dictionary]);

  return {
    entries: result ?? [],
    loading,
    error: error?.message ?? null,
  };
}
