import { useEffect, useState } from "react";
import anki from "~/apis/anki";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { LoadingProgressBar } from "./LoadingProgressBar";

// Learning progress constants
const LEARNING_CONSTANTS = {
  MIN_EASE_THRESHOLD: 3, // Good or Easy review (1=Again, 2=Hard, 3=Good, 4=Easy)
  MIN_INTERVAL_DAYS: 21, // Minimum interval to consider character "learned"
  MIN_FACTOR: 100, // Minimum factor for review quality
  BATCH_SIZE: 100, // Cards processed per batch to avoid API limits
  TARGET_CHARS_INTERMEDIATE: 2000, // Characters needed for intermediate level
  TARGET_CHARS_ADVANCED: 3000, // Characters needed for advanced level
} as const;

type AnkiReview = {
  ease: number;
  factor: number;
  id: number;
  ivl: number;
  lastIvl: number;
  time: number;
  type: number;
  usn: number;
};

const useAnkiHanziProgress = () => {
  const [characterProgress, setCharacterProgress] = useState<{
    [key: string]: number;
  }>({});
  const [charactersStartedLearning, setCharactersStartedLearning] = useState<{
    [key: string]: number;
  }>({});
  const [dailyLearnedCharactersList, setDailyLearnedCharactersList] = useState<{
    [key: string]: string[];
  }>({});
  const [dailyStartedCharactersList, setDailyStartedCharactersList] = useState<{
    [key: string]: string[];
  }>({});
  const [learningTimeDistribution, setLearningTimeDistribution] = useState<
    { char: string; days: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [stage, setStage] = useState("Initializing...");

  // Define stage configuration for smoother progress tracking
  const stageConfig = {
    "Initializing...": { start: 0, end: 5 },
    "Finding Hanzi notes...": { start: 5, end: 10 },
    "Getting note details...": { start: 10, end: 20 },
    "Processing note information...": { start: 20, end: 25 },
    "Fetching reviews...": { start: 25, end: 75 },
    "Processing reviews to calculate progress...": { start: 75, end: 95 },
    "Finalizing results...": { start: 95, end: 100 },
    "Complete!": { start: 100, end: 100 },
  };

  useEffect(() => {
    const fetchHanziProgress = async () => {
      try {
        setLoading(true);
        setProgressPercentage(0);
        setStage("Finding Hanzi notes...");

        // 1. Get all notes of the "Hanzi" note type
        // AnkiConnect's 'findNotes' action allows querying by note type
        const hanziNoteIds = await anki.note.findNotes({
          query: 'note:"Hanzi" -is:new -is:suspended',
        });

        setProgressPercentage(100);
        setStage("Getting note details...");

        // 2. Get detailed information for these notes (to extract the character field)
        const hanziNotesInfo = await anki.note.notesInfo({
          notes: hanziNoteIds,
        });

        setProgressPercentage(100);
        setStage("Processing note information...");

        // We need to map note IDs to their respective characters and card IDs.
        const noteToCharMap: { [key: string]: string } = {};
        const allCardIds: number[] = [];
        hanziNotesInfo.forEach((note) => {
          const character = note.fields.Traditional?.value;
          if (character) {
            const cardId = note.cards[0]; // Keep as number for API call
            noteToCharMap[cardId.toString()] = character; // Use string for lookup
            allCardIds.push(cardId);
          }
        });

        // 3. Get all reviews for the cards associated with these Hanzi notes (in batches)
        const batchSize = LEARNING_CONSTANTS.BATCH_SIZE;
        const reviewsOfCards: { [key: string]: AnkiReview[] } = {};

        setProgressPercentage(0);
        setStage("Fetching reviews...");

        const totalBatches = Math.ceil(allCardIds.length / batchSize);

        for (let i = 0; i < allCardIds.length; i += batchSize) {
          const batch = allCardIds.slice(i, i + batchSize);
          const currentBatch = Math.floor(i / batchSize) + 1;

          setStage("Fetching reviews...");
          setProgressPercentage((currentBatch / totalBatches) * 100);

          const batchReviews = await anki.statistic.getReviewsOfCards({
            // @ts-expect-error next-line
            cards: batch,
          });

          Object.assign(reviewsOfCards, batchReviews);
        }

        setProgressPercentage(0);
        setStage("Processing reviews to calculate progress...");

        // 4. Process reviews to build the daily character graph and learning time distribution
        const dailyLearnedCharactersList: { [key: string]: string[] } = {};
        const dailyStartedCharactersList: { [key: string]: string[] } = {};
        const seenCharacters = new Set(); // To track uniquely learned characters
        const startedCharacters = new Set(); // To track uniquely started characters
        const characterFirstEncounter: { [key: string]: number } = {}; // Track first review time
        const learningTimes: { char: string; days: number }[] = []; // Character and days from first encounter to learned

        // Sort reviews by timestamp to ensure chronological processing
        // Note: The 'id' in reviews is the reviewTime in milliseconds
        const allReviews: ({ cardId: string } & AnkiReview)[] = [];

        Object.entries(reviewsOfCards).forEach(([cardId, reviews]) => {
          allReviews.push(...reviews.map((r) => ({ cardId, ...r })));
        });

        allReviews.sort((a, b) => a.id - b.id);

        allReviews.forEach((review) => {
          const cardId = review.cardId;
          const char = noteToCharMap[cardId];

          if (char) {
            // Track first encounter for this character
            if (!characterFirstEncounter[char]) {
              characterFirstEncounter[char] = review.id;

              // Track when character started learning (first review)
              if (!startedCharacters.has(char)) {
                const reviewDate = new Date(review.id).toLocaleDateString(
                  "en-CA"
                ); // YYYY-MM-DD
                if (!dailyStartedCharactersList[reviewDate]) {
                  dailyStartedCharactersList[reviewDate] = [];
                }
                dailyStartedCharactersList[reviewDate].push(char);
                startedCharacters.add(char);
              }
            }

            if (!seenCharacters.has(char)) {
              // A character is "learned" on its first "Good" or "Easy" review
              // Review 'type': 0 = learning, 1 = review, 2 = relearn, 3 = cram
              // 'ease': 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
              if (
                review.ease >= LEARNING_CONSTANTS.MIN_EASE_THRESHOLD &&
                review.ivl >= LEARNING_CONSTANTS.MIN_INTERVAL_DAYS &&
                review.factor >= LEARNING_CONSTANTS.MIN_FACTOR
              ) {
                // Good or Easy - character is now learned
                const reviewDate = new Date(review.id).toLocaleDateString(
                  "en-CA"
                ); // YYYY-MM-DD
                if (!dailyLearnedCharactersList[reviewDate]) {
                  dailyLearnedCharactersList[reviewDate] = [];
                }
                dailyLearnedCharactersList[reviewDate].push(char);
                seenCharacters.add(char); // Mark as learned

                // Calculate learning time in days
                const firstEncounterTime = characterFirstEncounter[char];
                const learnedTime = review.id;
                const timeDifferenceMs = learnedTime - firstEncounterTime;
                const timeDifferenceDays = Math.ceil(
                  timeDifferenceMs / (1000 * 60 * 60 * 24)
                );
                learningTimes.push({ char, days: timeDifferenceDays });
              }
            }
          }
        });

        // Convert daily character lists to cumulative count data
        const toCumulative = (daily: { [key: string]: string[] }) => {
          const sorted = Object.keys(daily).sort();
          let count = 0;
          const cumulative: { [key: string]: number } = {};
          sorted.forEach((date) => {
            count += daily[date].length;
            cumulative[date] = count;
          });
          return cumulative;
        };

        const cumulativeGraphData = toCumulative(dailyLearnedCharactersList);
        const cumulativeStartedGraphData = toCumulative(dailyStartedCharactersList);

        setProgressPercentage(0);
        setStage("Finalizing results...");

        setCharacterProgress(cumulativeGraphData);
        setCharactersStartedLearning(cumulativeStartedGraphData);
        setDailyLearnedCharactersList(dailyLearnedCharactersList);
        setDailyStartedCharactersList(dailyStartedCharactersList);
        setLearningTimeDistribution(learningTimes);

        setProgressPercentage(100);
        setStage("Complete!");
      } catch (err) {
        console.error("Error fetching Anki data:", err);
        setError(
          "Failed to fetch Anki data. Please ensure Anki is running and AnkiConnect is installed and enabled."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHanziProgress();
  }, []);

  return {
    characterProgress,
    charactersStartedLearning,
    dailyLearnedCharactersList,
    dailyStartedCharactersList,
    learningTimeDistribution,
    loading,
    error,
    progressPercentage,
    stage,
    stageConfig,
  };
};

// Simple helper function to calculate progress rate
const calculateProgress = (characterProgress: { [key: string]: number }) => {
  const entries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  if (entries.length === 0) return null;

  const firstDate = new Date(entries[0][0]);
  const lastDate = new Date(entries[entries.length - 1][0]);
  const currentCount = entries[entries.length - 1][1];

  // Calculate elapsed days (assume intercept is 0 at first date)
  const elapsedDays =
    Math.ceil(
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  // Simple rate: characters learned / days elapsed
  const charsPerDay = currentCount / elapsedDays;

  if (charsPerDay <= 0) return null; // No progress

  const daysTo2000 = Math.ceil(
    (LEARNING_CONSTANTS.TARGET_CHARS_INTERMEDIATE - currentCount) / charsPerDay
  );
  const daysTo3000 = Math.ceil(
    (LEARNING_CONSTANTS.TARGET_CHARS_ADVANCED - currentCount) / charsPerDay
  );

  const currentDate = new Date();
  const dateTo2000 = new Date(
    currentDate.getTime() + daysTo2000 * 24 * 60 * 60 * 1000
  );
  const dateTo3000 = new Date(
    currentDate.getTime() + daysTo3000 * 24 * 60 * 60 * 1000
  );

  return {
    charsPerDay: Math.round(charsPerDay * 100) / 100, // Round to 2 decimal
    daysTo2000: daysTo2000 > 0 ? daysTo2000 : null,
    daysTo3000: daysTo3000 > 0 ? daysTo3000 : null,
    dateTo2000: daysTo2000 > 0 ? dateTo2000 : null,
    dateTo3000: daysTo3000 > 0 ? dateTo3000 : null,
  };
};

// Helper function to calculate monthly learning rates
const calculateMonthlyRates = (
  characterProgress: { [key: string]: number },
  charactersStartedLearning: { [key: string]: number }
) => {
  const learnedEntries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const startedEntries = Object.entries(charactersStartedLearning).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  if (learnedEntries.length === 0 && startedEntries.length === 0) return [];

  // Group data by month
  const monthlyData: {
    [key: string]: { learned: number; started: number; totalDays: number };
  } = {};

  // Process cumulative entries into monthly totals
  const processEntries = (
    entries: [string, number][],
    field: "learned" | "started"
  ) => {
    for (let i = 0; i < entries.length; i++) {
      const [date, cumulativeCount] = entries[i];
      const currentDate = new Date(date);
      const monthKey = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const prevCount = i > 0 ? entries[i - 1][1] : 0;
      const countThisDate = cumulativeCount - prevCount;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { learned: 0, started: 0, totalDays: 0 };
      }

      monthlyData[monthKey][field] += countThisDate;
    }
  };

  processEntries(learnedEntries, "learned");
  processEntries(startedEntries, "started");

  // Calculate days in each month and learning rates
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, "0")}`;

  return Object.entries(monthlyData).map(([monthKey, data]) => {
    const [year, month] = monthKey.split("-").map(Number);

    let daysToUse: number;
    let isCurrentMonth = false;

    if (monthKey === currentMonthKey) {
      // For current month, use current day of month
      daysToUse = currentDate.getDate();
      isCurrentMonth = true;
    } else {
      // For completed months, use total days in month
      daysToUse = new Date(year, month, 0).getDate();
    }

    const learnedRate = data.learned / daysToUse;
    const startedRate = data.started / daysToUse;

    return {
      month: monthKey,
      monthLabel:
        new Date(year, month - 1).toLocaleDateString("en-CA", {
          month: "short",
          year: "numeric",
        }) + (isCurrentMonth ? "*" : ""),
      charactersLearned: data.learned,
      charactersStarted: data.started,
      daysInMonth: daysToUse,
      learnedRate: Math.round(learnedRate * 10) / 10, // Round to 1 decimal
      startedRate: Math.round(startedRate * 10) / 10, // Round to 1 decimal
      isCurrentMonth,
    };
  });
};

// Shared tooltip wrapper component
const TooltipWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg">
    {children}
  </div>
);

// Custom tooltip component for histogram
const CustomHistogramTooltip = ({
  active,
  payload,
}: {
  active: boolean;
  payload: {
    payload: {
      binLabel: string;
      count: number;
      binStart: number;
      binEnd: number;
      chars: string[];
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const displayLimit = 50;
    const hasMore = data.chars.length > displayLimit;
    const displayChars = hasMore ? data.chars.slice(0, displayLimit) : data.chars;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-w-xs">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {data.binStart}-{data.binEnd} days
        </p>
        <p className="text-sm text-purple-600 dark:text-purple-400">
          {data.count} characters
        </p>
        {data.chars.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
              {displayChars.join(" ")}
              {hasMore && (
                <span className="text-gray-500 dark:text-gray-400">
                  {" "}... +{data.chars.length - displayLimit} more
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Learning Time Distribution Histogram Component
const LearningTimeDistributionChart: React.FC<{
  learningTimeDistribution: { char: string; days: number }[];
}> = ({ learningTimeDistribution }) => {
  if (learningTimeDistribution.length === 0) {
    return <div>No learning time data to display</div>;
  }

  // Create histogram data with bins
  const allDays = learningTimeDistribution.map((item) => item.days);
  const maxDays = Math.max(...allDays);
  const binSize = Math.max(1, Math.ceil(maxDays / 40)); // Aim for ~40 bins
  const numBins = Math.ceil(maxDays / binSize);

  const histogramData = Array.from({ length: numBins }, (_, i) => {
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;
    const itemsInBin = learningTimeDistribution.filter(
      (item) => item.days >= binStart && item.days < binEnd
    );

    return {
      binLabel: `${binStart}-${binEnd - 1}`,
      binStart,
      binEnd: binEnd - 1,
      count: itemsInBin.length,
      chars: itemsInBin.map((item) => item.char),
      days: binStart + binSize / 2, // Midpoint for display
    };
  }).filter((bin) => bin.count > 0); // Only show bins with data

  // Calculate statistics
  const avgLearningTime =
    Math.round(
      (allDays.reduce((a, b) => a + b, 0) / allDays.length) * 10
    ) / 10;

  const sortedTimes = [...allDays].sort((a, b) => a - b);
  const medianLearningTime =
    sortedTimes.length % 2 === 0
      ? (sortedTimes[sortedTimes.length / 2 - 1] +
          sortedTimes[sortedTimes.length / 2]) /
        2
      : sortedTimes[Math.floor(sortedTimes.length / 2)];

  return (
    <div className="w-full h-64 mb-20">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Learning Time Distribution
      </h3>
      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        <span className="mr-4">Average: {avgLearningTime} days</span>
        <span className="mr-4">Median: {medianLearningTime} days</span>
        <span>Total characters: {allDays.length}</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={histogramData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="binLabel"
            tick={{ fontSize: 12, fill: "currentColor" }}
            label={{
              value: "Days to Learn",
              position: "insideBottom",
              offset: -10,
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "currentColor" }}
            label={{
              value: "Number of Characters",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <Tooltip
            cursor={false}
            content={<CustomHistogramTooltip active={false} payload={[]} />}
          />
          <Bar
            dataKey="count"
            fill="#8b5cf6"
            name="Characters"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Custom tooltip component for bar chart
const CustomBarTooltip = ({
  active,
  payload,
}: {
  active: boolean;
  label: string;
  payload: {
    name: string;
    value: number;
    color: string;
    payload: {
      monthLabel: string;
      learnedRate: number;
      startedRate: number;
      daysInMonth: number;
      charactersLearned: number;
      charactersStarted: number;
      isCurrentMonth: boolean;
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <TooltipWrapper>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {data.monthLabel}
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Learned: {data.learnedRate} chars/day ({data.charactersLearned}{" "}
          total)
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Started: {data.startedRate} chars/day ({data.charactersStarted}{" "}
          total)
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.daysInMonth} days{data.isCurrentMonth ? " (so far)" : ""}
        </p>
      </TooltipWrapper>
    );
  }
  return null;
};

// Monthly Learning Rate Bar Chart Component
const MonthlyLearningRateChart: React.FC<{
  characterProgress: { [key: string]: number };
  charactersStartedLearning: { [key: string]: number };
}> = ({ characterProgress, charactersStartedLearning }) => {
  const monthlyRates = calculateMonthlyRates(
    characterProgress,
    charactersStartedLearning
  );
  const extrapolation = calculateProgress(characterProgress);
  const averageRate = extrapolation?.charsPerDay || 0;

  if (monthlyRates.length === 0) {
    return <div>No monthly data to display</div>;
  }

  return (
    <div className="w-full h-64 mb-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Monthly Learning Rate
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={monthlyRates}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 12, fill: "currentColor" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "currentColor" }}
            label={{
              value: "Characters/Day",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <Tooltip
            cursor={false}
            content={<CustomBarTooltip active={false} label="" payload={[]} />}
          />
          {averageRate > 0 && (
            <ReferenceLine
              y={averageRate}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `Avg learned: ${averageRate} chars/day`,
                position: "top",
                style: { fill: "currentColor" },
              }}
            />
          )}
          <Bar
            dataKey="learnedRate"
            fill="#3b82f6"
            name="Characters Learned"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="startedRate"
            fill="#10b981"
            name="Characters Started Learning"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Custom tooltip component for daily chart
const CustomDailyTooltip = ({
  active,
  payload,
  label,
}: {
  active: boolean;
  label: string;
  payload: { name: string; value: number; color: string }[];
}) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString("en-CA");
    return (
      <TooltipWrapper>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {date}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value} characters
          </p>
        ))}
      </TooltipWrapper>
    );
  }
  return null;
};

// Format date for x-axis display (shared by multiple charts)
const formatXAxisDate = (tickItem: string) => {
  const date = new Date(tickItem);
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
};

// Helper function to get complete date range from data objects
// Returns all dates between the first and last date found in any of the data objects
const getCompleteDateRange = (
  ...dataObjects: { [key: string]: unknown }[]
): string[] => {
  const existingDates = dataObjects.flatMap((obj) => Object.keys(obj)).sort();

  if (existingDates.length === 0) return [];

  const firstDate = existingDates[0];
  const lastDate = existingDates[existingDates.length - 1];

  const dates: string[] = [];
  const current = new Date(firstDate);
  const end = new Date(lastDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// Custom tooltip component for daily chart with character lists
const CustomDailyTooltipWithCharacters = ({
  active,
  payload,
  label,
}: {
  active: boolean;
  label: string;
  payload: {
    name: string;
    value: number;
    color: string;
    payload: {
      learnedChars: string[];
      startedChars: string[];
    };
  }[];
}) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString("en-CA");
    const data = payload[0].payload;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-w-xs">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {date}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value} characters
          </p>
        ))}
        {data.startedChars && data.startedChars.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
              Started learning:
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
              {data.startedChars.join(" ")}
            </p>
          </div>
        )}
        {data.learnedChars && data.learnedChars.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
              Fully learned:
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
              {data.learnedChars.join(" ")}
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Daily Incremental Chart Component
const DailyIncrementalChart: React.FC<{
  dailyLearnedCharactersList: { [key: string]: string[] };
  dailyStartedCharactersList: { [key: string]: string[] };
}> = ({
  dailyLearnedCharactersList,
  dailyStartedCharactersList,
}) => {
  const sortedDates = getCompleteDateRange(
    dailyLearnedCharactersList,
    dailyStartedCharactersList
  );

  if (sortedDates.length === 0) {
    return <div>No daily data to display</div>;
  }

  // Create combined data with zeros for missing dates
  const allData = sortedDates.map((date) => ({
    date,
    learned: dailyLearnedCharactersList[date]?.length || 0,
    started: dailyStartedCharactersList[date]?.length || 0,
    learnedChars: dailyLearnedCharactersList[date] || [],
    startedChars: dailyStartedCharactersList[date] || [],
    dateObj: new Date(date),
  }));

  // Calculate max value for Y-axis
  const maxLearnedValue = Math.max(
    ...Object.values(dailyLearnedCharactersList).map((chars) => chars.length),
    0
  );
  const maxStartedValue = Math.max(
    ...Object.values(dailyStartedCharactersList).map((chars) => chars.length),
    0
  );
  const yAxisMax = Math.ceil(Math.max(maxLearnedValue, maxStartedValue) * 1.1);

  return (
    <div className="w-full h-96 mb-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Daily New Characters Progress
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={allData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisDate}
            tick={{ fontSize: 10, fill: "currentColor", textAnchor: "end" }}
            angle={-45}
            interval={Math.ceil(sortedDates.length / 16)}
            height={60}
            label={{
              value: "Date",
              position: "insideBottom",
              offset: -5,
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <YAxis
            domain={[0, yAxisMax]}
            tick={{ fontSize: 12, fill: "currentColor" }}
            tickCount={8}
            label={{
              value: "Number of Characters",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <Tooltip
            cursor={false}
            content={
              <CustomDailyTooltipWithCharacters
                active={false}
                label=""
                payload={[]}
              />
            }
          />

          {/* Characters started learning line */}
          <Line
            type="monotone"
            dataKey="started"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", strokeWidth: 2, r: 3 }}
            name="Characters started learning"
            connectNulls={false}
          />

          {/* Characters learned line */}
          <Line
            type="monotone"
            dataKey="learned"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            name="Characters fully learned"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Recharts Progress Chart Component
const ProgressChart: React.FC<{
  characterProgress: { [key: string]: number };
  charactersStartedLearning: { [key: string]: number };
}> = ({ characterProgress, charactersStartedLearning }) => {
  const sortedDates = getCompleteDateRange(
    characterProgress,
    charactersStartedLearning
  );

  if (sortedDates.length === 0) {
    return <div>No data to display</div>;
  }

  // Prepare combined progress data for max value calculation
  const learnedEntries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const startedEntries = Object.entries(charactersStartedLearning).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  // Create combined data with both metrics, ensuring cumulative values carry forward
  const allData = sortedDates.reduce((acc, date) => {
    const prevData = acc[acc.length - 1];
    const prevLearnedCount = prevData?.learned || 0;
    const prevStartedCount = prevData?.started || 0;

    // If we have data for this date, use it, otherwise use previous values
    const learnedCount = characterProgress[date] !== undefined
      ? characterProgress[date]
      : prevLearnedCount;
    const startedCount = charactersStartedLearning[date] !== undefined
      ? charactersStartedLearning[date]
      : prevStartedCount;

    acc.push({
      date,
      learned: learnedCount,
      started: startedCount,
      inProgress: startedCount - learnedCount,
      dateObj: new Date(date),
    });

    return acc;
  }, [] as Array<{
    date: string;
    learned: number;
    started: number;
    inProgress: number;
    dateObj: Date;
  }>);

  // Calculate max value for Y-axis from both datasets
  const maxLearnedValue = Math.max(...learnedEntries.map(([, count]) => count));
  const maxStartedValue = Math.max(...startedEntries.map(([, count]) => count));
  const yAxisMax = Math.ceil(Math.max(maxLearnedValue, maxStartedValue) * 1.1);

  return (
    <div className="w-full h-96 mb-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Cumulative Characters Progress Over Time
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={allData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisDate}
            tick={{ fontSize: 10, fill: "currentColor", textAnchor: "end" }}
            angle={-45}
            interval={Math.ceil(sortedDates.length / 16)}
            height={60}
            label={{
              value: "Date",
              position: "insideBottom",
              offset: -5,
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <YAxis
            domain={[0, yAxisMax]}
            tick={{ fontSize: 12, fill: "currentColor" }}
            tickCount={8}
            label={{
              value: "Number of Characters",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "currentColor" },
            }}
          />
          <Tooltip
            cursor={false}
            content={<CustomDailyTooltip active={false} label="" payload={[]} />}
          />
          {/*<Legend />*/}

          {/* Characters started learning line */}
          <Line
            type="monotone"
            dataKey="started"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", strokeWidth: 2, r: 3 }}
            name="Characters started learning"
            connectNulls={false}
          />

          {/* Characters learned line */}
          <Line
            type="monotone"
            dataKey="learned"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            name="Characters fully learned"
            connectNulls={false}
          />

          {/* Characters in progress line */}
          <Line
            type="monotone"
            dataKey="inProgress"
            stroke="#f63b82"
            strokeWidth={3}
            dot={{ fill: "#f63b82", strokeWidth: 1, r: 2 }}
            name="Characters in progress"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const LearningConstantsDisplay: React.FC = () => {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
        Learning Configuration
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
          <div className="font-medium text-gray-600 dark:text-gray-300">
            Anki Min Ease Threshold
          </div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {LEARNING_CONSTANTS.MIN_EASE_THRESHOLD}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Good/Easy reviews only
          </div>
        </div>
        <div className="bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
          <div className="font-medium text-gray-600 dark:text-gray-300">
            Anki Min Interval
          </div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {LEARNING_CONSTANTS.MIN_INTERVAL_DAYS} days
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            To consider &quot;learned&quot;
          </div>
        </div>
        <div className="bg-white dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
          <div className="font-medium text-gray-600 dark:text-gray-300">
            Anki Min Factor
          </div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {LEARNING_CONSTANTS.MIN_FACTOR}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Review quality threshold
          </div>
        </div>
      </div>
    </div>
  );
};

export const AnkiHanziProgress = () => {
  const {
    characterProgress,
    charactersStartedLearning,
    dailyLearnedCharactersList,
    dailyStartedCharactersList,
    learningTimeDistribution,
    loading,
    error,
    progressPercentage,
    stage,
    stageConfig,
  } = useAnkiHanziProgress();

  if (loading) {
    return (
      <LoadingProgressBar
        stage={stage}
        progressPercentage={progressPercentage}
        stageConfig={stageConfig}
      />
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (Object.keys(characterProgress).length === 0) {
    return <div>No Hanzi characters learned yet or no data found.</div>;
  }

  const extrapolation = calculateProgress(characterProgress);
  const currentCount = Math.max(...Object.values(characterProgress));

  // Calculate total days of learning
  const entries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const firstDate = entries.length > 0 ? new Date(entries[0][0]) : null;
  const lastDate =
    entries.length > 0 ? new Date(entries[entries.length - 1][0]) : null;

  const totalDays =
    firstDate && lastDate
      ? Math.ceil(
          (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Hanzi Learning Progress
        </h2>

        {/* Progress Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">
              {currentCount} Characters Progress
            </h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalDays} <span className="text-sm">days past</span>
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-300 mt-1">
              Since {firstDate?.toLocaleDateString("en-CA")}
            </p>
          </div>

          {extrapolation && (
            <>
              <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  {LEARNING_CONSTANTS.TARGET_CHARS_INTERMEDIATE} Characters
                  Target
                </h3>
                {extrapolation.daysTo2000 ? (
                  <>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {extrapolation.daysTo2000}{" "}
                      <span className="text-sm text-red-600 dark:text-red-400">
                        days remaining
                      </span>
                    </p>

                    <p className="text-xs text-red-500 dark:text-red-300 mt-1">
                      Projected{" "}
                      {extrapolation.dateTo2000?.toLocaleDateString("en-CA")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Target reached!
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  {LEARNING_CONSTANTS.TARGET_CHARS_ADVANCED} Characters Target
                </h3>
                {extrapolation.daysTo3000 ? (
                  <>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {extrapolation.daysTo3000}{" "}
                      <span className="text-sm text-yellow-600 dark:text-yellow-400">
                        days remaining
                      </span>
                    </p>

                    <p className="text-xs text-yellow-500 dark:text-yellow-300 mt-1">
                      Projected{" "}
                      {extrapolation.dateTo3000?.toLocaleDateString("en-CA")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Target reached!
                  </p>
                )}
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Learning Rate
                </h3>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {extrapolation.charsPerDay} characters per day
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Based on overall progress trend
                </p>
              </div>
            </>
          )}
        </div>

        {/* Monthly Learning Rate Chart */}
        <MonthlyLearningRateChart
          characterProgress={characterProgress}
          charactersStartedLearning={charactersStartedLearning}
        />

        {/* Progress Chart */}
        <ProgressChart
          characterProgress={characterProgress}
          charactersStartedLearning={charactersStartedLearning}
        />

        {/* Daily Incremental Chart */}
        <DailyIncrementalChart
          dailyLearnedCharactersList={dailyLearnedCharactersList}
          dailyStartedCharactersList={dailyStartedCharactersList}
        />

        {/* Learning Time Distribution Chart */}
        <LearningTimeDistributionChart
          learningTimeDistribution={learningTimeDistribution}
        />

        {/* Learning Constants Display */}
        <LearningConstantsDisplay />
      </div>
    </div>
  );
};
