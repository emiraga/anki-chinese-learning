import { useMemo, useState } from "react";
import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import type { PhraseType } from "~/data/phrases";
import anki, { ankiOpenBrowse } from "~/apis/anki";
import { PhraseLink, PhraseMeaning } from "~/components/Phrase";

type OverlappingPhrase = {
  traditional: string;
  phrase: PhraseType;
  count: number;
  containingPhrases: PhraseType[];
  shortestContainingLength: number;
};

const buildOverlappingPhrases = (
  phrases: PhraseType[],
): OverlappingPhrase[] => {
  // Deduplicate by Traditional value, keeping the first note for each value.
  const phraseByTraditional = new Map<string, PhraseType>();
  for (const phrase of phrases) {
    if (!phraseByTraditional.has(phrase.traditional)) {
      phraseByTraditional.set(phrase.traditional, phrase);
    }
  }

  const traditionals = [...phraseByTraditional.keys()];

  return traditionals
    .map((traditional) => {
      // Only strictly longer phrases can contain it as a substring.
      const containingTraditionals = traditionals.filter(
        (other) =>
          other.length > traditional.length && other.includes(traditional),
      );

      if (containingTraditionals.length === 0) {
        return null;
      }

      const containingPhrases = containingTraditionals
        .map((t) => phraseByTraditional.get(t)!)
        .sort(
          (a, b) =>
            a.traditional.length - b.traditional.length ||
            a.traditional.localeCompare(b.traditional),
        );

      return {
        traditional,
        phrase: phraseByTraditional.get(traditional)!,
        count: containingPhrases.length,
        containingPhrases,
        shortestContainingLength: Math.min(
          ...containingPhrases.map((p) => p.traditional.length),
        ),
      };
    })
    .filter((item): item is OverlappingPhrase => item !== null)
    .sort((a, b) => {
      // Primary: number of phrases it appears in, highest first.
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      // Secondary: shortest phrase it appears in, shortest first.
      if (a.shortestContainingLength !== b.shortestContainingLength) {
        return a.shortestContainingLength - b.shortestContainingLength;
      }
      // Tertiary: keep the order deterministic.
      if (a.traditional.length !== b.traditional.length) {
        return a.traditional.length - b.traditional.length;
      }
      return a.traditional.localeCompare(b.traditional);
    });
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Overlapping Phrases" },
    { name: "description", content: "Phrases that appear inside other phrases" },
  ];
}

export default function OverlappingPhrases() {
  const { phrases, reload } = useOutletContext<OutletContext>();
  const [suspendingNoteId, setSuspendingNoteId] = useState<number | null>(null);

  const overlappingPhrases = useMemo(
    () => buildOverlappingPhrases(phrases),
    [phrases],
  );

  const handleSuspend = async (phrase: PhraseType) => {
    setSuspendingNoteId(phrase.noteId);
    try {
      const notes = await anki.note.notesInfo({ notes: [phrase.noteId] });
      const cardIds = notes[0]?.cards ?? [];
      if (cardIds.length > 0) {
        await anki.card.suspend({ cards: cardIds });
      }
      reload();
    } finally {
      setSuspendingNoteId(null);
    }
  };

  return (
    <MainFrame>
      <h3 className="font-serif text-4xl m-4 text-gray-900 dark:text-gray-100">
        Overlapping phrases: ({overlappingPhrases.length})
      </h3>
      <p className="mx-4 mb-4 text-gray-600 dark:text-gray-400">
        Phrases whose Traditional field appears as a substring of another
        phrase, sorted by the number of phrases they appear in (highest first),
        then by the length of the shortest phrase they appear in (shortest
        first).
      </p>

      <section className="block mx-4">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Traditional
                </th>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Pinyin
                </th>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Meaning
                </th>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Appears in
                </th>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Contained in
                </th>
                <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-600">
              {overlappingPhrases.map((item) => (
                <tr
                  key={item.traditional}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                    <PhraseLink value={item.traditional} />
                  </td>
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                    <span
                      dangerouslySetInnerHTML={{ __html: item.phrase.pinyin }}
                    ></span>
                  </td>
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                    <div className="max-w-md">
                      <PhraseMeaning meaning={item.phrase.meaning} />
                    </div>
                  </td>
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium dark:bg-blue-900 dark:text-blue-300">
                      {item.count}
                    </span>
                  </td>
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                    <div className="flex flex-wrap gap-2">
                      {item.containingPhrases.map((containing, index) => (
                        <span
                          key={containing.traditional}
                          className={
                            index === 0
                              ? "font-semibold underline decoration-blue-400 decoration-2 underline-offset-2"
                              : ""
                          }
                        >
                          <PhraseLink value={containing.traditional} />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-gray-900 dark:text-gray-100 px-2 py-3 whitespace-nowrap">
                    <button
                      className="rounded-2xl bg-blue-100 dark:bg-blue-800 dark:text-blue-100 p-1 mr-2 inline text-xs text-blue-500"
                      onClick={() => ankiOpenBrowse(`nid:${item.phrase.noteId}`)}
                    >
                      anki
                    </button>
                    <button
                      className="rounded-2xl bg-red-100 dark:bg-red-800 dark:text-red-100 p-1 inline text-xs text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleSuspend(item.phrase)}
                      disabled={suspendingNoteId === item.phrase.noteId}
                    >
                      {suspendingNoteId === item.phrase.noteId
                        ? "suspending..."
                        : "suspend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MainFrame>
  );
}
