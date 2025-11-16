import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { useSoundComponentUpdate } from "~/hooks/useSoundComponentUpdate";
import MainFrame from "~/toolbar/frame";
import { useEffect, useState, useMemo } from "react";
import { CharLink } from "~/components/CharCard";
import { Tabs } from "~/components/Tabs";
import {
  type SoundComponentCandidate,
  fetchDongCharacter,
  fetchYellowBridgeCharacter,
  loadSoundComponentCandidates,
  getScoreBadgeClasses,
  getCharacterPinyin,
} from "~/utils/sound_component_helpers";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";
import { CandidateBadge } from "~/components/CandidateBadge";
import { ScoreLegend } from "~/components/ScoreLegend";

interface CharacterRowProps {
  character: string;
  charPinyin: string;
  soundComponentChar?: string;
  candidates: SoundComponentCandidate[];
  isLoadingCandidates: boolean;
  ankiId: number | null;
  onSoundComponentUpdate: (character: string) => void;
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
  const { character: soundCompDong, loading: soundCompLoading } =
    useDongCharacter(soundComponentChar || "");

  // Get pinyin from Dong data, or fallback to library
  const soundCompPinyin = soundComponentChar
    ? getCharacterPinyin(soundComponentChar, soundCompDong)
    : "";

  const soundCompScore = soundCompPinyin
    ? scoreSoundSimilarity(charPinyin, soundCompPinyin)
    : null;

  const { updateSoundComponent, isUpdating } = useSoundComponentUpdate({
    ankiId,
    onUpdate: () => onSoundComponentUpdate(character),
  });

  // Check if any candidate has a higher score than the current Anki sound component
  const hasBetterCandidate =
    soundCompScore !== null &&
    candidates.some((candidate) => candidate.score > soundCompScore);

  return (
    <tr
      className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
        hasBetterCandidate ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
      }`}
    >
      <td className="px-4 py-2 font-bold text-lg dark:text-white">
        <CharLink traditional={character} /> {charPinyin}
      </td>
      {/*<td className="px-4 py-2">{charPinyin}</td>*/}
      <td className="px-4 py-2 font-bold text-lg dark:text-white">
        {soundComponentChar ? (
          <CharLink traditional={soundComponentChar} />
        ) : (
          <span className="text-gray-400 dark:text-gray-500">-</span>
        )}{" "}
        {/*</td>
      <td className="px-4 py-2">*/}
        {soundCompLoading ? (
          <span className="text-gray-400 dark:text-gray-500">Loading...</span>
        ) : soundCompPinyin ? (
          <>
            <span>{soundCompPinyin}</span>
            {soundCompScore !== null && (
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-semibold ${getScoreBadgeClasses(soundCompScore)}`}
              >
                {soundCompScore.toFixed(1)}
              </span>
            )}
          </>
        ) : soundComponentChar ? (
          <span className="text-gray-400 dark:text-gray-500">No pinyin</span>
        ) : undefined}
      </td>
      <td className="px-4 py-2">
        {isLoadingCandidates ? (
          <span className="text-gray-400 dark:text-gray-500">Loading...</span>
        ) : candidates.length > 0 ? (
          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            {candidates.map((candidate, idx) => (
              <CandidateBadge
                key={`${candidate.character}-${idx}`}
                candidate={candidate}
                onSelect={updateSoundComponent}
                isUpdating={isUpdating}
                disabled={!ankiId}
              />
            ))}
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">
            No sound components found
          </span>
        )}
      </td>
    </tr>
  );
}

export default function SoundEval() {
  const { characters } = useOutletContext<OutletContext>();
  const [activeTab, setActiveTab] = useState<string>("needs-review");

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
    setCharacterDataList((prev) =>
      prev.filter((data) => data.character !== character),
    );
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

        // Fetch data from both sources in parallel
        const [dongChar, ybChar] = await Promise.all([
          fetchDongCharacter(char.traditional),
          fetchYellowBridgeCharacter(char.traditional),
        ]);

        // Load and process candidates using helper function
        const candidates = await loadSoundComponentCandidates(
          char.traditional,
          charPinyin,
          dongChar,
          ybChar,
        );

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

  // Categorize character data into three groups
  const categorizedData = useMemo(() => {
    const needsReview: CharacterData[] = [];
    const noSoundComponent: CharacterData[] = [];
    const alreadyCorrect: CharacterData[] = [];

    for (const data of characterDataList) {
      const topCandidate =
        data.candidates.length > 0 ? data.candidates[0] : null;
      const ankiMatchesTopCandidate =
        data.soundComponentChar &&
        topCandidate &&
        data.soundComponentChar === topCandidate.character;

      // Already correct: Anki sound component matches top candidate
      if (ankiMatchesTopCandidate) {
        alreadyCorrect.push(data);
      }
      // No sound component: Character has no sound component in Anki
      else if (!data.soundComponentChar) {
        noSoundComponent.push(data);
      }
      // Needs review: Has sound component but doesn't match top candidate, or has candidates
      else if (data.candidates.length > 0) {
        needsReview.push(data);
      }
    }

    return { needsReview, noSoundComponent, alreadyCorrect };
  }, [characterDataList]);

  // Get the data for the active tab
  const activeTabData = useMemo(() => {
    switch (activeTab) {
      case "needs-review":
        return categorizedData.needsReview;
      case "no-sound-component":
        return categorizedData.noSoundComponent;
      case "already-correct":
        return categorizedData.alreadyCorrect;
      default:
        return categorizedData.needsReview;
    }
  }, [activeTab, categorizedData]);

  return (
    <MainFrame>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 text-gray-600 dark:text-gray-300">
          <p>
            {isLoadingAll
              ? `Loading... ${characterDataList.length} / ${charsWithPinyin.length} characters processed`
              : `Total: ${charsWithPinyin.length} characters`}
          </p>
          <div className="mt-1">
            <ScoreLegend />
          </div>
        </div>

        <Tabs
          tabs={[
            {
              id: "needs-review",
              label: "Needs Review",
              count: categorizedData.needsReview.length,
            },
            {
              id: "no-sound-component",
              label: "No Sound Component",
              count: categorizedData.noSoundComponent.length,
            },
            {
              id: "already-correct",
              label: "Already Correct",
              count: categorizedData.alreadyCorrect.length,
            },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white">
                  Character
                </th>
                {/*<th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white">
                  Pinyin
                </th>*/}
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white">
                  Sound Component (Anki)
                </th>
                {/*<th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white">
                  Component Pinyin & Score
                </th>*/}
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-700 dark:text-white">
                  Dong Sound Components (Candidates)
                </th>
              </tr>
            </thead>
            <tbody>
              {activeTabData.map((data) => (
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
