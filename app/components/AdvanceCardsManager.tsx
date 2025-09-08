import React, { useState, useEffect, useMemo } from "react";
import anki, { type CardInfo, type NoteInfo } from "~/apis/anki";
import { LoadingProgressBar } from "./LoadingProgressBar";

interface FilterOptions {
  noteType?: string;
  deckName?: string;
  tags?: string;
  textFilter?: string;
  dueDateLongerThan?: number;
  intervalLongerThan?: number;
}

interface CardWithDue extends CardInfo {
  daysUntilDue: number;
}

const AdvanceCardsManager: React.FC = () => {
  const [filters, setFilters] = useState<FilterOptions>({
    dueDateLongerThan: 30,
    intervalLongerThan: 90,
  });
  const [matchingCards, setMatchingCards] = useState<CardWithDue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [availableNoteTypes, setAvailableNoteTypes] = useState<string[]>([]);
  const [targetDays, setTargetDays] = useState(30);
  const [actionType, setActionType] = useState<
    "reduce_interval" | "bring_closer"
  >("bring_closer");

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const decks = await anki.deck.deckNames();
        const noteTypes = await anki.model.modelNames();
        setAvailableDecks(decks);
        setAvailableNoteTypes(noteTypes);
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    };
    loadMetadata();
  }, []);

  const buildAnkiQuery = (filters: FilterOptions): string => {
    const parts: string[] = [];

    if (filters.noteType) {
      parts.push(`note:"${filters.noteType}"`);
    }

    if (filters.deckName) {
      parts.push(`deck:"${filters.deckName}"`);
    }

    if (filters.tags) {
      const tags = filters.tags.split(",").map((tag) => `tag:"${tag.trim()}"`);
      parts.push(`(${tags.join(" OR ")})`);
    }

    if (filters.textFilter) {
      parts.push(`"${filters.textFilter}"`);
    }

    parts.push("-is:suspended");
    parts.push("-is:new");

    return parts.length > 0 ? parts.join(" ") : "";
  };

  const calculateDaysUntilDue = (due: number): number => {
    const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return due - currentDay;
  };

  const queryCards = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setMatchingCards([]);

    try {
      setStage("Building query...");
      const fullQuery = buildAnkiQuery(filters);

      setStage("Finding notes...");
      console.log(fullQuery);
      const noteIds = await anki.note.findNotes({ query: fullQuery });
      console.log("Found:", noteIds.length);

      if (noteIds.length === 0) {
        setStage("No notes found");
        setLoading(false);
        return;
      }

      setStage("Loading notes...");
      const notes: NoteInfo[] = await anki.note.notesInfo({ notes: noteIds });

      const allCardIds = notes.flatMap((note) => note.cards || []);
      if (allCardIds.length === 0) {
        setStage("No cards found");
        setLoading(false);
        return;
      }

      setStage("Loading cards...");
      const allCards: CardInfo[] = await anki.card.cardsInfo({
        cards: allCardIds,
      });

      setStage("Filtering cards...");
      const filteredCards: CardWithDue[] = allCards
        .map((card) => ({
          ...card,
          daysUntilDue: calculateDaysUntilDue(card.due),
        }))
        .filter((card) => {
          const meetsDateCriteria =
            filters.dueDateLongerThan !== undefined
              ? card.daysUntilDue > filters.dueDateLongerThan
              : true;

          const meetsIntervalCriteria =
            filters.intervalLongerThan !== undefined
              ? card.interval > filters.intervalLongerThan
              : true;

          return meetsDateCriteria && meetsIntervalCriteria;
        });

      setMatchingCards(filteredCards);
      setStage(`Found ${filteredCards.length} cards`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to query cards");
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async () => {
    if (matchingCards.length === 0) return;

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const cardIds = matchingCards.map((card) => card.cardId);

      if (actionType === "reduce_interval") {
        setStage(
          `Cannot directly set intervals - this would require answering cards to adjust intervals naturally`
        );
        setError(
          "Direct interval setting is not supported by AnkiConnect. Use 'bring closer' instead."
        );
        return;
      } else {
        setStage(
          `Bringing ${cardIds.length} cards closer (within ${targetDays} days)...`
        );

        // Use setDueDate which accepts days as string
        await anki.card.setDueDate({
          cards: cardIds,
          days: targetDays.toString(),
        });
        setProgress(100);
      }

      setStage("Action completed successfully!");
      setTimeout(() => queryCards(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute action");
    } finally {
      setLoading(false);
    }
  };

  const cardsSummary = useMemo(() => {
    if (matchingCards.length === 0) return null;

    const byInterval = matchingCards.reduce((acc, card) => {
      const intervalRange =
        card.interval > 365
          ? "1+ year"
          : card.interval > 180
          ? "6m-1y"
          : card.interval > 90
          ? "3-6m"
          : "3m or less";
      acc[intervalRange] = (acc[intervalRange] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byDueDate = matchingCards.reduce((acc, card) => {
      const dueRange =
        card.daysUntilDue > 365
          ? "1+ year"
          : card.daysUntilDue > 180
          ? "6m-1y"
          : card.daysUntilDue > 90
          ? "3-6m"
          : card.daysUntilDue > 30
          ? "1-3m"
          : "30 days or less";
      acc[dueRange] = (acc[dueRange] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { byInterval, byDueDate };
  }, [matchingCards]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Advance Cards Manager</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Filter Options</h3>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="noteType"
                className="block text-sm font-medium mb-1"
              >
                Note Type
              </label>
              <select
                id="noteType"
                value={filters.noteType || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    noteType: e.target.value || undefined,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="">All Note Types</option>
                {availableNoteTypes.map((noteType) => (
                  <option key={noteType} value={noteType}>
                    {noteType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="deckName"
                className="block text-sm font-medium mb-1"
              >
                Deck Name
              </label>
              <select
                id="deckName"
                value={filters.deckName || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    deckName: e.target.value || undefined,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="">All Decks</option>
                {availableDecks.map((deck) => (
                  <option key={deck} value={deck}>
                    {deck}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium mb-1">
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                type="text"
                value={filters.tags || ""}
                onChange={(e) =>
                  setFilters({ ...filters, tags: e.target.value || undefined })
                }
                placeholder="tag1, tag2, tag3"
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div>
              <label
                htmlFor="textFilter"
                className="block text-sm font-medium mb-1"
              >
                Text Filter
              </label>
              <input
                id="textFilter"
                type="text"
                value={filters.textFilter || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    textFilter: e.target.value || undefined,
                  })
                }
                placeholder="Search text in cards"
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div>
              <label
                htmlFor="dueDateLongerThan"
                className="block text-sm font-medium mb-1"
              >
                Due Date Longer Than (days)
              </label>
              <input
                id="dueDateLongerThan"
                type="number"
                value={filters.dueDateLongerThan || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dueDateLongerThan: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="30"
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div>
              <label
                htmlFor="intervalLongerThan"
                className="block text-sm font-medium mb-1"
              >
                Interval Longer Than (days)
              </label>
              <input
                id="intervalLongerThan"
                type="number"
                value={filters.intervalLongerThan || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    intervalLongerThan: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="90"
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <button
              onClick={queryCards}
              disabled={loading}
              className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Querying..." : "Query Cards"}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Action Settings</h3>

          <div className="space-y-4">
            <div>
              <div className="block text-sm font-medium mb-2">Action Type</div>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="bring_closer"
                    checked={actionType === "bring_closer"}
                    onChange={(e) =>
                      setActionType(e.target.value as "bring_closer")
                    }
                    className="mr-2"
                  />
                  Bring cards closer (set due date within X days)
                </label>
                {/*<label className="flex items-center opacity-50">
                  <input
                    type="radio"
                    value="reduce_interval"
                    checked={actionType === "reduce_interval"}
                    onChange={(e) =>
                      setActionType(e.target.value as "reduce_interval")
                    }
                    className="mr-2"
                    disabled
                  />
                  Reduce interval to X days (not supported by AnkiConnect)
                </label>*/}
              </div>
            </div>

            <div>
              <label
                htmlFor="targetDays"
                className="block text-sm font-medium mb-1"
              >
                Target Days
              </label>
              <input
                id="targetDays"
                type="number"
                value={targetDays}
                onChange={(e) => setTargetDays(parseInt(e.target.value) || 30)}
                className="w-full p-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cards will be due within this many days from today
              </p>
            </div>

            <button
              onClick={executeAction}
              disabled={loading || matchingCards.length === 0}
              className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading
                ? "Processing..."
                : `Execute Action (${matchingCards.length} cards)`}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mb-6">
          <LoadingProgressBar progressPercentage={progress} stage={stage} />
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {matchingCards.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            Found {matchingCards.length} Cards
          </h3>

          {cardsSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="font-medium mb-2">By Interval:</h4>
                <div className="space-y-1">
                  {Object.entries(cardsSummary.byInterval).map(
                    ([range, count]) => (
                      <div key={range} className="flex justify-between text-sm">
                        <span>{range}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">By Due Date:</h4>
                <div className="space-y-1">
                  {Object.entries(cardsSummary.byDueDate).map(
                    ([range, count]) => (
                      <div key={range} className="flex justify-between text-sm">
                        <span>{range}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Card ID</th>
                  <th className="px-3 py-2 text-left">Due (days)</th>
                  <th className="px-3 py-2 text-left">Interval</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Deck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {matchingCards.slice(0, 100).map((card) => (
                  <tr key={card.cardId}>
                    <td className="px-3 py-2">{card.cardId}</td>
                    <td className="px-3 py-2">{card.daysUntilDue}</td>
                    <td className="px-3 py-2">{card.interval}</td>
                    <td className="px-3 py-2">{card.type}</td>
                    <td className="px-3 py-2">{card.deckName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matchingCards.length > 100 && (
              <p className="text-center py-2 text-gray-500">
                Showing first 100 cards of {matchingCards.length} total
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvanceCardsManager;
