import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import anki, { type NoteInfo } from "~/apis/anki";
import { useEffect, useState } from "react";
import { Collapsible } from "@base-ui-components/react/collapsible";
import styles from "./index.module.css";
import { PhraseLink, PhraseList } from "./Phrase";
import { phraseFromNote } from "~/data/phrases";
import {
  DANGDAI_NEXT_LEVEL,
  TBCL_NEXT_LEVEL,
  TOCFL_NEXT_LEVEL,
} from "~/data/status";

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
            🚨 TODO:{" "}
            <PhraseLink value={note.fields["Traditional"]?.value || ""} /> -{" "}
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

export function PhraseSearchSections({
  noteTypes,
  search,
}: {
  noteTypes: string[];
  search: string;
}) {
  return (
    <>
      <hr className="my-4" />
      <h2 className="text-2xl">More phrases:</h2>
      <SearchMorePhrases noteTypes={noteTypes} search={search} />
    </>
  );
}

function SearchMorePhrases({
  noteTypes,
  withTags,
  search,
  filterKnownChars,
}: {
  noteTypes: string[];
  withTags?: string[];
  search?: string;
  filterKnownChars?: boolean;
}) {
  const { characters } = useOutletContext<OutletContext>();
  const [phrases, setPhrases] = useState<NoteInfo[] | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      var query = `(${noteTypes
        .map((name) => "note:" + name)
        .join(" OR ")}) card:0 (is:new OR is:suspended)`;
      if (search) {
        query += ` Traditional:*${search}*`;
      }
      if (withTags) {
        query += ` (${withTags.map((t) => `tag:${t}`).join(" OR ")})`;
      }
      console.log(query);
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

      // Sort by tag categories: no prefix, TOCFL::, Dangdai::, TBCL::
      const tagPrefixOrder = ["", "TOCFL::", "Dangdai::", "TBCL::"];
      notes.sort((a, b) => {
        const getTagSortKey = (tags: string[]) => {
          for (let i = 1; i < tagPrefixOrder.length; i++) {
            const prefix = tagPrefixOrder[i];
            const matchingTag = tags.find((t) => t.startsWith(prefix));
            if (matchingTag) {
              return {
                prefixIndex: i,
                suffix: matchingTag.slice(prefix.length),
              };
            }
          }
          return { prefixIndex: 0, suffix: "" };
        };

        const keyA = getTagSortKey(a.tags);
        const keyB = getTagSortKey(b.tags);

        if (keyA.prefixIndex !== keyB.prefixIndex) {
          return keyA.prefixIndex - keyB.prefixIndex;
        }
        return keyA.suffix.localeCompare(keyB.suffix);
      });

      setPhrases(notes);
    };
    load();
  }, [
    characters,
    filterKnownChars,
    noteTypes,
    search,
    withTags,
  ]);

  if (!phrases) {
    return <div>Loading...</div>;
  }

  return (
    <PhraseList
      phrases={phrases.map(phraseFromNote)}
      actions={(phrase) => (
        <button
          className="rounded-2xl bg-green-100 dark:bg-green-800 dark:text-green-100 p-1 inline text-xs text-green-500"
          onClick={async () => {
            const cards = phrases.find((n) => n.noteId === phrase.noteId)?.cards;
            if (!cards) {
              throw new Error(`Note ${phrase.noteId} not found`);
            }
            await anki.card.unsuspend({ cards });
            await anki.card.setDueDate({ cards, days: "0" });
            setPhrases((phrases) =>
              phrases?.filter((n) => n.noteId !== phrase.noteId),
            );
          }}
        >
          enable
        </button>
      )}
    />
  );
}

export const MorePhrases: React.FC<{}> = ({}) => {
  return (
    <>
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
              Next level phrases TOCFL::{TOCFL_NEXT_LEVEL} ... (expandable)
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
              noteTypes={["TOCFL"]}
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
              Next level phrases TBCL::{TBCL_NEXT_LEVEL} ... (expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <SearchMorePhrases
              noteTypes={["TOCFL"]}
              withTags={["TBCL::" + TBCL_NEXT_LEVEL]}
              filterKnownChars={false}
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </section>
    </>
  );
};
