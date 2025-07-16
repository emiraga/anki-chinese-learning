import { useState, useEffect, useCallback, useRef } from "react";
import { YankiConnect } from "yanki-connect";
import { sleep } from "~/data/utils";

const anki: YankiConnect = new YankiConnect();
export type CardInfo = Awaited<ReturnType<typeof anki.card.cardsInfo>>[number];

export type NoteInfo = Awaited<ReturnType<typeof anki.note.notesInfo>>[number];

export type NoteWithCards = NoteInfo & {
  cardDetails: CardInfo[];
};

export default anki;

// Helper function to chunk arrays
// Moved outside the hook to prevent re-creation on every render.
const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const useAnkiCards = () => {
  const [notesByCards, setNotesByCards] = useState<NoteWithCards[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [stage, setStage] = useState<string>("");

  // Ref to track if the component is mounted
  const isMountedRef = useRef<boolean>(true);

  // Main function to load all cards grouped by notes
  const loadCards = useCallback(async (): Promise<void> => {
    // The useCallback hook with an empty dependency array `[]` is correct.
    // It ensures this function reference is stable across renders.
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);
      setProgress(0);
      setNotesByCards([]);
      setStage("Finding notes...");

      const noteIds = await anki.note.findNotes({ query: "-is:suspended" });
      if (!isMountedRef.current || noteIds.length === 0) {
        setLoading(false);
        return;
      }

      setTotalItems(noteIds.length);
      setStage("Loading notes...");

      const noteBatchSize = 100;
      const noteChunks = chunk(noteIds, noteBatchSize);
      const allNotes = [];

      for (const noteChunk of noteChunks) {
        const notesBatch = await anki.note.notesInfo({ notes: noteChunk });
        if (!isMountedRef.current) return;
        allNotes.push(...notesBatch);
        setProgress(allNotes.length);
      }

      setStage("Computing cards...");
      const allCardIds = allNotes.flatMap((note) => note.cards || []);
      if (!isMountedRef.current || allCardIds.length === 0) {
        setLoading(false);
        return;
      }

      setTotalItems(allCardIds.length);
      setProgress(0);
      setStage("Loading cards...");

      const cardBatchSize = 50;
      const cardChunks = chunk(allCardIds, cardBatchSize);
      const allCards: CardInfo[] = [];

      for (const cardChunk of cardChunks) {
        const cardsBatch = await anki.card.cardsInfo({ cards: cardChunk });
        if (!isMountedRef.current) return;
        allCards.push(...cardsBatch);
        setProgress(allCards.length);
      }

      setStage("Grouping cards by notes...");
      const cardsByNoteId = new Map<number, CardInfo[]>();
      for (const card of allCards) {
        const noteId = card.note;
        if (!cardsByNoteId.has(noteId)) {
          cardsByNoteId.set(noteId, []);
        }
        cardsByNoteId.get(noteId)!.push(card);
      }

      const notesWithCards: NoteWithCards[] = allNotes
        .filter((note) => cardsByNoteId.has(note.noteId))
        .map((note) => ({
          ...note,
          cardDetails: cardsByNoteId.get(note.noteId)!,
        }));

      if (isMountedRef.current) {
        setNotesByCards(notesWithCards);
        setStage("Complete");
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An error occurred while loading cards");
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // Empty dependency array is correct.

  // Auto-load on mount and handle unmounting
  useEffect(() => {
    isMountedRef.current = true;
    if (anki) {
      loadCards();
    }

    // Return a cleanup function that runs when the component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, [loadCards]);

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

export const anki_open_browse = async (query: string) => {
  for (var i = 0; i < 200; i++) {
    console.log(i);
    if (!document.hasFocus()) {
      break;
    }
    await anki.graphical.guiBrowse({ query });
    await sleep(10);
  }
};
