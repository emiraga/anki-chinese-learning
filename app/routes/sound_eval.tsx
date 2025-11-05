import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";
import type { DongCharacter } from "~/types/dong_character";
import MainFrame from "~/toolbar/frame";

interface SoundComponentCandidate {
  character: string;
  pinyin: string;
  score: number;
  depth: number; // Track recursion depth
}

function getAllSoundComponents(
  dongChar: DongCharacter | null,
  depth: number = 0,
  visited: Set<string> = new Set(),
): SoundComponentCandidate[] {
  if (!dongChar || depth > 3) return []; // Limit recursion depth
  if (visited.has(dongChar.char)) return []; // Prevent circular references

  visited.add(dongChar.char);
  const candidates: SoundComponentCandidate[] = [];

  // Get sound components from this character
  const soundComponents =
    dongChar.components?.filter(
      (comp) => comp.type.includes("sound") || comp.type.includes("phonetic"),
    ) || [];

  for (const soundComp of soundComponents) {
    const componentChar = soundComp.character;

    // Get primary pinyin for this component
    const componentPinyin = getPrimaryPinyin(componentChar, dongChar);

    if (componentPinyin) {
      candidates.push({
        character: componentChar,
        pinyin: componentPinyin,
        score: 0, // Will be calculated later
        depth,
      });

      // TODO: Recursively get sound components of this component
      // This would require fetching the DongCharacter for the component
      // For now, we'll just use the immediate sound components
    }
  }

  return candidates;
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
  if (componentChar?.pinyinFrequencies && componentChar.pinyinFrequencies.length > 0) {
    return componentChar.pinyinFrequencies[0].pinyin;
  }

  // Try to get from oldPronunciations
  if (componentChar?.oldPronunciations && componentChar.oldPronunciations.length > 0) {
    return componentChar.oldPronunciations[0].pinyin;
  }

  // Try to get from words array
  const componentWord = dongChar.words?.find(
    (w) => w.simp === char || w.trad === char
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
}

function CharacterRow({
  character,
  charPinyin,
  soundComponentChar,
}: CharacterRowProps) {
  const { character: dongChar, loading: dongLoading } =
    useDongCharacter(character);
  const { character: soundCompDong, loading: soundCompLoading } =
    useDongCharacter(soundComponentChar || "");

  // Calculate candidates from Dong character data
  let candidates: SoundComponentCandidate[] = [];
  if (dongChar) {
    const allCandidates = getAllSoundComponents(dongChar);

    // Calculate scores for each candidate
    const scoredCandidates = allCandidates.map((candidate) => ({
      ...candidate,
      score: candidate.pinyin
        ? scoreSoundSimilarity(charPinyin, candidate.pinyin)
        : 0,
    }));

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    candidates = scoredCandidates;
  }

  const soundCompPinyin = soundCompDong?.pinyinFrequencies?.[0]?.pinyin || "";
  const soundCompScore = soundCompPinyin
    ? scoreSoundSimilarity(charPinyin, soundCompPinyin)
    : null;

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="px-4 py-2 font-bold text-lg">{character}</td>
      <td className="px-4 py-2">{charPinyin}</td>
      <td className="px-4 py-2 font-bold text-lg">
        {soundComponentChar || <span className="text-gray-400">-</span>}
      </td>
      <td className="px-4 py-2">
        {soundCompLoading ? (
          <span className="text-gray-400">Loading...</span>
        ) : soundCompPinyin ? (
          <div>
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
          </div>
        ) : soundComponentChar ? (
          <span className="text-gray-400">No pinyin</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-2">
        {dongLoading ? (
          <span className="text-gray-400">Loading...</span>
        ) : candidates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {candidates.map((candidate, idx) => (
              <div
                key={`${candidate.character}-${idx}`}
                className="inline-flex items-center gap-1 border border-gray-300 rounded px-2 py-1"
              >
                <span className="font-bold">{candidate.character}</span>
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
                {candidate.depth > 0 && (
                  <span
                    className="text-xs text-gray-400"
                    title={`Recursion depth: ${candidate.depth}`}
                  >
                    (d{candidate.depth})
                  </span>
                )}
              </div>
            ))}
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

  // Filter characters that have pinyin (show all, not just those with soundComponentCharacter)
  const charsWithSoundComp = Object.values(characters).filter(
    (char): char is NonNullable<typeof char> => {
      return !!(char && char.pinyin.length > 0);
    },
  );

  return (
    <MainFrame>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Sound Component Evaluation</h1>

        <div className="mb-4 text-gray-600">
          <p>
            Evaluating {charsWithSoundComp.length} characters
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
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Pinyin
                </th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Sound Component (Anki)
                </th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Component Pinyin & Score
                </th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">
                  Dong Sound Components (Candidates)
                </th>
              </tr>
            </thead>
            <tbody>
              {charsWithSoundComp.map((char) => (
                <CharacterRow
                  key={char.traditional}
                  character={char.traditional}
                  charPinyin={char.pinyin[0].pinyinAccented}
                  soundComponentChar={char.soundComponentCharacter}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainFrame>
  );
}
