import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "./CharCard";
import anki, {
  useAnkiCards,
  type NoteInfo,
  type NoteWithCards,
} from "~/apis/anki";
import {
  ACTOR_TAGS_MAP,
  FULL_MAP,
  LOCATION_TAGS_MAP,
  PLACE_TAGS_MAP,
} from "~/data/pinyin_table";
import { PropCard } from "./PropCard";
import { useEffect, useState } from "react";
import { CARDS_INFO } from "~/data/cards";

function MigrationColorsInAnki() {
  const { characters } = useOutletContext<OutletContext>();
  const filtered = Object.values(characters)
    .map((char) => {
      var e = char.pinyin;
      if (char.tone === 1) {
        e = '<span style="color: rgb(255, 0, 0);">' + char.pinyin + "</span>";
      } else if (char.tone === 2) {
        e = '<span style="color: rgb(0, 170, 0);">' + char.pinyin + "</span>";
      } else if (char.tone === 3) {
        e = '<span style="color: rgb(0, 0, 255);">' + char.pinyin + "</span>";
      } else if (char.tone === 4) {
        e = '<span style="color: rgb(170, 0, 255);">' + char.pinyin + "</span>";
      }
      return { ...char, expected_pinyin: e };
    })
    .filter(
      (char) => char.withSound && char.expected_pinyin !== char.pinyin_anki_1
    );
  if (filtered.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Migration of colors:</h3>

      <div className="mx-4">
        {filtered.map((char, i) => (
          <div key={i}>
            <hr />
            <CharCardDetails char={char} />
            {char.expected_pinyin} ||| {char.pinyin_anki_1}
            {char.ankiId ? (
              <button
                className="rounded-2xl px-2 py-1 m-1 bg-red-200"
                onClick={async () => {
                  await anki.note.updateNoteFields({
                    note: {
                      id: char.ankiId || 0,
                      fields: { Pinyin: char.expected_pinyin },
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

  const reverseMap: { [key: string]: { initial: string; final: string } } = {};
  Object.entries(FULL_MAP).forEach(([initial, rest]) => {
    Object.entries(rest).forEach(([final, sylable]) => {
      if (sylable.length === 0) {
        return;
      }
      reverseMap[sylable] = { initial, final };
    });
  });

  const filtered = Object.values(characters)
    .map((char) => {
      if (reverseMap[char.sylable] === undefined) {
        console.error(char.sylable);
        console.error(Object.keys(reverseMap));
        throw new Error("reverseMap[char.sylable] === undefined");
      }
      const { initial, final } = reverseMap[char.sylable] || {
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
      if (!char.tags.includes(LOCATION_TAGS_MAP[char.tone])) {
        needTags.push(LOCATION_TAGS_MAP[char.tone]);
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
        Migration of actor, place and tone:
      </h3>
      {filtered.map((char, i) => {
        return (
          <div key={i}>
            <CharCardDetails char={char} />
            {char.initial} {char.final} {char.tone} | {char.tags.join(",")} |
            need tags:
            {char.needTags.join(",")}
            {char.ankiId ? (
              <button
                className="rounded-2xl px-2 py-1 m-1 bg-red-200"
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
    (prop) => prop.main_tagname !== "prop::" + prop.prop
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
          {prop.main_tagname} === {"prop::" + prop.prop}
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
              className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
              onClick={() => {
                anki.graphical.guiBrowse({
                  query: `Traditional:${phrase.traditional}`,
                });
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
      char.pinyin_anki_1 !== char.pinyin_anki_1.toLowerCase() ||
      char.pinyin_anki_2 !== char.pinyin_anki_2.toLowerCase()
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
            className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
            onClick={() => {
              anki.graphical.guiBrowse({
                query: `note:${noteType} ID:${note.fields["ID"].value}`,
              });
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
      const pinyin = note.fields["Pinyin"].value;
      const traditional = note.fields["Traditional"].value;
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
                    className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
                    onClick={() => {
                      anki.graphical.guiBrowse({
                        query: `note:${note.modelName} deck:${card.deckName} ${id}`,
                      });
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
      learningCards: note.cardDetails.filter((c) => c.due !== 0 && c.due < 3000)
        .length,
      newCards: note.cardDetails.filter(
        (c) =>
          (c.due === 0 || c.due > 3000) &&
          !note.tags.includes(`card-${c.ord}-ignored-on-purpose`)
      ).length,
    }))
    .filter((note) => note.learningCards > 0 && note.newCards > 0);
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
            className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
            onClick={() => {
              anki.graphical.guiBrowse({
                query: `note:${noteType} ID:${note.fields["ID"].value}`,
              });
            }}
          >
            anki
          </button>
        </div>
      ))}
    </>
  );
}

export const MigrationEverything: React.FC<{}> = ({}) => {
  const { progressPercentage, stage, loading, error, notesByCards } =
    useAnkiCards();

  return (
    <>
      <button
        className="rounded-2xl border p-1"
        onClick={async () => {
          const noteIds = await anki.note.findNotes({
            query: "note:Dangdai -tag:Dangdai::Lesson",
          });
          const notes: NoteInfo[] = await anki.note.notesInfo({
            notes: noteIds,
          });
          for (const note of notes) {
            const id = note.fields["ID"].value;
            const parts = id.split("-");
            await anki.note.addTags({
              notes: [note.noteId],
              tags: `Dangdai::Lesson::${parts[0]}::${parts[1]}`,
            });
          }
        }}
      >
        migration Dangdai add tags (obsolete)
      </button>
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
