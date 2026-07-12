import { useOutletContext } from "react-router";
import { useState } from "react";
import type { OutletContext } from "~/data/types";
import anki, { ankiOpenBrowse } from "~/apis/anki";
import { PhraseLink, PhraseMeaning } from "./Phrase";
import AnkiAudioPlayer from "./AnkiAudioPlayer";
import { POSList } from "./POSDisplay";
import {
  DUPLICATE_PHRASE_SOURCES,
  getDuplicatePhrases,
  getLowercasePinyinPhrases,
  getPhraseZhuyinInconsistencies,
} from "~/data/integrity_checks";

/**
 * Phrase-based integrity checks that only depend on already-loaded state.
 * Migrated out of `~/components/Integrity` into the `/phrase_conflicts` page.
 */

function DuplicatePhrase({ source }: { source: string }) {
  const { phrases } = useOutletContext<OutletContext>();
  const [deletedNotes, setDeletedNotes] = useState<Set<number>>(new Set());

  const filtered = getDuplicatePhrases(phrases, source).filter(
    (phrase) => !deletedNotes.has(phrase.noteId),
  );

  if (filtered.length === 0) {
    return undefined;
  }

  // Group by traditional for display
  const groupedByTraditional = new Map<string, typeof filtered>();
  for (const phrase of filtered) {
    const group = groupedByTraditional.get(phrase.traditional) || [];
    group.push(phrase);
    groupedByTraditional.set(phrase.traditional, group);
  }

  const handleDeleteNote = async (noteId: number, traditional: string) => {
    if (
      confirm(
        `Delete ${source} note for "${traditional}"? This cannot be undone.`,
      )
    ) {
      try {
        await anki.note.deleteNotes({ notes: [noteId] });
        setDeletedNotes((prev) => new Set(prev).add(noteId));
      } catch (error) {
        throw new Error(`Failed to delete note: ${error}`);
      }
    }
  };

  // Get unique traditional values for display
  const uniqueTraditionals = [...groupedByTraditional.keys()];

  return (
    <>
      <h3 className="font-serif text-3xl">
        Duplicate phrases in {source} ({uniqueTraditionals.length} duplicates,{" "}
        {filtered.length} total entries):
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 mt-4 table-fixed">
          <colgroup>
            <col className="w-32" />
            <col className="w-auto" />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                Traditional
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                Duplicate Entries
              </th>
            </tr>
          </thead>
          <tbody>
            {uniqueTraditionals.map((traditional) => {
              const duplicates = groupedByTraditional.get(traditional) || [];

              // Check if there are pinyin mismatches among duplicates
              const pinyinValues = new Set(duplicates.map((d) => d.pinyin));
              const hasPinyinMismatch = pinyinValues.size > 1;

              return (
                <tr
                  key={traditional}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    hasPinyinMismatch
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : ""
                  }`}
                >
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium align-top">
                    <div className="flex flex-col gap-2">
                      <div>
                        <PhraseLink value={traditional} />
                      </div>
                      <button
                        className="rounded-xl bg-gray-100 dark:bg-gray-900 px-2 py-1 text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors self-start"
                        onClick={async () => {
                          await ankiOpenBrowse(
                            `Traditional:${traditional} note:${source}`,
                          );
                        }}
                      >
                        All in Anki
                      </button>
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 align-top">
                    <div className="space-y-3">
                      {duplicates.map((phrase, j) => {
                        const isPinyinDifferent =
                          hasPinyinMismatch &&
                          phrase.pinyin !== duplicates[0].pinyin;
                        return (
                          <div
                            key={j}
                            className="text-sm border-b border-gray-200 dark:border-gray-700 pb-2 last:border-b-0"
                          >
                            <div className="font-medium">
                              <PhraseMeaning meaning={phrase.meaning} />
                              {phrase.partOfSpeech && (
                                <span className="ml-2 text-xs">
                                  [<POSList posString={phrase.partOfSpeech} />]
                                </span>
                              )}
                            </div>
                            <div
                              className={`${
                                isPinyinDifferent
                                  ? "text-red-600 dark:text-red-400 font-semibold"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {isPinyinDifferent && "⚠️ "}
                              {phrase.pinyin}
                              <AnkiAudioPlayer audioField={phrase.audio} />
                              {isPinyinDifferent && " ❗"}
                            </div>
                            <div className="flex gap-1 mt-1">
                              <button
                                className="rounded-xl bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                onClick={async () => {
                                  await ankiOpenBrowse(`nid:${phrase.noteId}`);
                                }}
                              >
                                anki
                              </button>
                              <button
                                className="rounded-xl bg-red-100 dark:bg-red-900 px-2 py-1 text-xs text-red-500 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                onClick={() =>
                                  handleDeleteNote(phrase.noteId, traditional)
                                }
                              >
                                delete
                              </button>
                              {phrase.audio && duplicates.length > 1 && (
                                <button
                                  className="rounded-xl bg-purple-100 dark:bg-purple-900 px-2 py-1 text-xs text-purple-500 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                                  onClick={async () => {
                                    const others = duplicates.filter(
                                      (d) => d.noteId !== phrase.noteId,
                                    );
                                    for (const other of others) {
                                      await anki.note.updateNoteFields({
                                        note: {
                                          id: other.noteId,
                                          fields: { Audio: phrase.audio },
                                        },
                                      });
                                    }
                                    alert(
                                      `Audio copied to ${others.length} other note(s)!`,
                                    );
                                  }}
                                >
                                  Use this audio
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LowerCasePinyinPhrases() {
  const { phrases } = useOutletContext<OutletContext>();
  const filtered = getLowercasePinyinPhrases(phrases);
  if (filtered.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Lowercase pinyin:</h3>
      {filtered.map((phrase, i) => (
        <div key={i}>
          Not lower case pinyin: {phrase.source}{" "}
          <PhraseLink value={phrase.traditional} />
          {phrase.pinyin}
        </div>
      ))}
    </>
  );
}

function IntegrityPinyinZhuyinConsistency() {
  const { phrases } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = getPhraseZhuyinInconsistencies(phrases);

  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">
        Pinyin-Zhuyin Consistency Issues:{" "}
        <button
          className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            setProgress({ current: 0, total: filtered.length });

            for (let i = 0; i < filtered.length; i++) {
              const phrase = filtered[i];
              setProgress({ current: i + 1, total: filtered.length });

              await anki.note.updateNoteFields({
                note: {
                  id: phrase.noteId,

                  fields: { Zhuyin: "" },
                },
              });
            }

            setIsProcessing(false);
            alert("Fixed all zhuyin inconsistencies!");
          }}
        >
          {isProcessing ? "Processing..." : "Empty all zhuyin!"}
        </button>
        {isProcessing && (
          <div className="mt-2">
            <progress
              className="w-full h-2"
              value={progress.current}
              max={progress.total}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {progress.current} / {progress.total} phrases
            </div>
          </div>
        )}
      </h3>

      <div className="mx-4">
        {filtered.map((phrase, i) => (
          <div key={i} className="border-b py-2">
            <div className="font-medium">
              <PhraseLink value={phrase.traditional} />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Pinyin: {phrase.pinyin}
            </div>
            <div className="text-sm">
              Current Zhuyin:{" "}
              <span className="text-red-500">{phrase.zhuyin}</span>
            </div>
            <div className="text-sm">
              Expected Zhuyin:{" "}
              <span className="text-green-500">{phrase.expectedZhuyin}</span>
            </div>
            <button
              className="rounded-2xl px-2 py-1 mt-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors text-sm"
              onClick={async () => {
                await anki.note.updateNoteFields({
                  note: {
                    id: phrase.noteId,

                    fields: { Zhuyin: "" },
                  },
                });
                alert("Done!");
              }}
            >
              Empty zhuyin field
            </button>
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`Traditional:${phrase.traditional}`);
              }}
            >
              anki
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export const PhraseConflictSections: React.FC<{}> = ({}) => {
  return (
    <>
      <section className="block m-4">
        <LowerCasePinyinPhrases />
      </section>
      <section className="block m-4">
        <IntegrityPinyinZhuyinConsistency />
      </section>
      <section className="block m-4">
        {DUPLICATE_PHRASE_SOURCES.map((source) => (
          <DuplicatePhrase key={source} source={source} />
        ))}
      </section>
    </>
  );
};
