import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/sound_components";
import { useOutletContext, Link } from "react-router";
import type { OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";
import { CharCard } from "~/components/CharCard";
import type { CharacterType } from "~/data/characters";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sound Components" },
    {
      name: "description",
      content: "Characters grouped by their sound components.",
    },
  ];
}

export default function SoundComponents() {
  const { characters } = useOutletContext<OutletContext>();
  const {
    settings: { features },
  } = useSettings();

  // Group characters by their sound component
  const soundComponentGroups = new Map<string, CharacterType[]>();

  Object.values(characters).forEach((char) => {
    const soundComp = char.soundComponentCharacter;
    if (soundComp && soundComp.trim().length > 0) {
      if (!soundComponentGroups.has(soundComp)) {
        soundComponentGroups.set(soundComp, []);
      }
      soundComponentGroups.get(soundComp)!.push(char);
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
        <h1 className="text-2xl font-bold mb-4 dark:text-white">
          Sound Components
        </h1>
        <div className="space-y-6">
          {sortedSoundComponents.map(([soundComponent, chars]) => (
            <div key={soundComponent} className="">
              <div className="flex items-center gap-3 mb-3">
                <Link
                  to={`/char/${encodeURIComponent(soundComponent)}`}
                  className="text-3xl font-bold dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {soundComponent}
                </Link>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({chars.length} character{chars.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="flex flex-wrap gap-2 border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
                {chars.map((char) => (
                  <CharCard
                    key={char.traditional}
                    v={char}
                    showZhuyin={features?.showZhuyin}
                  />
                ))}
              </div>
            </div>
          ))}
          {sortedSoundComponents.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No sound components found. Sound components are stored in the
              &ldquo;Sound component character&rdquo; field in your Anki cards.
            </div>
          )}
        </div>
      </section>
    </MainFrame>
  );
}
