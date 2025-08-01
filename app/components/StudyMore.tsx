import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import anki, { type NoteInfo } from "~/apis/anki";
import { useEffect, useState } from "react";
import { TagList } from "./TagList";
import { HanziCardDetails } from "./HanziText";
import { Collapsible } from "@base-ui-components/react/collapsible";
import styles from "./index.module.css";
import { PhraseLink } from "./Phrase";
import { DANGDAI_NEXT_LEVEL, TOCFL_NEXT_LEVEL } from "~/data/status";
import AnkiAudioPlayer from "./AnkiAudioPlayer";

function TodoPhrases() {
  const [notes, setNotes] = useState<NoteInfo[] | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const notesId = await anki.note.findNotes({
        query: "tag:TODO Traditional:_*",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });
      setNotes(notes);
    };
    load();
  }, []);

  if (!notes) {
    return <div>Loading...</div>;
  }

  if (notes.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">TODO phrases:</h3>
      {notes.map((note, i) => {
        return (
          <div key={i}>
            🚨 TODO: <PhraseLink value={note.fields["Traditional"]?.value} /> -{" "}
            <span
              dangerouslySetInnerHTML={{
                __html: note.fields["Meaning"]?.value,
              }}
            ></span>
          </div>
        );
      })}
    </>
  );
}

function SuspendedMyWords() {
  const [suspended, setSuspended] = useState<NoteInfo[] | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const notesId = await anki.note.findNotes({
        query: "note:MyWords is:suspended",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });
      setSuspended(notes);
    };
    load();
  }, []);

  if (!suspended) {
    return <div>Loading...</div>;
  }

  if (suspended.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Suspended my words:</h3>
      {suspended.map((note, i) => (
        <div key={i}>
          🚨 Suspended phrase:{" "}
          <PhraseLink value={note.fields["Traditional"].value} /> -{" "}
          {note.fields["Meaning"].value}
        </div>
      ))}
    </>
  );
}

export function SearchMorePhrases({
  noteTypes: noteTypes,
  withTags,
  search,
  filterKnownChars,
  filterUnknownChars,
}: {
  noteTypes: string[];
  withTags?: string[];
  search?: string;
  filterKnownChars?: boolean;
  filterUnknownChars?: boolean;
}) {
  const { characters } = useOutletContext<OutletContext>();
  const [phrases, setPhrases] = useState<NoteInfo[] | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      var query = `(${noteTypes
        .map((name) => "note:" + name)
        .join(" OR ")}) card:0 is:new`;
      if (search) {
        query += ` Traditional:*${search}*`;
      }
      if (withTags) {
        query += ` (${withTags.map((t) => `tag:${t}`).join(" OR ")})`;
      }
      const notesId = await anki.note.findNotes({ query });
      var notes = await anki.note.notesInfo({ notes: notesId });

      if (filterKnownChars) {
        notes = notes.filter((n) => {
          const traditional = n.fields["Traditional"].value;
          for (const c of [...traditional]) {
            if (c === "/" || c === "(" || c === ")" || search?.includes(c)) {
              continue;
            }
            if (characters[c] === undefined || !characters[c].withSound) {
              return false;
            }
          }
          return true;
        });
      }
      if (filterUnknownChars) {
        notes = notes.filter((n) => {
          const traditional = n.fields["Traditional"].value;
          for (const c of [...traditional]) {
            if (c === "/" || c === "(" || c === ")" || search?.includes(c)) {
              continue;
            }
            if (characters[c] === undefined || !characters[c].withSound) {
              return true;
            }
          }
          return false;
        });
      }
      setPhrases(notes);
    };
    load();
  }, [
    characters,
    filterKnownChars,
    filterUnknownChars,
    noteTypes,
    search,
    withTags,
  ]);

  if (!phrases) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {phrases.map((note, i) => {
        return (
          <div key={i}>
            New word:
            <PhraseLink value={note.fields["Traditional"]?.value} />(
            {note.fields["Pinyin"]?.value}
            <AnkiAudioPlayer audioField={note.fields["Audio"]?.value} />
            )
            <TagList tags={note.tags} />
            <button
              className="mx-1 rounded-2xl bg-green-100 dark:bg-green-800 dark:text-green-100 p-1 inline text-xs text-green-500"
              onClick={async () => {
                await anki.card.unsuspend({ cards: note.cards });
                await anki.card.setDueDate({ cards: note.cards, days: "0" });
                alert("Enabled " + note.fields["Traditional"]?.value);
              }}
            >
              enable
            </button>
            <span
              dangerouslySetInnerHTML={{
                __html: note.fields["Meaning"]?.value,
              }}
            ></span>
          </div>
        );
      })}
    </>
  );
}

function NextCharsByFrequency({}: {}) {
  const { characters } = useOutletContext<OutletContext>();
  const [chars, setChars] = useState<NoteInfo[] | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const notesId = await anki.note.findNotes({
        query: "note:Hanzi is:suspended FrequencyRank:__",
      });
      const notes = await anki.note.notesInfo({ notes: notesId });

      setChars(notes);
    };
    load();
  }, []);

  if (!chars) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {chars.map((note) => {
        const c = note.fields["Traditional"].value;
        return (
          <>
            <div>Frequency: {note.fields["FrequencyRank"].value}</div>
            <HanziCardDetails c={c} characters={characters} />
          </>
        );
      })}
    </>
  );
}

export const StudyMore: React.FC<{}> = ({}) => {
  return (
    <>
      <section className="block m-4">
        <SuspendedMyWords />
      </section>
      <section className="block m-4">
        <TodoPhrases />
      </section>
      <section className="block m-4">
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-3xl">
              Known phrases...(expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <SearchMorePhrases
              noteTypes={["TOCFL"]}
              withTags={["TOCFL::L0", "TOCFL::L1"]}
              filterKnownChars={true}
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
      <section className="block m-4">
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-3xl">
              Next level phrases TOCFL {TOCFL_NEXT_LEVEL} ... (expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <SearchMorePhrases
              noteTypes={["TOCFL"]}
              withTags={["TOCFL::" + TOCFL_NEXT_LEVEL]}
              filterKnownChars={false}
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
      <section className="block m-4">
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-3xl">
              Next level phrases Dangdai {DANGDAI_NEXT_LEVEL} ... (expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <SearchMorePhrases
              noteTypes={["Dangdai"]}
              withTags={["Dangdai::Lesson::" + DANGDAI_NEXT_LEVEL]}
              filterKnownChars={false}
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
      <section className="block m-4">
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-3xl">
              Next by frequency...(expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <NextCharsByFrequency />
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
    </>
  );
};
