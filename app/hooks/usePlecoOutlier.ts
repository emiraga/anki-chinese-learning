import { useAsync } from "react-async-hook";
import type { Character, PlecoOutlier } from "~/types/pleco_outlier";
import type {
  PlecoDictionary,
  PlecoScriptForms,
} from "~/hooks/usePlecoOutlierDictionary";
import { fetchJsonOrNull } from "~/utils/fetch_json";

interface UsePlecoOutlierResult {
  character: PlecoOutlier | null;
  loading: boolean;
  error: string | null;
}

/**
 * Traditional form of a character in the dictionary's script. When there are
 * several (发 -> 發, 髮), a form identical to the character wins, then the first.
 */
function traditionalOf(char: string, forms: PlecoScriptForms): string {
  const candidates = forms.toTraditional(char);
  return candidates.includes(char) ? char : candidates[0];
}

function toTraditionalCharacters(
  characters: Character[] | undefined,
  forms: PlecoScriptForms,
): Character[] | undefined {
  return characters?.map((c) => {
    const traditional = traditionalOf(c.traditional, forms);
    return traditional === c.traditional
      ? c
      : { ...c, traditional, simplified: c.traditional };
  });
}

/**
 * Rewrites series data whose characters are in the dictionary's script (stored
 * in the `traditional` field) so that `traditional` holds the traditional form
 * and `simplified` the dictionary's form, as the rest of the app expects.
 */
function toTraditionalSeries(
  data: PlecoOutlier,
  traditional: string,
  forms: PlecoScriptForms,
): PlecoOutlier {
  const convert = <T extends { characters?: Character[] }>(section?: T) =>
    section && {
      ...section,
      characters: toTraditionalCharacters(section.characters, forms),
    };
  return {
    ...data,
    traditional,
    simplified: data.traditional !== traditional ? data.traditional : undefined,
    references: data.references?.map((ref) => ({
      ...ref,
      char: traditionalOf(ref.char, forms),
    })),
    sound_series: convert(data.sound_series),
    semantic_series: convert(data.semantic_series),
    empty_component: convert(data.empty_component),
    radical: convert(data.radical),
  };
}

/**
 * Custom hook to load Pleco Outlier series data (sound/semantic series etc.)
 * @param char - The traditional Chinese character to load (e.g., "神", "口")
 * @param dictionary - The dictionary (traditional or simplified) whose series to load
 * @returns Object with character data, loading state, and error state
 */
export function usePlecoOutlier(
  char: string,
  dictionary: PlecoDictionary,
): UsePlecoOutlierResult {
  const fetchCharacter = async (
    character: string,
    dict: PlecoDictionary,
  ): Promise<PlecoOutlier> => {
    if (!character) {
      throw new Error("No character provided");
    }

    const forms = await dict.loadScriptForms();
    // A traditional character can have several forms in the dictionary's
    // script; use the first one that has series data. Only a missing file
    // moves on to the next form, any other failure propagates.
    const triedForms = forms.fromTraditional(character);
    for (const form of triedForms) {
      const data = await fetchJsonOrNull<PlecoOutlier>(
        `${dict.seriesDir}/${form}.json`,
      );
      if (data !== null) {
        return toTraditionalSeries(data, character, forms);
      }
    }
    throw new Error(
      `No series data in "${dict.seriesDir}" for ${triedForms.join(", ")}`,
    );
  };

  const { result, loading, error } = useAsync(fetchCharacter, [
    char,
    dictionary,
  ]);

  return {
    character: result ?? null,
    loading,
    error: error?.message ?? null,
  };
}
