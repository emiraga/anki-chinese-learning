import anki, {
  ankiOpenBrowse,
  useAnkiCards,
  type NoteWithCards,
} from "~/apis/anki";
import { ACTOR_TAGS_MAP } from "~/data/pinyin_table";
import { useEffect, useState } from "react";
import { CARDS_INFO } from "~/data/cards";
import { LoadingProgressBar } from "./LoadingProgressBar";

/**
 * Integrity checks that require fetching all cards/decks from Anki.
 *
 * Checks that only depend on already-loaded state (characters, phrases, props)
 * have been migrated to the `/conflicts` and `/phrase_conflicts` pages. See
 * `~/data/integrity_checks`, `~/components/CharConflictSections` and
 * `~/components/PhraseConflictSections`.
 */

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
        card.deckName !== "zListening" ||
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

function IntegrityFilteredDecks() {
  const [filteredDecks, setFilteredDecks] = useState<
    { name: string; cardCount: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const deckNames = await anki.deck.deckNames();
        const deckConfigs = await Promise.all(
          deckNames.map(async (name) => {
            try {
              const config = (await anki.deck.getDeckConfig({
                deck: name,
              })) as {
                dyn: boolean | number;
                terms?: [string, number, number][];
              };
              return { name, config };
            } catch {
              return { name, config: null };
            }
          }),
        );

        const targetFilteredDecks = deckConfigs.filter(({ config }) => {
          if (!config || !config.dyn) return false;
          // Check if any of the terms (queries) target Chinese
          const terms = config.terms || [];
          return terms.some((term) => {
            const query = term[0] || "";
            return query.includes("Chinese");
          });
        });

        const decksWithCards = await Promise.all(
          targetFilteredDecks.map(async ({ name }) => {
            const cards = await anki.card.findCards({
              query: `deck:"${name}"`,
            });
            return { name, cardCount: cards.length };
          }),
        );

        setFilteredDecks(decksWithCards.filter((d) => d.cardCount > 0));
      } catch (e) {
        console.error("Failed to fetch filtered decks", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading || filteredDecks.length === 0) return null;

  return (
    <>
      <h3 className="font-serif text-3xl">
        Cards in filtered decks (Chinese):
      </h3>
      <div className="mx-4">
        {filteredDecks.map(({ name, cardCount }) => (
          <div key={name} className="mb-2">
            🚨 {cardCount} cards in filtered deck: <strong>{name}</strong>
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`deck:"${name}"`);
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
        <MissingActorNotes />
      </section>

      <section className="block m-4">
        <IntegrityFilteredDecks />
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
