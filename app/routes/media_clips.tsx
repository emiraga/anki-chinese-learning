import { useState, useEffect, useCallback } from "react";
import anki, { ankiOpenBrowse } from "~/apis/anki";
import type { Route } from "./+types/media_clips";
import MainFrame from "~/toolbar/frame";
import { LoadingProgressBar } from "~/components/LoadingProgressBar";
import {
  CardStateBar,
  type CardStateSegment,
} from "~/components/CardStateBar";

// Media clip sources, each one identified by the Anki tag its cards carry.
const MEDIA_SOURCES: { name: string; tag: string }[] = [
  { name: "Apple of My Eye", tag: "chinese::media::apple_of_my_eye" },
];

// Card states are mutually exclusive, so the counts add up to the total.
const CARD_STATES: {
  key: string;
  label: string;
  colorClassName: string;
  filter: string;
}[] = [
  {
    key: "suspended",
    label: "Suspended",
    colorClassName: "bg-gray-400 dark:bg-gray-500",
    filter: "is:suspended",
  },
  {
    key: "new",
    label: "New",
    colorClassName: "bg-yellow-500 dark:bg-yellow-600",
    filter: "is:new -is:suspended",
  },
  {
    key: "learning",
    label: "Learning",
    colorClassName: "bg-orange-500 dark:bg-orange-600",
    filter: "is:learn -is:suspended",
  },
  {
    key: "young",
    label: "Young",
    colorClassName: "bg-blue-500 dark:bg-blue-600",
    filter: "is:review -is:learn -is:suspended prop:ivl<21",
  },
  {
    key: "mature",
    label: "Mature",
    colorClassName: "bg-green-500 dark:bg-green-600",
    filter: "is:review -is:learn -is:suspended prop:ivl>=21",
  },
];

const DUE_FILTER = "is:due -is:suspended";

type SourceStats = {
  name: string;
  tag: string;
  segments: CardStateSegment[];
  due: number;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Media Clips" },
    { name: "description", content: "Media clip card state analysis" },
  ];
}

function MediaClipsContent() {
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadCardCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgressPercentage(0);
      setSourceStats([]);

      const results: SourceStats[] = [];
      const totalQueries = MEDIA_SOURCES.length * (CARD_STATES.length + 1);
      let doneQueries = 0;

      for (const source of MEDIA_SOURCES) {
        setStage(`Loading ${source.name} cards...`);
        const baseFilter = `tag:${source.tag}`;
        const segments: CardStateSegment[] = [];

        for (const state of CARD_STATES) {
          const query = `${baseFilter} ${state.filter}`;
          const cardIds = await anki.card.findCards({ query });
          segments.push({
            key: state.key,
            label: state.label,
            count: cardIds.length,
            colorClassName: state.colorClassName,
            query,
          });
          doneQueries++;
          setProgressPercentage((doneQueries / totalQueries) * 100);
        }

        const dueIds = await anki.card.findCards({
          query: `${baseFilter} ${DUE_FILTER}`,
        });
        doneQueries++;
        setProgressPercentage((doneQueries / totalQueries) * 100);

        results.push({
          name: source.name,
          tag: source.tag,
          segments,
          due: dueIds.length,
        });
      }

      setSourceStats(results);
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

  const totalCards = sourceStats.reduce(
    (sum, source) =>
      sum + source.segments.reduce((s, segment) => s + segment.count, 0),
    0
  );

  return (
    <div className="container mx-auto p-6">
      {totalCards === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No media clip cards found. Make sure your clips are tagged with one
            of: {MEDIA_SOURCES.map((source) => source.tag).join(", ")}.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Total: {totalCards} cards analyzed
          </p>

          {sourceStats.map((source) => (
            <div key={source.tag}>
              <CardStateBar
                title={source.name}
                segments={source.segments}
                onSegmentClick={async (segment) => {
                  await ankiOpenBrowse(segment.query!);
                }}
              />
              <p className="-mt-4 mb-6 text-sm text-gray-600 dark:text-gray-400">
                Due today: {source.due}
                <button
                  className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  onClick={async () => {
                    await ankiOpenBrowse(`tag:${source.tag} ${DUE_FILTER}`);
                  }}
                >
                  anki
                </button>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-2">
          About This Analysis
        </h2>
        <p className="text-blue-800 dark:text-blue-300 text-sm">
          This page analyzes cards for each media clip source, identified by its
          Anki tag. Cards are categorized as:
        </p>
        <ul className="list-disc list-inside text-blue-800 dark:text-blue-300 text-sm mt-2 ml-4">
          <li>
            <strong>Suspended:</strong> Cards that are not being scheduled
          </li>
          <li>
            <strong>New:</strong> Unseen cards waiting to be introduced
          </li>
          <li>
            <strong>Learning:</strong> Cards in learning or relearning steps
          </li>
          <li>
            <strong>Young:</strong> Review cards with interval &lt; 21 days
          </li>
          <li>
            <strong>Mature:</strong> Review cards with interval ≥ 21 days
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function MediaClips() {
  return (
    <MainFrame>
      <MediaClipsContent />
    </MainFrame>
  );
}
