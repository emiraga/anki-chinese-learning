import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import anki, { ankiOpenBrowse, type NoteInfo } from "~/apis/anki";
import { useEffect, useState } from "react";
import { TagList } from "./TagList";
import { HanziCardDetails } from "./HanziText";
import { Collapsible } from "@base-ui-components/react/collapsible";
import styles from "./index.module.css";
import { PhraseLink } from "./Phrase";
import { TBCL_NEXT_LEVEL, TOCFL_NEXT_LEVEL } from "~/data/status";
import AnkiAudioPlayer from "./AnkiAudioPlayer";
import { POSList } from "./POSDisplay";
import { formatMeaningAsBullets } from "~/utils/text";
import { useSettings } from "~/settings/SettingsContext";
import { useLanguage } from "~/i18n/i18n";

// Lesson counts per Dangdai book, used to populate the lesson selector.
const DANGDAI_BOOK_LESSONS: Record<number, number> = {
  1: 15,
  2: 15,
  3: 12,
  4: 12,
  5: 10,
  6: 10,
};

// Build the Anki lesson-tag suffix for a book/lesson selection.
// lesson 0 -> every lesson in the book ("B2L*"); a specific lesson is
// zero-padded to match the note ID convention ("B2L05*").
function dangdaiTagSuffix(book: number, lesson: number): string {
  if (!lesson) return `B${book}L*`;
  return `B${book}L${String(lesson).padStart(2, "0")}*`;
}

// Persisted Book + Lesson selector driving the "next level" Dangdai phrases.
// The choice lives in settings (localStorage), so it is restored on reopen.
function DangdaiNextLevel() {
  const { settings, updateSettings } = useSettings();
  const { t } = useLanguage();
  const book = settings.dangdaiSelection?.book ?? 2;
  const lesson = settings.dangdaiSelection?.lesson ?? 0;

  const setSelection = (next: { book?: number; lesson?: number }) =>
    updateSettings({
      dangdaiSelection: { book, lesson, ...next },
    });

  const lessonCount = DANGDAI_BOOK_LESSONS[book] ?? 15;
  const suffix = dangdaiTagSuffix(book, lesson);

  return (
    <section className="block m-4">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="font-serif text-3xl">
          {t("Next level phrases Dangdai")} {suffix}
        </h3>
        <label className="text-sm">
          {t("Book")}{" "}
          <select
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5"
            value={book}
            onChange={(e) =>
              // Reset lesson to "all" when switching book, since lesson
              // numbers are not comparable across books.
              setSelection({ book: Number(e.target.value), lesson: 0 })
            }
          >
            {Object.keys(DANGDAI_BOOK_LESSONS).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("Lesson")}{" "}
          <select
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5"
            value={lesson}
            onChange={(e) => setSelection({ lesson: Number(e.target.value) })}
          >
            <option value={0}>{t("All")}</option>
            {Array.from({ length: lessonCount }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SearchMorePhrases
        noteTypes={["TOCFL"]}
        withTags={["Dangdai::Lesson::" + suffix]}
        filterKnownChars={false}
      />
    </section>
  );
}

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
                __html: formatMeaningAsBullets(note.fields["Meaning"]?.value ?? ""),
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
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-800 dark:text-blue-100 p-1 mx-2 inline text-xs text-blue-500"
              onClick={async () => {
                await ankiOpenBrowse(
                  `note:${note.modelName} Traditional:${note.fields["Traditional"]?.value}`,
                );
              }}
            >
              anki
            </button>
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
                setPhrases((phrases) =>
                  phrases?.filter((phrase) => phrase.noteId !== note.noteId),
                );
              }}
            >
              enable
            </button>
            <POSList posString={note.fields["POS"]?.value || ""} />
            <span
              className="ml-2"
              dangerouslySetInnerHTML={{
                __html: formatMeaningAsBullets(note.fields["Meaning"]?.value ?? ""),
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
      <DangdaiNextLevel />
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
