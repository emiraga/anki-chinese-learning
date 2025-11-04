import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/sound_components";
import { useOutletContext, Link } from "react-router";
import type { OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";
import { CharCard, CharLink } from "~/components/CharCard";
import type { CharacterType } from "~/data/characters";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { getNewCharacter } from "~/data/characters";
import { PinyinList } from "~/components/PinyinText";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sound Components" },
    {
      name: "description",
      content: "Characters grouped by their sound components.",
    },
  ];
}

// Helper function to get color based on sound similarity score
// function getScoreColor(score: number): string {
//   if (score >= 9) return "text-green-600 dark:text-green-400"; // Excellent
//   if (score >= 7) return "text-blue-600 dark:text-blue-400"; // Good
//   if (score >= 5) return "text-yellow-600 dark:text-yellow-400"; // Moderate
//   if (score >= 3) return "text-orange-600 dark:text-orange-400"; // Poor
//   return "text-red-600 dark:text-red-400"; // Very poor
// }

// Helper function to get background color for score badge
function getScoreBgColor(score: number): string {
  if (score >= 9) return "bg-green-100 dark:bg-green-900/30"; // Excellent
  if (score >= 7) return "bg-blue-100 dark:bg-blue-900/30"; // Good
  if (score >= 5) return "bg-yellow-100 dark:bg-yellow-900/30"; // Moderate
  if (score >= 3) return "bg-orange-100 dark:bg-orange-900/30"; // Poor
  return "bg-red-100 dark:bg-red-900/30"; // Very poor
}

// Component to display sound component candidates from Dong Chinese data
interface SoundComponentCandidatesProps {
  soundComponent: string;
  characters: OutletContext["characters"];
  existingChars: CharacterType[];
}

function SoundComponentCandidates({
  soundComponent,
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
          return (
            <CharLink
              key={item.char}
              traditional={item.char}
              className={`text-2xl font-serif hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${!isKnown ? "opacity-30" : ""}`}
              title={`${item.char}${!isKnown ? " (Unknown)" : ""}${item.statistics?.bookCharCount ? ` - ${item.statistics.bookCharCount.toLocaleString()} uses` : ""}${item.isVerified ? " ✓" : ""}`}
            >
              {item.char}
            </CharLink>
          );
        })}
      </div>
    </div>
  );
}

export default function SoundComponents() {
  const { characters } = useOutletContext<OutletContext>();
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

  // Sort sound components by number of characters (descending), then alphabetically
  const sortedSoundComponents = Array.from(soundComponentGroups.entries()).sort(
    (a, b) => {
      const countDiff = b[1].length - a[1].length;
      if (countDiff !== 0) return countDiff;
      return a[0].localeCompare(b[0]);
    },
  );

  return (
    <MainFrame>
      <section className="block p-4">
        <div className="space-y-6">
          {sortedSoundComponents.map(([soundComponent, chars]) => {
            // Get pinyin for the sound component
            const soundCompChar = characters[soundComponent];
            const soundCompPinyin = soundCompChar?.pinyin ??
              getNewCharacter(soundComponent)?.pinyin ?? ["???"];

            return (
              <div key={soundComponent} className="">
                <div className="flex items-center gap-3 mb-3">
                  <Link
                    to={`/char/${encodeURIComponent(soundComponent)}`}
                    className="text-3xl font-bold dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {soundComponent}
                  </Link>
                  <div className="text-lg">
                    <PinyinList
                      pinyin={soundCompPinyin}
                      showZhuyin={features?.showZhuyin}
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({chars.length} character{chars.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2 ">
                    {chars.map((char) => {
                      // Calculate sound similarity score
                      // Use pinyinAccented to preserve tone marks
                      const charPinyin = char.pinyin?.[0]?.pinyinAccented || "";
                      const firstPinyin = soundCompPinyin[0];
                      const soundPinyin =
                        typeof firstPinyin === "string"
                          ? firstPinyin
                          : firstPinyin?.pinyinAccented || "";
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
                              <span className={`font-bold`}>
                                {score.toFixed(1)}
                              </span>
                            </div>
                          )}
                          <CharCard
                            v={char}
                            showZhuyin={features?.showZhuyin}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <SoundComponentCandidates
                    soundComponent={soundComponent}
                    characters={characters}
                    existingChars={chars}
                  />
                </div>
              </div>
            );
          })}
          {sortedSoundComponents.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No sound components found. Sound components are stored in the
              &ldquo;Sound component character&rdquo; field in your Anki cards.
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
              <div className="flex flex-wrap gap-2 border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
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
