import { useState, useEffect, useCallback } from "react";
import anki from "~/apis/anki";
import { getAnkiNoteFilter } from "~/apis/anki";
import type { Route } from "./+types/exam_level";
import MainFrame from "~/toolbar/frame";
import { LoadingProgressBar } from "~/components/LoadingProgressBar";
import { CardStateBar } from "~/components/CardStateBar";

// Configuration for continuous progress bar
const PROGRESS_STAGE_CONFIG = {
  "Loading L0 cards...": { start: 0, end: 15 },
  "Loading L1 cards...": { start: 15, end: 30 },
  "Loading L2 cards...": { start: 30, end: 45 },
  "Loading L3 cards...": { start: 45, end: 60 },
  "Loading L4 cards...": { start: 60, end: 80 },
  "Loading L5 cards...": { start: 80, end: 100 },
} as const;

type LevelStats = {
  level: string;
  pending: number;
  inProgress: number;
  mature: number;
  total: number;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Exam Level" },
    { name: "description", content: "TOCFL exam level analysis" },
  ];
}

function ExamLevelContent() {
  const [levelStats, setLevelStats] = useState<LevelStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [totalCards, setTotalCards] = useState<number>(0);

  const loadCardCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgressPercentage(0);
      setLevelStats([]);
      setTotalCards(0);

      const levels = ["L0", "L1", "L2", "L3", "L4", "L5"];
      const baseFilter = getAnkiNoteFilter();
      const results: LevelStats[] = [];
      let total = 0;

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        setStage(`Loading ${level} cards...`);

        // Query for each status type serially
        setProgressPercentage(0);
        const pendingIds = await anki.note.findNotes({
          query: `${baseFilter} card:0 (tag:TOCFL::${level} OR tag:${level}) (is:new OR is:suspended)`,
        });

        setProgressPercentage(33);
        const inProgressIds = await anki.note.findNotes({
          query: `${baseFilter} card:0 (tag:TOCFL::${level} OR tag:${level}) -is:new -is:suspended prop:ivl<21`,
        });

        setProgressPercentage(66);
        const matureIds = await anki.note.findNotes({
          query: `${baseFilter} card:0 (tag:TOCFL::${level} OR tag:${level}) prop:ivl>=21`,
        });

        setProgressPercentage(99);
        const pending = pendingIds.length;
        const inProgress = inProgressIds.length;
        const mature = matureIds.length;
        const levelTotal = pending + inProgress + mature;

        results.push({
          level,
          pending,
          inProgress,
          mature,
          total: levelTotal,
        });

        total += levelTotal;
        setProgressPercentage(((i + 1) / levels.length) * 100);
      }

      setLevelStats(results);
      setTotalCards(total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while loading card counts");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCardCounts();
  }, [loadCardCounts]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingProgressBar
          stage={stage}
          progressPercentage={progressPercentage}
          stageConfig={PROGRESS_STAGE_CONFIG}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-400 mb-2">
            Error Loading Cards
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={loadCardCounts}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {levelStats.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No cards found. Make sure you have Anki cards with TOCFL tags.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Total: {totalCards} cards analyzed
          </p>

          {levelStats.map((stats) => (
            <CardStateBar
              key={stats.level}
              title={stats.level || "No Level"}
              segments={[
                {
                  key: "pending",
                  label: "Pending",
                  count: stats.pending,
                  colorClassName: "bg-gray-400 dark:bg-gray-500",
                },
                {
                  key: "inProgress",
                  label: "In Progress",
                  count: stats.inProgress,
                  colorClassName: "bg-blue-500 dark:bg-blue-600",
                },
                {
                  key: "mature",
                  label: "Mature",
                  count: stats.mature,
                  colorClassName: "bg-green-500 dark:bg-green-600",
                },
              ]}
            />
          ))}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-2">
          About This Analysis
        </h2>
        <p className="text-blue-800 dark:text-blue-300 text-sm">
          This page analyzes your Anki cards by TOCFL (Test of Chinese as a
          Foreign Language) level. Only the first card from each note is
          considered. Cards are categorized as:
        </p>
        <ul className="list-disc list-inside text-blue-800 dark:text-blue-300 text-sm mt-2 ml-4">
          <li>
            <strong>Pending:</strong> New or suspended cards
          </li>
          <li>
            <strong>In Progress:</strong> Review cards with interval &lt; 21
            days
          </li>
          <li>
            <strong>Mature:</strong> Review cards with interval ≥ 21 days
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function ExamLevel() {
  return (
    <MainFrame>
      <ExamLevelContent />
    </MainFrame>
  );
}
