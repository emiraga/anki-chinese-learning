import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "./CharCard";
import anki, {
  ankiOpenBrowse,
  useAnkiCards,
  type NoteWithCards,
} from "~/apis/anki";
import { ACTOR_TAGS_MAP, REVERSE_FULL_MAP } from "~/data/pinyin_table";
import { PropCard } from "./PropCard";
import { useEffect, useMemo, useState } from "react";
import { CARDS_INFO } from "~/data/cards";
import pinyinToZhuyin from "zhuyin-improved";
import { LoadingProgressBar } from "./LoadingProgressBar";
import { PhraseMeaning } from "./Phrase";
import {
  getCharacterMnemonicTags,
  shouldHaveMnemonicTags,
} from "~/data/character_tags";

function IntegrityActorPlaceAnki() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = Object.values(characters)
    .filter((char) => shouldHaveMnemonicTags(char))
    .map((char) => {
      try {
        const { missingTags, actorTag, placeTag, toneTag } =
          getCharacterMnemonicTags(char);
        const { initial, final } = REVERSE_FULL_MAP[char.pinyin[0].sylable];
        return {
          ...char,
          needTags: missingTags,
          initial,
          final,
          actorTag,
          placeTag,
          toneTag,
        };
      } catch (error) {
        console.error("Error processing character:", char.traditional, error);
        throw error;
      }
    })
    .filter((char) => {
      if (
        char.tags.filter((t) => t.startsWith("actor::")).length === 1 &&
        char.tags.filter((t) => t.startsWith("place::")).length === 1 &&
        char.tags.filter((t) => t.startsWith("tone::")).length === 1 &&
        char.needTags.length === 0
      ) {
        return false;
      }
      return true;
    });

  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">
        Migration of actor, place and tone:{" "}
        <button
          className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            setProgress({ current: 0, total: filtered.length });

            for (let i = 0; i < filtered.length; i++) {
              const char = filtered[i];
              setProgress({ current: i + 1, total: filtered.length });

              for (const needTag of char.needTags) {
                await anki.note.addTags({
                  notes: [char.ankiId || 0],
                  tags: needTag,
                });
              }
            }

            setIsProcessing(false);
            alert("Fixed!");
          }}
        >
          {isProcessing ? "Processing..." : "Auto-fix all!"}
        </button>
        {isProcessing && (
          <div className="mt-2">
            <progress
              className="w-full h-2"
              value={progress.current}
              max={progress.total}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {progress.current} / {progress.total} characters
            </div>
          </div>
        )}
      </h3>
      {filtered.map((char, i) => {
        return (
          <div key={i}>
            <CharCardDetails char={char} />
            {char.initial} {char.final} {char.pinyin[0].tone} |{" "}
            {char.tags.join(",")} | need tags:
            {char.needTags.join(",")}
            {char.ankiId ? (
              <button
                className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                onClick={async () => {
                  for (const needTag of char.needTags) {
                    await anki.note.addTags({
                      notes: [char.ankiId || 0],
                      tags: needTag,
                    });
                  }
                  alert("Fixed!");
                }}
              >
                Auto-fix!
              </button>
            ) : undefined}
            <hr />
          </div>
        );
      })}
    </>
  );
}

function IntegrityPropNames() {
  const { props } = useOutletContext<OutletContext>();

  const filtered = Object.values(props).filter(
    (prop) => prop.mainTagname !== "prop::" + prop.prop,
  );

  if (!filtered.length) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Migration of prop names:</h3>
      {filtered.map((prop, i) => (
        <div key={i}>
          <PropCard prop={prop} />
          {prop.mainTagname} === {"prop::" + prop.prop}
          <hr />
        </div>
      ))}
    </>
  );
}

function DuplicatePhrase({
  source,
  fromOthers,
}: {
  source: string;
  fromOthers: string[];
}) {
  const { phrases } = useOutletContext<OutletContext>();
  const [deletedNotes, setDeletedNotes] = useState<Set<number>>(new Set());

  const otherPhrases = phrases.filter(
    (phrase) => phrase.source !== source && fromOthers.includes(phrase.source),
  );

  const other = new Set(otherPhrases.map((phrase) => phrase.traditional));

  const filtered = phrases
    .filter(
      (phrase) => phrase.source === source && other.has(phrase.traditional),
    )
    .filter((phrase) => !deletedNotes.has(phrase.noteId));

  if (filtered.length === 0) {
    return undefined;
  }

  // Check for meaning substring matches
  const meaningSubstringMatches = filtered.filter((phrase) => {
    const otherVariants = otherPhrases.filter(
      (p) => p.traditional === phrase.traditional,
    );

    // Split source meaning by comma and check if all parts appear in other translations
    const sourceParts = phrase.meaning
      .toLowerCase()
      .split(",")
      .map((part) => part.trim());

    return otherVariants.some((variant) => {
      const variantMeaning = variant.meaning.toLowerCase();

      // Check if the entire source meaning is a substring
      if (variantMeaning.includes(phrase.meaning.toLowerCase())) {
        return true;
      }

      // Check if all source parts appear in the variant meaning
      return (
        sourceParts.length > 1 &&
        sourceParts.every(
          (part) => part.length > 0 && variantMeaning.includes(part),
        )
      );
    });
  });

  // Sort filtered to show meaning matches first
  const sortedFiltered = [
    ...meaningSubstringMatches,
    ...filtered.filter((phrase) => !meaningSubstringMatches.includes(phrase)),
  ];

  const handleDeleteNote = async (
    noteId: number,
    traditional: string,
    isMeaningSubstring: boolean = false,
  ) => {
    if (
      isMeaningSubstring ||
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

  return (
    <>
      <h3 className="font-serif text-3xl">
        Duplicate phrase ({filtered.length}):
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 mt-4 table-fixed">
          <colgroup>
            <col className="w-32" />
            <col className="w-80" />
            <col className="w-auto" />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                Traditional
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                Source Translation
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
                Other Translations
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((phrase, i) => {
              const otherVariants = otherPhrases.filter(
                (p) => p.traditional === phrase.traditional,
              );

              const hasPinyinMismatch = otherVariants.some(
                (variant) => variant.pinyin !== phrase.pinyin,
              );

              const isMeaningSubstring =
                meaningSubstringMatches.includes(phrase);

              return (
                <tr
                  key={i}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 h-32 ${
                    hasPinyinMismatch
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : ""
                  }`}
                >
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium align-top">
                    <div className="flex flex-col gap-2 h-full justify-between">
                      <div>{phrase.traditional}</div>
                      <button
                        className="rounded-xl bg-gray-100 dark:bg-gray-900 px-2 py-1 text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors self-start"
                        onClick={async () => {
                          await ankiOpenBrowse(
                            `Traditional:${phrase.traditional} -is:new -is:suspended`,
                          );
                        }}
                      >
                        All notes
                      </button>
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 align-top">
                    <div className="text-sm h-full flex flex-col justify-between">
                      <div>
                        <div className="font-medium">
                          {source}: <PhraseMeaning meaning={phrase.meaning} />
                          {isMeaningSubstring && " ✅"}
                        </div>
                        <div
                          className={`${
                            hasPinyinMismatch
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {hasPinyinMismatch && "⚠️ "}
                          {phrase.pinyin}
                          {hasPinyinMismatch && " ❗"}
                        </div>
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button
                          className="rounded-xl bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          onClick={async () => {
                            await ankiOpenBrowse(
                              `Traditional:${phrase.traditional} note:${source}`,
                            );
                          }}
                        >
                          anki
                        </button>
                        <button
                          className="rounded-xl bg-red-100 dark:bg-red-900 px-2 py-1 text-xs text-red-500 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          onClick={() =>
                            handleDeleteNote(
                              phrase.noteId,
                              phrase.traditional,
                              isMeaningSubstring,
                            )
                          }
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 align-top">
                    <div className="h-full flex flex-col justify-between">
                      <div>
                        {otherVariants.map((variant, j) => {
                          const isPinyinDifferent =
                            variant.pinyin !== phrase.pinyin;
                          return (
                            <div key={j} className="text-sm mb-2 last:mb-0">
                              <div className="font-medium">
                                {variant.source}:{" "}
                                <PhraseMeaning meaning={variant.meaning} />
                              </div>
                              <div
                                className={`${
                                  isPinyinDifferent
                                    ? "text-red-600 dark:text-red-400 font-semibold"
                                    : "text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                {isPinyinDifferent && "⚠️ "}
                                {variant.pinyin}
                                {isPinyinDifferent && " ❗"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        className="rounded-xl bg-green-100 dark:bg-green-900 px-2 py-1 text-xs text-green-500 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors mt-1 self-start"
                        onClick={async () => {
                          const otherSources = otherVariants
                            .map((v) => v.source)
                            .join(" OR note:");
                          await ankiOpenBrowse(
                            `Traditional:${phrase.traditional} (note:${otherSources})`,
                          );
                        }}
                      >
                        anki
                      </button>
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

function LowerCasePinyin() {
  const { phrases, characters } = useOutletContext<OutletContext>();
  const filtered1 = phrases.filter(
    (phrase) => phrase.pinyin !== phrase.pinyin.toLowerCase(),
  );
  const filtered2 = Object.values(characters).filter(
    (char) =>
      char.pinyin[0].pinyinAccented !==
        char.pinyin[0].pinyinAccented.toLowerCase() ||
      char.pinyin[1]?.pinyinAccented !==
        char.pinyin[1]?.pinyinAccented?.toLowerCase(),
  );
  if (filtered1.length === 0 && filtered2.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Lowercase pinyin:</h3>
      {filtered1.map((phrase, i) => (
        <div key={i}>
          Not lower case pinyin: {phrase.source} {phrase.traditional}
          {phrase.pinyin}
        </div>
      ))}
      {filtered2.map((char, i) => (
        <div key={i}>Not lowercase pinyin for char: {char.traditional}</div>
      ))}
    </>
  );
}

function MissingActorNotes() {
  const [actorNotes, setActorNotes] = useState<Set<string> | undefined>(
    undefined,
  );

  useEffect(() => {
    const load = async () => {
      const notesId = await anki.note.findNotes({
        query: "note:Actors",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });
      const as: Set<string> = new Set();
      for (const note of notes) {
        as.add(note.fields["Front"].value);
      }
      setActorNotes(as);
    };
    load();
  }, []);

  if (!actorNotes) {
    return <div>Loading...</div>;
  }
  const filtered = Object.entries(ACTOR_TAGS_MAP).filter(
    ([prefix]) => !actorNotes.has(prefix),
  );
  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Missing actor notes:</h3>
      {filtered.map(([prefix, actor]) => (
        <div key={prefix}>
          🚨 Missing: {prefix} {actor}
        </div>
      ))}
    </>
  );
}

function MixedSuspension({
  noteType,
  notesByCards,
}: {
  noteType: string;
  notesByCards: NoteWithCards[];
}) {
  const myNotes = notesByCards
    .filter((note) => note.modelName === noteType)
    .map((note) => ({
      ...note,
      suspendedCards: note.cardDetails.filter(
        (c) =>
          c.queue === -1 &&
          !note.tags.includes(
            `card-${CARDS_INFO[noteType][c.ord]["name"]}-ignored-on-purpose`,
          ),
      ).length,
      regularCards: note.cardDetails.filter((c) => c.queue !== -1).length,
    }))
    .filter((note) => note.suspendedCards > 0 && note.regularCards > 0);

  if (myNotes.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Mixed suspension {noteType}:</h3>
      {myNotes.map((note, i) => (
        <div key={i}>
          🚨 Mixed suspension {note.noteId} |{note.regularCards}|
          {note.suspendedCards} {note.fields["Traditional"].value}
          <button
            className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            onClick={async () => {
              await ankiOpenBrowse(
                `note:${noteType} ID:${note.fields["ID"].value}`,
              );
            }}
          >
            anki
          </button>
        </div>
      ))}
    </>
  );
}

function ListeningDuplicatePinyin({
  notesByCards,
}: {
  notesByCards: NoteWithCards[];
}) {
  const seen: { [key: string]: string } = {};
  const duplicate = [];
  for (const note of notesByCards) {
    for (const card of note.cardDetails) {
      if (
        card.deckName !== "Listening" ||
        card.queue === -1 ||
        card.due === 0
      ) {
        continue;
      }
      const pinyin = note.fields["Pinyin"]?.value;
      const traditional = note.fields["Traditional"]?.value;
      if (!pinyin || !traditional) {
        console.error("Note with missing pinyin or traditional", note);
        continue;
      }
      if (seen[pinyin] !== undefined && seen[pinyin] !== traditional) {
        duplicate.push(`${pinyin} - ${traditional} != ${seen[pinyin]}`);
      }
      seen[pinyin] = traditional;
    }
  }

  if (duplicate.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Issues with pinyin and listening:</h3>
      {duplicate.map((note, i) => (
        <div key={i}>Duplicate pinyin: {note}</div>
      ))}
    </>
  );
}

function CorrectDeck({ notesByCards }: { notesByCards: NoteWithCards[] }) {
  return (
    <>
      {notesByCards.map((note, i) => {
        return (
          <div key={i}>
            {note.cardDetails.map((card, j) => {
              if (
                CARDS_INFO[note.modelName] &&
                CARDS_INFO[note.modelName][card.ord] &&
                CARDS_INFO[note.modelName][card.ord].deck === card.deckName
              ) {
                return undefined;
              }
              if (card.deckName === "Chinese forgot cards today") {
                return undefined;
              }
              if (card.deckName === "Custom Study Session") {
                return undefined;
              }
              const id =
                note.fields["ID"]?.value ||
                note.fields["Traditional"]?.value ||
                note.fields["Hanzi"]?.value;
              return (
                <div key={j}>
                  Incorrect deck: {note.modelName} {card.ord} {id} !=={" "}
                  {card.deckName}
                  <button
                    className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    onClick={async () => {
                      await ankiOpenBrowse(
                        `note:${note.modelName} deck:${card.deckName} ${id}`,
                      );
                    }}
                  >
                    anki
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function IntegrityPinyinZhuyinConsistency() {
  const { phrases } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = useMemo(
    () =>
      phrases
        .filter((phrase) => phrase.zhuyin && phrase.pinyin)
        .map((phrase) => {
          let expectedZhuyin = "";
          try {
            expectedZhuyin = pinyinToZhuyin(
              phrase.pinyin.replaceAll("<div>", "").replaceAll("</div>", ""),
            )
              .map((x) => (Array.isArray(x) ? x.join("") : x))
              .map((x) => (x?.startsWith("˙") ? x.substring(1) + x[0] : x))
              .join("");
          } catch (error) {
            console.warn(
              "Failed to convert pinyin to zhuyin:",
              phrase.pinyin,
              error,
            );
            return null;
          }

          const actualZhuyin = phrase.zhuyin
            ?.trim()
            .replaceAll("?", "")
            .replaceAll("'", "")
            .replaceAll(",", "")
            .replaceAll(/\s/g, "");
          const isConsistent = actualZhuyin === expectedZhuyin;

          return {
            ...phrase,
            expectedZhuyin,
            isConsistent,
          };
        })
        .filter(
          (phrase): phrase is NonNullable<typeof phrase> =>
            phrase !== null && !phrase.isConsistent,
        ),
    [phrases],
  );

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
            <div className="font-medium">{phrase.traditional}</div>
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

function IntegrityCharacterZhuyin() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = useMemo(
    () =>
      Object.values(characters)
        .filter(
          (char) =>
            char.ankiId && char.pinyinAnki && char.pinyinAnki.length > 0,
        )
        .map((char) => {
          let expectedZhuyin = "";
          try {
            expectedZhuyin = pinyinToZhuyin(char.pinyin[0].pinyinAccented)
              .map((x) => (Array.isArray(x) ? x.join("") : x))
              .map((x) => (x?.startsWith("˙") ? x.substring(1) + x[0] : x))
              .join("");
          } catch (error) {
            console.warn(
              "Failed to convert character pinyin to zhuyin:",
              char.pinyin[0].pinyinAccented,
              error,
            );
            return null;
          }

          const actualZhuyin = char.zhuyinAnki?.[0]?.trim();
          const isConsistent = actualZhuyin === expectedZhuyin;

          return {
            ...char,
            expectedZhuyin,
            isConsistent,
          };
        })
        .filter(
          (char): char is NonNullable<typeof char> =>
            char !== null && !char.isConsistent,
        ),
    [characters],
  );

  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">
        Character Zhuyin Inconsistency Issues:{" "}
        <button
          className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            setProgress({ current: 0, total: filtered.length });

            for (let i = 0; i < filtered.length; i++) {
              const char = filtered[i];
              setProgress({ current: i + 1, total: filtered.length });

              await anki.note.updateNoteFields({
                note: {
                  id: char.ankiId || 0,

                  fields: { Zhuyin: char.expectedZhuyin },
                },
              });
            }

            setIsProcessing(false);
            alert("Fixed all character zhuyin inconsistencies!");
          }}
        >
          {isProcessing ? "Processing..." : "Fix all zhuyin!"}
        </button>
        {isProcessing && (
          <div className="mt-2">
            <progress
              className="w-full h-2"
              value={progress.current}
              max={progress.total}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {progress.current} / {progress.total} characters
            </div>
          </div>
        )}
      </h3>

      <div className="mx-4">
        {filtered.map((char, i) => (
          <div key={i} className="border-b py-2">
            <CharCardDetails char={char} />
            <div className="text-sm">
              Current Zhuyin:{" "}
              <span className="text-red-500">
                {char.zhuyinAnki?.[0] || "(empty)"}
              </span>
            </div>
            <div className="text-sm">
              Expected Zhuyin:{" "}
              <span className="text-green-500">{char.expectedZhuyin}</span>
            </div>
            <button
              className="rounded-2xl px-2 py-1 mt-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 hover:bg-green-300 dark:hover:bg-green-700 transition-colors text-sm"
              onClick={async () => {
                await anki.note.updateNoteFields({
                  note: {
                    id: char.ankiId || 0,

                    fields: { Zhuyin: char.expectedZhuyin },
                  },
                });
                alert("Fixed!");
              }}
            >
              Fix zhuyin field
            </button>
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`Traditional:${char.traditional}`);
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

// Configuration for continuous progress bar
const PROGRESS_STAGE_CONFIG = {
  "Finding notes...": { start: 0, end: 1 },
  "Loading notes...": { start: 1, end: 20 },
  "Loading cards...": { start: 20, end: 100 },
} as const;

export const IntegrityEverything: React.FC<{}> = ({}) => {
  const { progressPercentage, stage, loading, error, notesByCards } =
    useAnkiCards("-is:suspended");

  return (
    <>
      <section className="block m-4">
        <IntegrityActorPlaceAnki />
      </section>
      <section className="block m-4">
        <IntegrityPropNames />
      </section>
      <section className="block m-4">
        <MissingActorNotes />
      </section>
      <section className="block m-4">
        <LowerCasePinyin />
      </section>
      <section className="block m-4">
        <IntegrityPinyinZhuyinConsistency />
      </section>
      <section className="block m-4">
        <IntegrityCharacterZhuyin />
      </section>
      <section className="block m-4">
        <DuplicatePhrase source="MyWords" fromOthers={["TOCFL"]} />
        <DuplicatePhrase source="Dangdai" fromOthers={["TOCFL", "MyWords"]} />
      </section>

      <section className="block m-4">
        {loading ? (
          <LoadingProgressBar
            stage={stage}
            progressPercentage={progressPercentage}
            stageConfig={PROGRESS_STAGE_CONFIG}
          />
        ) : undefined}
        {error ? <div>error loading cards: {error}</div> : undefined}
      </section>
      {!loading && (
        <section className="block m-4">
          <MixedSuspension noteType="TOCFL" notesByCards={notesByCards} />
          <MixedSuspension noteType="Hanzi" notesByCards={notesByCards} />
          <MixedSuspension noteType="MyWords" notesByCards={notesByCards} />
        </section>
      )}
      {!loading && (
        <section className="block m-4">
          <CorrectDeck notesByCards={notesByCards} />
        </section>
      )}
      {!loading && (
        <section className="block m-4">
          <ListeningDuplicatePinyin notesByCards={notesByCards} />
        </section>
      )}
    </>
  );
};
