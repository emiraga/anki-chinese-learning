import MainFrame from "~/toolbar/frame";
import { Link } from "react-router";
import type { OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";
import { CharCard, CharLink } from "~/components/CharCard";
import type { CharacterType } from "~/data/characters";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { getNewCharacter } from "~/data/characters";
import { PinyinList } from "~/components/PinyinText";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";
import { getScoreBadgeClasses } from "~/utils/sound_component_helpers";
import { useYellowBridgeIndexes } from "~/hooks/useYellowBridgeIndexes";
import type { YellowBridgeIndexes } from "~/types/yellowbridge_character";
import { usePlecoOutlier } from "~/hooks/usePlecoOutlier";
import type { PlecoOutlier } from "~/types/pleco_outlier";

enum CandidateSource {
  DONG = "dong",
  YELLOWBRIDGE = "yellowbridge",
  PLECO = "pleco",
}

interface MergedCandidate {
  char: string;
  sources: CandidateSource[];
  bookCharCount?: number;
  isVerified?: boolean;
  pinyin?: string[];
}

// Helper function to merge candidates from all sources
function getMergedCandidates(
  soundComponent: string,
  existingChars: CharacterType[],
  dongCharacter: ReturnType<typeof useDongCharacter>["character"],
  yellowBridgeIndexes: YellowBridgeIndexes | null,
  plecoOutlier: PlecoOutlier | null,
): MergedCandidate[] {
  const existingCharSet = new Set(existingChars.map((c) => c.traditional));

  // Get candidates from Dong Chinese
  const dongCandidates = new Map<string, MergedCandidate>();
  if (dongCharacter?.componentIn) {
    dongCharacter.componentIn
      .filter((item) => {
        const hasSound = item.components
          .find((c) => c.character === soundComponent)
          ?.type.includes("sound");
        return hasSound && !existingCharSet.has(item.char);
      })
      .forEach((item) => {
        // Extract pinyin from pinyinFrequencies, sorted by count (most common first)
        const pinyin = item.pinyinFrequencies
          ?.sort((a, b) => b.count - a.count)
          .map((pf) => pf.pinyin) || [];

        dongCandidates.set(item.char, {
          char: item.char,
          sources: [CandidateSource.DONG],
          bookCharCount: item.statistics?.bookCharCount,
          isVerified: item.isVerified,
          pinyin,
        });
      });
  }

  // Get candidates from YellowBridge
  const yellowBridgeCandidates = new Map<string, string[]>();
  if (yellowBridgeIndexes?.soundsComponentIn?.[soundComponent]) {
    const ybEntry = yellowBridgeIndexes.soundsComponentIn[soundComponent];
    ybEntry.appearsIn.forEach((usage) => {
      if (!existingCharSet.has(usage.character)) {
        yellowBridgeCandidates.set(usage.character, usage.pinyin);
      }
    });
  }

  // Get candidates from Pleco Outlier (sound_series = characters that have this sound component)
  const plecoCandidates = new Map<string, string[]>();
  if (plecoOutlier?.sound_series?.characters) {
    plecoOutlier.sound_series.characters.forEach((char) => {
      if (!existingCharSet.has(char.traditional)) {
        plecoCandidates.set(char.traditional, char.pinyin || []);
      }
    });
  }

  // Merge candidates and track sources
  const candidatesMap = new Map<string, MergedCandidate>();

  // Add all Dong candidates
  dongCandidates.forEach((candidate) => {
    candidatesMap.set(candidate.char, candidate);
  });

  // Merge YellowBridge candidates
  yellowBridgeCandidates.forEach((pinyin, char) => {
    const existing = candidatesMap.get(char);
    if (existing) {
      // Add YellowBridge as a source and merge pinyin
      existing.sources.push(CandidateSource.YELLOWBRIDGE);
      existing.pinyin = [...new Set([...existing.pinyin || [], ...pinyin])];
    } else {
      // New candidate from YellowBridge only
      candidatesMap.set(char, {
        char,
        sources: [CandidateSource.YELLOWBRIDGE],
        pinyin,
      });
    }
  });

  // Merge Pleco candidates
  plecoCandidates.forEach((pinyin, char) => {
    const existing = candidatesMap.get(char);
    if (existing) {
      // Add Pleco as a source and merge pinyin
      existing.sources.push(CandidateSource.PLECO);
      existing.pinyin = [...new Set([...existing.pinyin || [], ...pinyin])];
    } else {
      // New candidate from Pleco only
      candidatesMap.set(char, {
        char,
        sources: [CandidateSource.PLECO],
        pinyin,
      });
    }
  });

  return Array.from(candidatesMap.values());
}

// Component to display a single sound component group
interface SoundComponentGroupProps {
  soundComponent: string;
  chars: CharacterType[];
  characters: OutletContext["characters"];
  yellowBridgeIndexes: YellowBridgeIndexes | null;
  yellowBridgeError: string | null;
  showZhuyin?: boolean;
  compact?: boolean; // For unknown singular display
}

function SoundComponentGroup({
  soundComponent,
  chars,
  characters,
  yellowBridgeIndexes,
  yellowBridgeError,
  showZhuyin,
  compact = false,
}: SoundComponentGroupProps) {
  // Get pinyin for the sound component
  const soundCompChar = characters[soundComponent];
  const soundCompPinyin = soundCompChar?.pinyin ??
    getNewCharacter(soundComponent)?.pinyin ?? ["???"];

  // Extract the pinyin string (with accents) for scoring
  const firstPinyin = soundCompPinyin[0];
  const soundPinyin =
    typeof firstPinyin === "string"
      ? firstPinyin
      : firstPinyin?.pinyinAccented || "";

  // Check if sound component is a known character
  const isSoundComponentKnown = !!soundCompChar;

  // Get merged candidates from all sources with error tracking
  const { character: dongCharacter, error: dongError } = useDongCharacter(soundComponent);
  const { character: plecoOutlier, error: plecoError } = usePlecoOutlier(soundComponent);
  const mergedCandidates = getMergedCandidates(
    soundComponent,
    chars,
    dongCharacter,
    yellowBridgeIndexes,
    plecoOutlier,
  );

  // Collect failed sources
  const failedSources: string[] = [];
  if (dongError) failedSources.push("Dong Chinese");
  if (plecoError) failedSources.push("Pleco Outlier");
  if (yellowBridgeError) failedSources.push("YellowBridge");

  // Calculate total unique characters (existing + candidates)
  const totalChars = chars.length + mergedCandidates.length;
  const hasLowCandidates = totalChars < 2;

  if (compact) {
    // Compact layout for unknown singular
    return (
      <div className="flex items-center gap-3">
        <Link
          to={`/char/${encodeURIComponent(soundComponent)}`}
          className="text-2xl font-bold dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {soundComponent}
        </Link>
        <div className="text-base">
          <PinyinList pinyin={soundCompPinyin} showZhuyin={showZhuyin} />
        </div>
        {failedSources.length > 0 && (
          <span
            className="text-xs text-red-600 dark:text-red-400 font-medium"
            title={`Failed to load: ${failedSources.join(", ")}`}
          >
            ⚠ Source error
          </span>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400">→</span>
        {chars.map((char) => {
          const charPinyin = char.pinyin?.[0]?.pinyinAccented || "";
          const score =
            charPinyin && soundPinyin
              ? scoreSoundSimilarity(soundPinyin, charPinyin)
              : null;

          return (
            <div
              key={char.traditional}
              className="relative flex items-center gap-2 w-52"
            >
              {score !== null && (
                <div
                  className={`px-1.5 py-0.5 rounded text-xs ${getScoreBadgeClasses(score)}`}
                  title={`Sound similarity: ${score}/10`}
                >
                  <span className="font-bold">{score.toFixed(1)}</span>
                </div>
              )}
              <CharCard v={char} showZhuyin={showZhuyin} hideMnemonic />
            </div>
          );
        })}
      </div>
    );
  }

  // Full layout for main sound components
  return (
    <div className="">
      <div className="flex items-center gap-3 mb-3">
        <Link
          to={`/char/${encodeURIComponent(soundComponent)}`}
          className="text-3xl font-bold dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {soundComponent}
        </Link>
        <div className="text-lg">
          <PinyinList pinyin={soundCompPinyin} showZhuyin={showZhuyin} />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({chars.length} character{chars.length !== 1 ? "s" : ""})
        </span>
        {!isSoundComponentKnown && (
          <span
            className="text-sm text-orange-600 dark:text-orange-400 font-medium"
            title="This sound component is not in your known characters"
          >
            ⚠ Unknown component
          </span>
        )}
        {hasLowCandidates && (
          <span
            className="text-sm text-orange-600 dark:text-orange-400 font-medium"
            title={`Only ${totalChars} character${totalChars !== 1 ? "s" : ""} found with this sound component across all sources`}
          >
            ⚠ Low candidates ({totalChars})
          </span>
        )}
        {failedSources.length > 0 && (
          <span
            className="text-sm text-red-600 dark:text-red-400 font-medium"
            title={`Failed to load: ${failedSources.join(", ")}`}
          >
            ⚠ Source error: {failedSources.join(", ")}
          </span>
        )}
      </div>
      <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap gap-2 ">
          {chars.map((char) => {
            // Calculate sound similarity score
            const charPinyin = char.pinyin?.[0]?.pinyinAccented || "";
            const score =
              charPinyin && soundPinyin
                ? scoreSoundSimilarity(soundPinyin, charPinyin)
                : null;

            return (
              <div key={char.traditional} className="relative w-52">
                {score !== null && (
                  <div
                    className={`px-1.5 py-0.5 w-26 rounded text-xs ${getScoreBadgeClasses(score)}`}
                    title={`Sound similarity: ${score}/10`}
                  >
                    Score:{" "}
                    <span className="font-bold">{score.toFixed(1)}</span>
                  </div>
                )}
                <CharCard v={char} showZhuyin={showZhuyin} hideMnemonic />
              </div>
            );
          })}
        </div>
        <SoundComponentCandidates
          soundComponentPinyin={soundPinyin}
          characters={characters}
          mergedCandidates={mergedCandidates}
        />
      </div>
    </div>
  );
}

// Component to display sound component candidates from Dong Chinese and YellowBridge data
interface SoundComponentCandidatesProps {
  soundComponentPinyin: string;
  characters: OutletContext["characters"];
  mergedCandidates: MergedCandidate[];
}

function SoundComponentCandidates({
  soundComponentPinyin,
  characters,
  mergedCandidates,
}: SoundComponentCandidatesProps) {
  if (mergedCandidates.length === 0) {
    return null;
  }

  // Sort by number of sources (descending), then by bookCharCount (frequency), then alphabetically
  const sortedCandidates = [...mergedCandidates].sort((a, b) => {
    // Primary sort: number of sources (more sources = more reliable)
    if (b.sources.length !== a.sources.length) {
      return b.sources.length - a.sources.length;
    }
    // Secondary sort: bookCharCount (frequency)
    const aCount = a.bookCharCount || 0;
    const bCount = b.bookCharCount || 0;
    if (bCount !== aCount) return bCount - aCount;
    // Tertiary sort: alphabetically
    return a.char.localeCompare(b.char);
  });

  return (
    <div className="pt-3">
      <div className="flex flex-wrap gap-2">
        {sortedCandidates.map((candidate) => {
          const isKnown = characters[candidate.char];

          // Get pinyin - prefer from known character, otherwise use candidate pinyin
          let candidatePinyin = "";
          if (isKnown) {
            candidatePinyin = isKnown.pinyin?.[0]?.pinyinAccented || "";
          } else if (candidate.pinyin && candidate.pinyin.length > 0) {
            // Use the first pinyin from the candidate data
            candidatePinyin = candidate.pinyin[0];
          }

          // Calculate score if we have pinyin
          let score: number | null = null;
          if (candidatePinyin && soundComponentPinyin) {
            score = scoreSoundSimilarity(
              soundComponentPinyin,
              candidatePinyin,
            );
          }

          // Determine border style based on number of missing sources
          const totalSources = 3; // Dong, YellowBridge, Pleco
          const missingSources = totalSources - candidate.sources.length;
          let borderClass = "";

          if (missingSources === 0) {
            // All sources - no underline
            borderClass = "";
          } else if (missingSources === 1) {
            // Missing 1 source - light gray
            borderClass = "border-b-2 border-gray-400 dark:border-gray-500";
          } else if (missingSources === 2) {
            // Missing 2 sources - medium gray
            borderClass = "border-b-2 border-gray-600 dark:border-gray-400";
          } else {
            // Missing 3 sources (shouldn't happen) - dark gray
            borderClass = "border-b-2 border-gray-800 dark:border-gray-200";
          }

          // Build source label
          const sourceNames: string[] = [];
          if (candidate.sources.includes(CandidateSource.DONG)) sourceNames.push("Dong");
          if (candidate.sources.includes(CandidateSource.YELLOWBRIDGE)) sourceNames.push("YellowBridge");
          if (candidate.sources.includes(CandidateSource.PLECO)) sourceNames.push("Pleco");
          const sourceLabel = sourceNames.join(", ");

          const tooltipParts = [
            candidate.char,
            candidatePinyin || "???",
            !isKnown ? "(Unknown)" : "",
            candidate.bookCharCount
              ? `${candidate.bookCharCount.toLocaleString()} uses`
              : "",
            candidate.isVerified ? "✓" : "",
            score !== null ? `Score: ${score.toFixed(1)}/10` : "",
            `Sources: ${sourceLabel}`,
          ].filter(Boolean);

          return (
            <div key={candidate.char} className="relative flex flex-col items-center gap-1">
              <CharLink
                traditional={candidate.char}
                className={`text-2xl font-serif hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${!isKnown ? "opacity-30" : ""} ${borderClass}`}
                title={tooltipParts.join(" - ")}
              >
                {candidate.char}
              </CharLink>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {candidatePinyin || "???"}
              </div>
              {score !== null && (
                <div
                  className={`rounded text-xs font-bold ${getScoreBadgeClasses(score)}`}
                  title={`Sound similarity: ${score}/10`}
                >
                  {score.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface SoundComponentsProps {
  characters: OutletContext["characters"];
}

export default function SoundComponents({
  characters,
}: SoundComponentsProps) {
  const {
    settings: { features },
  } = useSettings();

  // Load YellowBridge indexes
  const { indexes: yellowBridgeIndexes, error: yellowBridgeError } = useYellowBridgeIndexes();

  // Group characters by their sound component
  const soundComponentGroups = new Map<string, CharacterType[]>();
  const charsWithoutSoundComponent: CharacterType[] = [];

  Object.values(characters).forEach((char) => {
    const soundComp = char.soundComponentCharacter;
    if (soundComp && soundComp.trim().length > 0) {
      if (!soundComponentGroups.has(soundComp)) {
        soundComponentGroups.set(soundComp, []);
      }
      soundComponentGroups.get(soundComp)!.push(char);
    } else {
      charsWithoutSoundComponent.push(char);
    }
  });

  // Split sound components into main list and unknown singular
  const mainSoundComponents: Array<[string, CharacterType[]]> = [];
  const unknownSingularComponents: Array<[string, CharacterType[]]> = [];

  soundComponentGroups.forEach((chars, soundComponent) => {
    const isSoundComponentKnown = !!characters[soundComponent];
    const hasOnlyOneChar = chars.length === 1;

    if (!isSoundComponentKnown && hasOnlyOneChar) {
      unknownSingularComponents.push([soundComponent, chars]);
    } else {
      mainSoundComponents.push([soundComponent, chars]);
    }
  });

  // Sort main sound components by number of characters (descending), then alphabetically
  const sortedSoundComponents = mainSoundComponents.sort((a, b) => {
    const countDiff = b[1].length - a[1].length;
    if (countDiff !== 0) return countDiff;
    return a[0].localeCompare(b[0]);
  });

  // Sort unknown singular components alphabetically
  const sortedUnknownSingular = unknownSingularComponents.sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <MainFrame>
      <section className="block p-4">
        <div className="space-y-6">
          {sortedSoundComponents.map(([soundComponent, chars]) => (
            <SoundComponentGroup
              key={soundComponent}
              soundComponent={soundComponent}
              chars={chars}
              characters={characters}
              yellowBridgeIndexes={yellowBridgeIndexes}
              yellowBridgeError={yellowBridgeError}
              showZhuyin={features?.showZhuyin}
            />
          ))}
          {sortedSoundComponents.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No sound components found. Sound components are stored in the
              &ldquo;Sound component character&rdquo; field in your Anki cards.
            </div>
          )}

          {/* Unknown singular sound components */}
          {sortedUnknownSingular.length > 0 && (
            <div className="">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold dark:text-white">
                  Unknown singular
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({sortedUnknownSingular.length} component
                  {sortedUnknownSingular.length !== 1 ? "s" : ""})
                </span>
                <span
                  className="text-sm text-orange-600 dark:text-orange-400 font-medium"
                  title="Sound components that are not in your known characters and have only one associated character"
                >
                  ⚠ Unknown components with single character
                </span>
              </div>
              <div className="space-y-4 border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
                {sortedUnknownSingular.map(([soundComponent, chars]) => (
                  <SoundComponentGroup
                    key={soundComponent}
                    soundComponent={soundComponent}
                    chars={chars}
                    characters={characters}
                    yellowBridgeIndexes={yellowBridgeIndexes}
                    yellowBridgeError={yellowBridgeError}
                    showZhuyin={features?.showZhuyin}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Characters without sound component */}
          {charsWithoutSoundComponent.length > 0 && (
            <div className="">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold dark:text-white">
                  Characters without sound component
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({charsWithoutSoundComponent.length} character
                  {charsWithoutSoundComponent.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 m-2 border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
                {charsWithoutSoundComponent.map((char) => (
                  <CharCard
                    key={char.traditional}
                    v={char}
                    showZhuyin={features?.showZhuyin}
                    hideMnemonic
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </MainFrame>
  );
}
