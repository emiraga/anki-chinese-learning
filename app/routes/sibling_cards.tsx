import { useMemo } from "react";
import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";
import { ankiOpenBrowse, useAnkiCards, type NoteWithCards } from "~/apis/anki";
import { LoadingProgressBar } from "~/components/LoadingProgressBar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sibling Cards" },
    {
      name: "description",
      content: "Find overlapping cards scheduled same day",
    },
  ];
}

const PROGRESS_STAGE_CONFIG = {
  "Finding notes...": { start: 0, end: 1 },
  "Loading notes...": { start: 1, end: 20 },
  "Loading cards...": { start: 20, end: 100 },
} as const;

interface OverlapGroup {
  dueDate: number;
  cards: {
    note: NoteWithCards;
    traditional: string;
    deckName: string;
    cardId: number;
  }[];
}

function findSubstringOverlaps(
  notesByCards: NoteWithCards[],
  minDaysInFuture: number,
): OverlapGroup[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Collect all cards with their Traditional field and due date
  var cardsWithTraditional: {
    note: NoteWithCards;
    queue: number;
    traditional: string;
    dueDate: number;
    deckName: string;
    cardId: number;
  }[] = [];

  for (const note of notesByCards) {
    const traditional = note.fields["Traditional"]?.value;
    if (!traditional) continue;

    for (const card of note.cardDetails) {
      // Only include review cards (queue === 2)
      // Other queues have different due formats:
      // - queue -1: suspended
      // - queue 0: new (due is position in queue)
      // - queue 1: learning (due is Unix timestamp in seconds)
      // - queue 3: day-learning (due is Unix timestamp in seconds)
      if (card.queue !== 2) continue;

      // Only include cards due 3+ days in the future
      // if (card.due > minDueDate) continue;

      cardsWithTraditional.push({
        note,
        traditional,
        queue: card.queue,
        dueDate: card.due,
        deckName: card.deckName,
        cardId: card.cardId,
      });
    }
  }

  const todayTimestamp = Math.min(
    ...cardsWithTraditional.map((card) => card.dueDate),
  );
  cardsWithTraditional = cardsWithTraditional
    .map((card) => ({ ...card, dueDate: card.dueDate - todayTimestamp }))
    .filter((card) => card.dueDate >= minDaysInFuture);

  // Group by due date
  const byDueDate = new Map<number, typeof cardsWithTraditional>();
  for (const card of cardsWithTraditional) {
    const existing = byDueDate.get(card.dueDate) || [];
    existing.push(card);
    byDueDate.set(card.dueDate, existing);
  }

  // Find overlaps within each due date group
  const overlaps: OverlapGroup[] = [];

  for (const [dueDate, cards] of byDueDate) {
    if (cards.length < 2) continue;

    // Find cards where one Traditional is substring of another
    const overlappingCards: typeof cards = [];
    const seen = new Set<number>();

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].traditional;
        const b = cards[j].traditional;

        // Skip if they're the same
        if (a === b) continue;

        // Check if one is substring of the other
        if (a.includes(b) || b.includes(a)) {
          if (!seen.has(cards[i].cardId)) {
            overlappingCards.push(cards[i]);
            seen.add(cards[i].cardId);
          }
          if (!seen.has(cards[j].cardId)) {
            overlappingCards.push(cards[j]);
            seen.add(cards[j].cardId);
          }
        }
      }
    }

    if (overlappingCards.length > 0) {
      overlaps.push({ dueDate, cards: overlappingCards });
    }
  }

  // Sort by due date
  overlaps.sort((a, b) => a.dueDate - b.dueDate);

  return overlaps;
}

function formatDueDate(dueDate: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dueDate);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SiblingCardsReport({
  notesByCards,
  minDaysInFuture,
}: {
  notesByCards: NoteWithCards[];
  minDaysInFuture: number;
}) {
  const overlaps = useMemo(
    () => findSubstringOverlaps(notesByCards, minDaysInFuture),
    [notesByCards, minDaysInFuture],
  );

  if (overlaps.length === 0) {
    return (
      <div className="text-green-600 dark:text-green-400">
        No overlapping cards found scheduled for the same day ({minDaysInFuture}
        + days out).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl">
        Found {overlaps.length} days with overlapping cards
      </h2>

      {overlaps.map((group) => (
        <div
          key={group.dueDate}
          className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
        >
          <h3 className="font-semibold text-lg mb-3">
            Due: {formatDueDate(group.dueDate)} ({group.cards.length} cards)
          </h3>

          <div className="space-y-2">
            {group.cards.map((card) => (
              <div
                key={card.cardId}
                className="flex items-center gap-3 text-sm"
              >
                <span className="font-medium text-xl">{card.traditional}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {card.note.modelName}
                </span>
                <span className="text-gray-400 dark:text-gray-500">
                  {card.deckName}
                </span>
                <button
                  className="rounded-xl bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  onClick={async () => {
                    await ankiOpenBrowse(`cid:${card.cardId}`);
                  }}
                >
                  anki
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SiblingCards() {
  const { progressPercentage, stage, loading, error, notesByCards } =
    useAnkiCards("-is:suspended");

  const minDaysInFuture = 7;

  return (
    <MainFrame>
      <section className="block m-4">
        <h1 className="font-serif text-3xl mb-4">Sibling Cards</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Cards with overlapping Traditional fields (substring matches)
          scheduled for the same day, {minDaysInFuture}+ days in the future.
        </p>

        {loading && (
          <LoadingProgressBar
            stage={stage}
            progressPercentage={progressPercentage}
            stageConfig={PROGRESS_STAGE_CONFIG}
          />
        )}

        {error && (
          <div className="text-red-500">Error loading cards: {error}</div>
        )}

        {!loading && !error && (
          <SiblingCardsReport
            minDaysInFuture={minDaysInFuture}
            notesByCards={notesByCards}
          />
        )}
      </section>
    </MainFrame>
  );
}
