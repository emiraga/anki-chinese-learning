import { useMemo, useState } from "react";
import type { Route } from "./+types/index";
import MainFrame from "~/toolbar/frame";
import {
  ankiOpenBrowse,
  ankiSetDueDate,
  useAnkiCards,
  type NoteWithCards,
} from "~/apis/anki";
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

interface CardInfo {
  note: NoteWithCards;
  traditional: string;
  deckName: string;
  cardId: number;
  dueDate: number; // days from today
}

interface OverlapSubgroup {
  cards: CardInfo[];
}

interface OverlapGroup {
  dueDate: number;
  subgroups: OverlapSubgroup[];
}

// Union-Find data structure for grouping connected cards
class UnionFind {
  private _parent: Map<number, number> = new Map();

  find(x: number): number {
    if (!this._parent.has(x)) {
      this._parent.set(x, x);
    }
    if (this._parent.get(x) !== x) {
      this._parent.set(x, this.find(this._parent.get(x)!));
    }
    return this._parent.get(x)!;
  }

  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this._parent.set(rootX, rootY);
    }
  }
}

function findSubstringOverlaps(
  notesByCards: NoteWithCards[],
  minDaysInFuture: number,
): OverlapGroup[] {
  // Collect all cards with their Traditional field and due date
  let cardsWithTraditional: {
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

  if (cardsWithTraditional.length === 0) return [];

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

    const uf = new UnionFind();
    const cardById = new Map<number, (typeof cards)[0]>();
    const hasOverlap = new Set<number>();

    // Build card lookup and find all overlapping pairs
    for (const card of cards) {
      cardById.set(card.cardId, card);
    }

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].traditional;
        const b = cards[j].traditional;

        // Skip if they're the same
        if (a === b) continue;

        // Check if one is substring of the other
        if (a.includes(b) || b.includes(a)) {
          uf.union(cards[i].cardId, cards[j].cardId);
          hasOverlap.add(cards[i].cardId);
          hasOverlap.add(cards[j].cardId);
        }
      }
    }

    if (hasOverlap.size === 0) continue;

    // Group cards by their root in union-find
    const subgroupsByRoot = new Map<number, CardInfo[]>();
    for (const cardId of hasOverlap) {
      const root = uf.find(cardId);
      const card = cardById.get(cardId)!;
      const existing = subgroupsByRoot.get(root) || [];
      existing.push({
        note: card.note,
        traditional: card.traditional,
        deckName: card.deckName,
        cardId: card.cardId,
        dueDate: card.dueDate,
      });
      subgroupsByRoot.set(root, existing);
    }

    // Convert to subgroups array
    const subgroups: OverlapSubgroup[] = [];
    for (const cards of subgroupsByRoot.values()) {
      // Sort cards within subgroup by traditional length (longer first)
      cards.sort((a, b) => b.traditional.length - a.traditional.length);
      subgroups.push({ cards });
    }

    // Sort subgroups by the first card's traditional field
    subgroups.sort((a, b) =>
      a.cards[0].traditional.localeCompare(b.cards[0].traditional),
    );

    overlaps.push({ dueDate, subgroups });
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

function CardRow({
  card,
  movedDays,
  onMoveEarlier,
}: {
  card: CardInfo;
  movedDays: number;
  onMoveEarlier: () => Promise<void>;
}) {
  const [isMoving, setIsMoving] = useState(false);

  const handleMoveEarlier = async () => {
    setIsMoving(true);
    try {
      await onMoveEarlier();
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-medium text-xl">{card.traditional}</span>
      <span className="text-gray-500 dark:text-gray-400">
        {card.note.modelName}
      </span>
      <span className="text-gray-400 dark:text-gray-500">{card.deckName}</span>
      {movedDays !== 0 && (
        <span className="text-green-600 dark:text-green-400 text-xs">
          ({movedDays > 0 ? `-${movedDays}` : `+${-movedDays}`} day
          {Math.abs(movedDays) !== 1 ? "s" : ""})
        </span>
      )}
      <button
        className="rounded-xl bg-blue-100 dark:bg-blue-900 px-2 py-1 text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        onClick={async () => {
          await ankiOpenBrowse(`cid:${card.cardId}`);
        }}
      >
        anki
      </button>
      <button
        className="rounded-xl bg-orange-100 dark:bg-orange-900 px-2 py-1 text-xs text-orange-600 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors disabled:opacity-50"
        onClick={handleMoveEarlier}
        disabled={isMoving}
      >
        {isMoving ? "..." : "-1 day"}
      </button>
    </div>
  );
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

  // Track how many days each card has been moved (positive = moved earlier)
  const [movedCards, setMovedCards] = useState<Map<number, number>>(new Map());
  const [isMovingAll, setIsMovingAll] = useState(false);

  const moveCardEarlier = async (card: CardInfo) => {
    const movedDays = movedCards.get(card.cardId) || 0;
    const newDueDate = card.dueDate - movedDays;
    await ankiSetDueDate([card.cardId], String(newDueDate));
    setMovedCards((prev) => {
      const next = new Map(prev);
      next.set(card.cardId, (prev.get(card.cardId) || 0) + 1);
      return next;
    });
  };

  const handleMoveRandomFromEachSubgroup = async () => {
    setIsMovingAll(true);
    try {
      for (const group of overlaps) {
        for (const subgroup of group.subgroups) {
          const randomIndex = Math.floor(Math.random() * subgroup.cards.length);
          const card = subgroup.cards[randomIndex];
          await moveCardEarlier(card);
        }
      }
    } finally {
      setIsMovingAll(false);
    }
  };

  if (overlaps.length === 0) {
    return (
      <div className="text-green-600 dark:text-green-400">
        No overlapping cards found scheduled for the same day ({minDaysInFuture}
        + days out).
      </div>
    );
  }

  const totalCards = overlaps.reduce(
    (sum, group) =>
      sum + group.subgroups.reduce((s, sg) => s + sg.cards.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl">
        Found {overlaps.length} days with overlapping cards ({totalCards} cards
        total)
      </h2>

      <button
        className="rounded-xl bg-purple-100 dark:bg-purple-900 px-4 py-2 text-sm text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
        onClick={handleMoveRandomFromEachSubgroup}
        disabled={isMovingAll}
      >
        {isMovingAll ? "Moving..." : "Move random from each subgroup -1 day"}
      </button>

      {overlaps.map((group) => {
        const cardCount = group.subgroups.reduce(
          (sum, sg) => sum + sg.cards.length,
          0,
        );
        return (
          <div
            key={group.dueDate}
            className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
          >
            <h3 className="font-semibold text-lg mb-3">
              Due: {formatDueDate(group.dueDate)} ({cardCount} cards,{" "}
              {group.subgroups.length} groups)
            </h3>

            <div className="space-y-4">
              {group.subgroups.map((subgroup, idx) => (
                <div
                  key={idx}
                  className="border-l-2 border-gray-200 dark:border-gray-700 pl-3 space-y-2"
                >
                  {subgroup.cards.map((card) => (
                    <CardRow
                      key={card.cardId}
                      card={card}
                      movedDays={movedCards.get(card.cardId) || 0}
                      onMoveEarlier={() => moveCardEarlier(card)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
