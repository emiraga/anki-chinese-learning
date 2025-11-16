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

// Helper function to get background color for score badge
function getScoreBgColor(score: number): string {
  if (score >= 9) return "bg-green-100 dark:bg-green-900/30"; // Excellent
  if (score >= 7) return "bg-blue-100 dark:bg-blue-900/30"; // Good
  if (score >= 5) return "bg-yellow-100 dark:bg-yellow-900/30"; // Moderate
  if (score >= 3) return "bg-orange-100 dark:bg-orange-900/30"; // Poor
  return "bg-red-100 dark:bg-red-900/30"; // Very poor
}

// Component to display a single sound component group
interface SoundComponentGroupProps {
  soundComponent: string;
  chars: CharacterType[];
  characters: OutletContext["characters"];
  showZhuyin?: boolean;
  compact?: boolean; // For unknown singular display
}

function SoundComponentGroup({
  soundComponent,
  chars,
  characters,
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
              className="relative flex items-center gap-2"
            >
              {score !== null && (
                <div
                  className={`px-1.5 py-0.5 rounded text-xs ${getScoreBgColor(score)}`}
                  title={`Sound similarity: ${score}/10`}
                >
                  <span className="font-bold">{score.toFixed(1)}</span>
                </div>
              )}
              <CharCard v={char} showZhuyin={showZhuyin} />
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
              <div key={char.traditional} className="relative">
                {score !== null && (
                  <div
                    className={`px-1.5 py-0.5 w-26 rounded text-xs  ${getScoreBgColor(score)} `}
                    title={`Sound similarity: ${score}/10`}
                  >
                    Score:{" "}
                    <span className={`font-bold`}>{score.toFixed(1)}</span>
                  </div>
                )}
                <CharCard v={char} showZhuyin={showZhuyin} />
              </div>
            );
          })}
        </div>
        <SoundComponentCandidates
          soundComponent={soundComponent}
          soundComponentPinyin={soundPinyin}
          characters={characters}
          existingChars={chars}
        />
      </div>
    </div>
  );
}

// Component to display sound component candidates from Dong Chinese data
interface SoundComponentCandidatesProps {
  soundComponent: string;
  soundComponentPinyin: string;
  characters: OutletContext["characters"];
  existingChars: CharacterType[];
}

function SoundComponentCandidates({
  soundComponent,
  soundComponentPinyin,
  characters,
  existingChars,
}: SoundComponentCandidatesProps) {
  const { character, loading, error } = useDongCharacter(soundComponent);

  if (loading) {
    return (
      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Loading candidates...
      </div>
    );
  }

  if (error || !character?.componentIn) {
    return null;
  }

  // Create a Set of existing character traditional forms for fast lookup
  const existingCharSet = new Set(existingChars.map((c) => c.traditional));

  // Filter for characters where this is a sound component
  // and exclude characters that are already in the main list
  const soundCandidates = character.componentIn.filter((item) => {
    const hasSound = item.components
      .find((c) => c.character === soundComponent)
      ?.type.includes("sound");
    return hasSound && !existingCharSet.has(item.char);
  });

  if (soundCandidates.length === 0) {
    return null;
  }

  // Sort by bookCharCount (frequency)
  const sortedCandidates = [...soundCandidates].sort((a, b) => {
    const aCount = a.statistics?.bookCharCount || 0;
    const bCount = b.statistics?.bookCharCount || 0;
    return bCount - aCount;
  });

  return (
    <div className="pt-3">
      <div className="flex flex-wrap gap-2">
        {sortedCandidates.map((item) => {
          const isKnown = characters[item.char];

          // Calculate score only for known characters
          let score: number | null = null;
          if (isKnown) {
            // Get pinyin from the known character data (which has pinyinAccented)
            const candidatePinyin = isKnown.pinyin?.[0]?.pinyinAccented || "";
            if (candidatePinyin && soundComponentPinyin) {
              score = scoreSoundSimilarity(
                soundComponentPinyin,
                candidatePinyin,
              );
            }
          }

          return (
            <div key={item.char} className="relative">
              <CharLink
                traditional={item.char}
                className={`text-2xl font-serif hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${!isKnown ? "opacity-30" : ""}`}
                title={`${item.char}${!isKnown ? " (Unknown)" : ""}${item.statistics?.bookCharCount ? ` - ${item.statistics.bookCharCount.toLocaleString()} uses` : ""}${item.isVerified ? " ✓" : ""}${score !== null ? ` - Score: ${score.toFixed(1)}/10` : ""}`}
              >
                {item.char}
              </CharLink>
              {score !== null && (
                <div
                  className={`rounded text-xs font-bold ${getScoreBgColor(score)}`}
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
