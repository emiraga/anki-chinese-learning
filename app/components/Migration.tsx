import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "./CharCard";
import anki, {
  ankiOpenBrowse,
  useAnkiCards,
  type NoteWithCards,
} from "~/apis/anki";
import {
  ACTOR_TAGS_MAP,
  LOCATION_TAGS_MAP,
  PLACE_TAGS_MAP,
  REVERSE_FULL_MAP,
} from "~/data/pinyin_table";
import { PropCard } from "./PropCard";
import { useEffect, useState } from "react";
import { CARDS_INFO } from "~/data/cards";
import pinyinToZhuyin from "zhuyin-improved";

function MigrationColorsInAnki() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const filtered = Object.values(characters)
    .filter((char) => char.pinyinAnki !== undefined)
    .map((char) => {
      var e = char.pinyin[0].pinyinAccented;
      if (char.pinyin[0].tone === 1) {
        e =
          '<span style="color: rgb(255, 0, 0);">' +
          char.pinyin[0].pinyinAccented +
          "</span>";
      } else if (char.pinyin[0].tone === 2) {
        e =
          '<span style="color: rgb(0, 170, 0);">' +
          char.pinyin[0].pinyinAccented +
          "</span>";
      } else if (char.pinyin[0].tone === 3) {
        e =
          '<span style="color: rgb(0, 0, 255);">' +
          char.pinyin[0].pinyinAccented +
          "</span>";
      } else if (char.pinyin[0].tone === 4) {
        e =
          '<span style="color: rgb(170, 0, 255);">' +
          char.pinyin[0].pinyinAccented +
          "</span>";
      }
      return { ...char, expectedPinyin: e };
    })
    .filter(
      (char) =>
        char.withSound && char.expectedPinyin !== (char.pinyinAnki || [""])[0]
    );
  if (filtered.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">
        Migration of colors:{" "}
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
                  fields: { Pinyin: char.expectedPinyin },
                },
              });
            }

            setIsProcessing(false);
            alert("Fixed all!");
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

      <div className="mx-4">
        {filtered.map((char, i) => (
          <div key={i}>
            <hr />
            <CharCardDetails char={char} />
            {char.expectedPinyin} ||| {char.pinyin[0].pinyinAccented}
            {char.ankiId ? (
              <button
                className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                onClick={async () => {
                  await anki.note.updateNoteFields({
                    note: {
                      id: char.ankiId || 0,
                      fields: { Pinyin: char.expectedPinyin },
                    },
                  });
                  alert("Fixed!");
                }}
              >
                Auto-fix!
              </button>
            ) : undefined}
          </div>
        ))}
      </div>
    </>
  );
}

function MigrationActorPlaceAnki() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = Object.values(characters)
    .filter((char) => char.pinyinAnki !== undefined)
    .map((char) => {
      if (REVERSE_FULL_MAP[char.pinyin[0].sylable] === undefined) {
        console.error(char.pinyin[0].sylable);
        console.error(Object.keys(REVERSE_FULL_MAP));
        throw new Error("REVERSE_FULL_MAP[char.sylable] === undefined");
      }
      const { initial, final } = REVERSE_FULL_MAP[char.pinyin[0].sylable] || {
        initial: "???",
        final: "???",
      };
      const needTags: string[] = [];
      if (!char.tags.includes(ACTOR_TAGS_MAP[initial])) {
        needTags.push(ACTOR_TAGS_MAP[initial]);
      }
      if (!char.tags.includes(PLACE_TAGS_MAP[final])) {
        needTags.push(PLACE_TAGS_MAP[final]);
      }
      if (!char.tags.includes(LOCATION_TAGS_MAP[char.pinyin[0].tone])) {
        needTags.push(LOCATION_TAGS_MAP[char.pinyin[0].tone]);
      }

      return { ...char, needTags, initial, final };
    })
    .filter((char) => {
      if (!char.withSound) {
        return false;
      }
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

function MigrationPropNames() {
  const { props } = useOutletContext<OutletContext>();

  const filtered = Object.values(props).filter(
    (prop) => prop.mainTagname !== "prop::" + prop.prop
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

  const other = new Set(
    phrases
      .filter(
        (phrase) =>
          phrase.source !== source && fromOthers.includes(phrase.source)
      )
      .map((phrase) => phrase.traditional)
  );

  const filtered = phrases.filter(
    (phrase) => phrase.source === source && other.has(phrase.traditional)
  );
  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Duplicate phrase:</h3>
      {filtered.map((phrase, i) => {
        return (
          <div key={i}>
            Duplicate {source}: {phrase.traditional}
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`Traditional:${phrase.traditional}`);
              }}
            >
              anki
            </button>
          </div>
        );
      })}
    </>
  );
}

function LowerCasePinyin() {
  const { phrases, characters } = useOutletContext<OutletContext>();
  const filtered1 = phrases.filter(
    (phrase) => phrase.pinyin !== phrase.pinyin.toLowerCase()
  );
  const filtered2 = Object.values(characters).filter(
    (char) =>
      char.pinyin[0].pinyinAccented !==
        char.pinyin[0].pinyinAccented.toLowerCase() ||
      char.pinyin[1]?.pinyinAccented !==
        char.pinyin[1]?.pinyinAccented?.toLowerCase()
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
    undefined
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
    ([prefix]) => !actorNotes.has(prefix)
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
          !note.tags.includes(`card-${c.ord}-ignored-on-purpose`)
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
                `note:${noteType} ID:${note.fields["ID"].value}`
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
                        `note:${note.modelName} deck:${card.deckName} ${id}`
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

function MixedNew({
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
      learningCards: note.cardDetails.filter(
        (c) => c.due !== 0 && c.due < 3000
      ),
      newCards: note.cardDetails.filter(
        (c) =>
          (c.due === 0 || c.due > 3000) &&
          !note.tags.includes(`card-${c.ord}-ignored-on-purpose`)
      ),
    }))
    .filter(
      (note) => note.learningCards.length > 0 && note.newCards.length > 0
    );
  if (myNotes.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Mixed new {noteType}:</h3>
      {myNotes.map((note, i) => (
        <div key={i}>
          🚨 Some are new {noteType} |{note.fields["Traditional"].value}
          <button
            className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            onClick={async () => {
              await ankiOpenBrowse(
                `note:${noteType} ID:${note.fields["ID"].value}`
              );
            }}
          >
            anki
          </button>
          <button
            className="rounded-2xl bg-green-100 dark:bg-green-900 p-1 ml-2 inline text-xs text-green-500 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
            onClick={async () => {
              const newCardIds = note.newCards.map((card) => card.cardId);
              await anki.card.unsuspend({ cards: newCardIds });
              await anki.card.setDueDate({ cards: newCardIds, days: "0" });
              alert("Enabled " + note.fields["Traditional"]?.value);
            }}
          >
            enable
          </button>
        </div>
      ))}
    </>
  );
}

function MigrationPinyinZhuyinConsistency() {
  const { phrases } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = phrases
    .filter((phrase) => phrase.zhuyin && phrase.pinyin)
    .map((phrase) => {
      let expectedZhuyin = "";
      try {
        expectedZhuyin = pinyinToZhuyin(
          phrase.pinyin.replaceAll("<div>", "").replaceAll("</div>", "")
        )
          .map((x) => (Array.isArray(x) ? x.join("") : x))
          .map((x) => (x?.startsWith("˙") ? x.substring(1) + x[0] : x))
          .join("");
      } catch (error) {
        console.warn(
          "Failed to convert pinyin to zhuyin:",
          phrase.pinyin,
          error
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
        phrase !== null && !phrase.isConsistent
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
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  fields: { Zhuyin: "" }, //phrase.expectedZhuyin
                },
              });
            }

            setIsProcessing(false);
            alert("Fixed all zhuyin inconsistencies!");
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
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    fields: { Zhuyin: "" }, //phrase.expectedZhuyin
                  },
                });
                alert("Fixed!");
              }}
            >
              Fix this one
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

export const MigrationEverything: React.FC<{}> = ({}) => {
  const { progressPercentage, stage, loading, error, notesByCards } =
    useAnkiCards();

  return (
    <>
      <section className="block m-4">
        <MigrationColorsInAnki />
      </section>
      <section className="block m-4">
        <MigrationActorPlaceAnki />
      </section>
      <section className="block m-4">
        <MigrationPropNames />
      </section>
      <section className="block m-4">
        <MissingActorNotes />
      </section>
      <section className="block m-4">
        <LowerCasePinyin />
      </section>
      <section className="block m-4">
        <MigrationPinyinZhuyinConsistency />
      </section>
      <section className="block m-4">
        <DuplicatePhrase source="MyWords" fromOthers={["TOCFL"]} />
      </section>

      <section className="block m-4">
        {loading ? (
          <div>
            {stage} {progressPercentage.toFixed(2)}%
          </div>
        ) : undefined}
        {error ? <div>error loading cards: {error}</div> : undefined}
      </section>
      {!loading && (
        <section className="block m-4">
          <MixedNew noteType="TOCFL" notesByCards={notesByCards} />
          {/* <MixedNew noteType="Hanzi" notesByCards={notesByCards} /> */}
        </section>
      )}
      {!loading && (
        <section className="block m-4">
          <MixedSuspension noteType="TOCFL" notesByCards={notesByCards} />
          <MixedSuspension noteType="Hanzi" notesByCards={notesByCards} />
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
