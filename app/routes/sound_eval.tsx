import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";
import type { DongCharacter } from "~/types/dong_character";
import MainFrame from "~/toolbar/frame";
import { useEffect, useState, useMemo } from "react";
import { CharLink } from "~/components/CharCard";
import anki from "~/apis/anki";

interface SoundComponentCandidate {
  character: string;
  pinyin: string;
  score: number;
  depth: number; // Track recursion depth
  componentType: string[]; // Type of component (sound, meaning, etc.)
}

// Helper to extract all components from a DongCharacter (non-recursive, single level)
function extractAllComponents(
  dongChar: DongCharacter | null,
  depth: number,
): Array<{ character: string; pinyin: string; depth: number; componentType: string[] }> {
  if (!dongChar) return [];

  const allComponents = dongChar.components || [];

  const results: Array<{ character: string; pinyin: string; depth: number; componentType: string[] }> =
    [];

  for (const comp of allComponents) {
    const componentChar = comp.character;
    const componentPinyin = getPrimaryPinyin(componentChar, dongChar);

    if (componentPinyin) {
      results.push({
        character: componentChar,
        pinyin: componentPinyin,
        depth,
        componentType: comp.type,
      });
    }
  }

  return results;
}

function getPrimaryPinyin(char: string, dongChar: DongCharacter): string {
  // First, check if this is the main character
  if (
    char === dongChar.char &&
    dongChar.pinyinFrequencies &&
    dongChar.pinyinFrequencies.length > 0
  ) {
    return dongChar.pinyinFrequencies[0].pinyin;
  }

  // Try to get pinyin from the chars array (component character data)
  const componentChar = dongChar.chars?.find((c) => c.char === char);
  if (
    componentChar?.pinyinFrequencies &&
    componentChar.pinyinFrequencies.length > 0
  ) {
    return componentChar.pinyinFrequencies[0].pinyin;
  }

  // Try to get from oldPronunciations
  if (
    componentChar?.oldPronunciations &&
    componentChar.oldPronunciations.length > 0
  ) {
    return componentChar.oldPronunciations[0].pinyin;
  }

  // Try to get from words array
  const componentWord = dongChar.words?.find(
    (w) => w.simp === char || w.trad === char,
  );
  if (componentWord?.items && componentWord.items.length > 0) {
    return componentWord.items[0].pinyin;
  }

  // Return empty if we can't determine
  return "";
}

interface CharacterRowProps {
  character: string;
  charPinyin: string;
  soundComponentChar?: string;
  candidates: SoundComponentCandidate[];
  isLoadingCandidates: boolean;
  ankiId: number | null;
  onSoundComponentUpdate: (character: string) => void;
}

// Fetch DongCharacter data directly (inlined hook implementation)
async function fetchDongCharacter(char: string): Promise<DongCharacter | null> {
  if (!char) return null;

  try {
    const res = await fetch(`/data/dong/${char}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Recursively gather all components by fetching nested characters
async function getAllComponentsRecursive(
  dongChar: DongCharacter,
  charPinyin: string,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<SoundComponentCandidate[]> {
  visited.add(dongChar.char);
  const allCandidates: SoundComponentCandidate[] = [];

  // Get immediate components (all types)
  const immediate = extractAllComponents(dongChar, depth);

  // Process each component
  for (const comp of immediate) {
    // Skip if already visited (prevents self-reference and cycles)
    if (visited.has(comp.character)) {
      continue;
    }

    allCandidates.push({
      character: comp.character,
      pinyin: comp.pinyin,
      depth: comp.depth,
      componentType: comp.componentType,
      score: scoreSoundSimilarity(charPinyin, comp.pinyin),
    });

    // Recursively fetch and process nested components
    if (depth < 5) {
      const nestedChar = await fetchDongCharacter(comp.character);
      if (nestedChar) {
        const nestedCandidates = await getAllComponentsRecursive(
          nestedChar,
          charPinyin,
          depth + 1,
          visited,
        );
        allCandidates.push(...nestedCandidates);
      }
    }
  }

  return allCandidates;
}

// Component type configuration (matching DongCharacterDisplay.tsx)
const COMPONENT_TYPE_CONFIG = {
  deleted: {
    borderColor: "border-gray-300",
    bgColor: "bg-gray-50",
    badgeColor: "bg-gray-100 text-gray-700",
  },
  sound: {
    borderColor: "border-blue-300",
    bgColor: "bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  iconic: {
    borderColor: "border-green-300",
    bgColor: "bg-green-50",
    badgeColor: "bg-green-100 text-green-700",
  },
  meaning: {
    borderColor: "border-red-300",
    bgColor: "bg-red-50",
    badgeColor: "bg-red-100 text-red-700",
  },
  remnant: {
    borderColor: "border-purple-300",
    bgColor: "bg-purple-50",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  distinguishing: {
    borderColor: "border-cyan-300",
    bgColor: "bg-cyan-50",
    badgeColor: "bg-cyan-100 text-cyan-700",
  },
  simplified: {
    borderColor: "border-pink-300",
    bgColor: "bg-pink-50",
    badgeColor: "bg-pink-100 text-pink-700",
  },
} as const;

const DEFAULT_TYPE_CONFIG = {
  borderColor: "border-gray-300",
  bgColor: "bg-gray-50",
  badgeColor: "bg-gray-100 text-gray-700",
};

// Helper to get component type styling
function getComponentTypeStyle(componentType: string[]): {
  borderColor: string;
  bgColor: string;
  badgeColor: string;
} {
  // Check for each type in the component type array
  for (const type of componentType) {
    const typeLower = type.toLowerCase();
    for (const [key, config] of Object.entries(COMPONENT_TYPE_CONFIG)) {
      if (typeLower.includes(key)) {
        return config;
      }
    }
  }

  return DEFAULT_TYPE_CONFIG;
}

interface CharacterData {
  character: string;
  charPinyin: string;
  soundComponentChar?: string;
  candidates: SoundComponentCandidate[];
  maxScore: number;
  isLoadingCandidates: boolean;
  ankiId: number | null;
}

function CharacterRow({
  character,
  charPinyin,
  soundComponentChar,
  candidates,
  isLoadingCandidates,
  ankiId,
  onSoundComponentUpdate,
}: CharacterRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { character: soundCompDong, loading: soundCompLoading } =
    useDongCharacter(soundComponentChar || "");

  const soundCompPinyin = soundCompDong?.pinyinFrequencies?.[0]?.pinyin || "";
  const soundCompScore = soundCompPinyin
    ? scoreSoundSimilarity(charPinyin, soundCompPinyin)
    : null;

  const setSoundComponent = async (candidateChar: string) => {
    if (!ankiId) {
      alert("No Anki note found for this character");
      return;
    }

    setIsUpdating(true);
    try {
      await anki.note.updateNoteFields({
        note: {
          id: ankiId,
          fields: { "Sound component character": candidateChar },
        },
      });
      onSoundComponentUpdate(character);
    } catch (error) {
      alert(`Failed to update sound component: ${error}`);
      setIsUpdating(false);
    }
  };

  // Check if any candidate has a higher score than the current Anki sound component
  const hasBetterCandidate =
    soundCompScore !== null &&
    candidates.some((candidate) => candidate.score > soundCompScore);

  // Check if Anki sound component matches the highest-scoring candidate
  const topCandidate = candidates.length > 0 ? candidates[0] : null;
  const ankiMatchesTopCandidate =
    soundComponentChar &&
    topCandidate &&
    soundComponentChar === topCandidate.character;

  // Don't render rows with no sound components found
  if (!isLoadingCandidates && candidates.length === 0 && !soundComponentChar) {
    return null;
  }

  // Don't render rows where Anki sound component matches the top candidate
  if (!isLoadingCandidates && ankiMatchesTopCandidate) {
    return null;
  }

  return (
    <tr
      className={`border-b border-gray-200 hover:bg-gray-50 ${
        hasBetterCandidate ? "bg-yellow-50" : ""
      }`}
    >
      <td className="px-4 py-2 font-bold text-lg">
        <CharLink traditional={character} /> {charPinyin}
      </td>
      {/*<td className="px-4 py-2">{charPinyin}</td>*/}
      <td className="px-4 py-2 font-bold text-lg">
        {soundComponentChar ? (
          <CharLink traditional={soundComponentChar} />
        ) : (
          <span className="text-gray-400">-</span>
        )}{" "}
        {/*</td>
      <td className="px-4 py-2">*/}
        {soundCompLoading ? (
          <span className="text-gray-400">Loading...</span>
        ) : soundCompPinyin ? (
          <>
            <span>{soundCompPinyin}</span>
            {soundCompScore !== null && (
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-semibold ${
                  soundCompScore >= 8
                    ? "bg-green-100 text-green-800"
                    : soundCompScore >= 6
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {soundCompScore.toFixed(1)}
              </span>
            )}
          </>
        ) : soundComponentChar ? (
          <span className="text-gray-400">No pinyin</span>
        ) : undefined}
      </td>
      <td className="px-4 py-2">
        {isLoadingCandidates ? (
          <span className="text-gray-400">Loading...</span>
        ) : candidates.length > 0 ? (
          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            {candidates.map((candidate, idx) => {
              const typeStyle = getComponentTypeStyle(candidate.componentType);
              return (
                <div
                  key={`${candidate.character}-${idx}`}
                  className={`inline-flex items-center gap-1 border ${typeStyle.borderColor} ${typeStyle.bgColor} rounded px-2 py-1`}
                >
                  <CharLink
                    traditional={candidate.character}
                    className="font-bold"
                  />
                  <span className="text-sm text-gray-600">
                    {candidate.pinyin}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      candidate.score >= 8
                        ? "bg-green-100 text-green-800"
                        : candidate.score >= 6
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {candidate.score.toFixed(1)}
                  </span>
                  <span
                    className={`text-xs px-1 py-0.5 rounded ${typeStyle.badgeColor}`}
                    title={`Component type: ${candidate.componentType.join(", ")}`}
                  >
                    {candidate.componentType[0]}
                  </span>
                  {candidate.depth > 0 && (
                    <span
                      className="text-xs text-gray-400"
                      title={`Recursion depth: ${candidate.depth}`}
                    >
                      (d{candidate.depth})
                    </span>
                  )}
                  <button
                    onClick={() => setSoundComponent(candidate.character)}
                    disabled={isUpdating || !ankiId}
                    className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    title="Set as sound component"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-gray-400">No sound components found</span>
        )}
      </td>
    </tr>
  );
}

export default function SoundEval() {
  const { characters } = useOutletContext<OutletContext>();

  // Filter characters that have pinyin
  const charsWithPinyin = useMemo(() => {
    return Object.values(characters).filter(
      (char): char is NonNullable<typeof char> => {
        return !!(char && char.pinyin.length > 0);
      },
    );
  }, [characters]);

  // State to hold all character data with computed candidates
  const [characterDataList, setCharacterDataList] = useState<CharacterData[]>(
    [],
  );
  const [isLoadingAll, setIsLoadingAll] = useState(true);

  const handleSoundComponentUpdate = (character: string) => {
    // Remove the character from the list
    setCharacterDataList((prev) => prev.filter((data) => data.character !== character));
  };

  // Compute candidates for all characters
  useEffect(() => {
    let cancelled = false;

    const loadAllCandidates = async () => {
      setIsLoadingAll(true);
      setCharacterDataList([]);

      const allData: CharacterData[] = [];

      // Process characters one at a time to show progressive updates
      for (const char of charsWithPinyin) {
        if (cancelled) {
          break;
        }

        const charPinyin = char.pinyin[0].pinyinAccented;
        const dongChar = await fetchDongCharacter(char.traditional);

        let candidates: SoundComponentCandidate[] = [];

        if (dongChar) {
          try {
            const allCandidates = await getAllComponentsRecursive(
              dongChar,
              charPinyin,
              0,
              new Set([char.traditional]),
            );
            // Sort by score descending
            allCandidates.sort((a, b) => b.score - a.score);
            candidates = allCandidates;
          } catch {
            // Error loading candidates
          }
        }

        const maxScore = candidates.length > 0 ? candidates[0].score : 0;

        allData.push({
          character: char.traditional,
          charPinyin,
          soundComponentChar: char.soundComponentCharacter,
          candidates,
          maxScore,
          isLoadingCandidates: false,
          ankiId: char.ankiId,
        });

        if (!cancelled) {
          // Sort by maxScore descending and update state
          const sortedData = [...allData].sort(
            (a, b) => b.maxScore - a.maxScore,
          );
          setCharacterDataList(sortedData);
        }
      }

      if (!cancelled) {
        setIsLoadingAll(false);
      }
    };

    loadAllCandidates();

    return () => {
      cancelled = true;
    };
  }, [charsWithPinyin]);

  // Filter out characters that should not be displayed
  const filteredCharacterData = characterDataList.filter((data) => {
    // Don't render rows with no sound components found
    if (data.candidates.length === 0 && !data.soundComponentChar) {
      return false;
    }

    // Don't render rows where Anki sound component matches the top candidate
    const topCandidate = data.candidates.length > 0 ? data.candidates[0] : null;
    const ankiMatchesTopCandidate =
      data.soundComponentChar &&
      topCandidate &&
      data.soundComponentChar === topCandidate.character;

    if (ankiMatchesTopCandidate) {
      return false;
    }

    return true;
  });

  return (
    <MainFrame>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Sound Component Evaluation</h1>

        <div className="mb-4 text-gray-600">
          <p>
            {isLoadingAll
              ? `Loading... ${characterDataList.length} / ${charsWithPinyin.length} characters processed`
              : `Showing ${filteredCharacterData.length} of ${charsWithPinyin.length} characters (sorted by max candidate score)`}
          </p>
          <p className="text-sm mt-1">
            Score:{" "}
            <span className="text-green-600 font-semibold">≥8 = Excellent</span>
            ,
            <span className="text-yellow-600 font-semibold ml-2">
              ≥6 = Good
            </span>
            ,
            <span className="text-red-600 font-semibold ml-2">
              &lt;6 = Poor
            </span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Character
                </th>
                {/*<th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Pinyin
                </th>*/}
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Sound Component (Anki)
                </th>
                {/*<th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Component Pinyin & Score
                </th>*/}
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Dong Sound Components (Candidates)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCharacterData.map((data) => (
                <CharacterRow
                  key={data.character}
                  character={data.character}
                  charPinyin={data.charPinyin}
                  soundComponentChar={data.soundComponentChar}
                  candidates={data.candidates}
                  isLoadingCandidates={data.isLoadingCandidates}
                  ankiId={data.ankiId}
                  onSoundComponentUpdate={handleSoundComponentUpdate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainFrame>
  );
}
