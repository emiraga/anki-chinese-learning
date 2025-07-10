import { useState, useEffect, useCallback } from "react";
import { YankiConnect } from "yanki-connect";

const anki: YankiConnect = new YankiConnect();
export type CardInfo = Awaited<ReturnType<typeof anki.card.cardsInfo>>[number];

export type NoteInfo = Awaited<ReturnType<typeof anki.note.notesInfo>>[number];

export type NoteWithCards = NoteInfo & {
  cardDetails: CardInfo[];
};

export default anki;

export const useAnkiCards = () => {
  const [notesByCards, setNotesByCards] = useState<NoteWithCards[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [stage, setStage] = useState("");

  // Helper function to chunk arrays
  const chunk = (array: number[], size: number) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // Main function to load all cards grouped by notes
  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      setNotesByCards([]);

      // Step 1: Get all unsuspended note IDs
      setStage("Finding notes...");
      const noteIds = await anki.note.findNotes({ query: "-is:suspended" });

      if (noteIds.length === 0) {
        setLoading(false);
        return;
      }

      setTotalItems(noteIds.length);
      setStage("Loading notes...");

      // Step 2: Get notes info in batches
      const noteBatchSize = 100;
      const noteChunks = chunk(noteIds, noteBatchSize);
      const allNotes = [];

      for (let i = 0; i < noteChunks.length; i++) {
        const notesBatch = await anki.note.notesInfo({
          notes: noteChunks[i],
        });
        allNotes.push(...notesBatch);

        setProgress(allNotes.length);
      }

      // Step 3: Compute list of cards from notes
      setStage("Computing cards...");
      const allCardIds = [];

      for (const note of allNotes) {
        // Each note has a cards property with card IDs
        if (note.cards && note.cards.length > 0) {
          allCardIds.push(...note.cards);
        }
      }

      if (allCardIds.length === 0) {
        setLoading(false);
        return;
      }

      // Update progress tracking for card loading phase
      setTotalItems(allCardIds.length);
      setProgress(0);
      setStage("Loading cards...");

      // Step 4: Load cards in batches
      const cardBatchSize = 100;
      const cardChunks = chunk(allCardIds, cardBatchSize);
      const allCards: CardInfo[] = [];

      for (let i = 0; i < cardChunks.length; i++) {
        const cardsBatch = await anki.card.cardsInfo({
          cards: cardChunks[i],
        });
        allCards.push(...cardsBatch);
        setProgress(allCards.length);
      }

      // Step 5: Group cards by note
      setStage("Grouping cards by notes...");
      const cardsByNoteId = new Map<number, CardInfo[]>();

      // Group cards by their note ID
      for (const card of allCards) {
        const noteId = card.note;
        if (!cardsByNoteId.has(noteId)) {
          cardsByNoteId.set(noteId, []);
        }
        cardsByNoteId.get(noteId)!.push(card);
      }

      // Step 6: Create final structure with notes and their associated cards
      const notesWithCards: NoteWithCards[] = allNotes
        .filter((note) => cardsByNoteId.has(note.noteId))
        .map((note) => ({
          ...note,
          cardDetails: cardsByNoteId.get(note.noteId) || [],
        }));

      setNotesByCards(notesWithCards);
      setStage("Complete");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while loading cards"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (anki) {
      loadCards();
    }
  }, [loadCards]);

  // Calculate progress percentage
  const progressPercentage =
    totalItems > 0 ? Math.min((progress / totalItems) * 100, 100) : 0;

  return {
    notesByCards,
    loading,
    progressPercentage,
    stage,
    error,
    reload: loadCards,
  };
};
