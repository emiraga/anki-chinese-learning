import { useEffect, useRef, useState } from "react";
import anki from "~/apis/anki";
import { useAsync } from "react-async-hook";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const AnkiStatsRenderer: React.FC<{ htmlContent: string }> = ({
  htmlContent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!htmlContent || !containerRef.current) return;

    // Load jQuery and Flot libraries
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          // resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const initializeAnkiStats = async () => {
      if (!containerRef.current) {
        throw new Error("containerRef.current is null");
      }

      try {
        // Load jQuery first
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"
        );

        // Load Flot
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.min.js"
        );
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.stack.min.js"
        );
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/flot/0.8.3/jquery.flot.pie.min.js"
        );

        // Process the HTML content
        let processedHTML = htmlContent;
        const scriptContents: string[] = [];

        const scriptMatches = [
          ...htmlContent.matchAll(/<script>([\s\S]*?)<\/script>/g),
        ];

        scriptMatches.forEach((match) => {
          scriptContents.push(match[1]);
        });

        // Remove all script tags from HTML
        processedHTML = processedHTML.replace(
          /<script>[\s\S]*?<\/script>/g,
          ""
        );

        // Set the processed HTML
        containerRef.current.innerHTML = processedHTML;

        // Execute each script in the context where jQuery is available
        scriptContents.forEach((scriptContent) => {
          try {
            const executeScript = new Function("$", "jQuery", scriptContent);
            // @ts-expect-error next-line
            executeScript(window.jQuery, window.jQuery);
          } catch (scriptError) {
            console.error("Error executing script:", scriptError);
          }
        });
      } catch (error) {
        console.error("Error loading Anki stats:", error);
        // Fallback: show HTML without graphs
        containerRef.current.innerHTML = htmlContent.replace(
          /<script>[\s\S]*?<\/script>/g,
          ""
        );
      }
    };

    initializeAnkiStats();
  }, [htmlContent]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div
        ref={containerRef}
        className="anki-stats-container"
        style={{
          // Add some basic styling for the stats
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
        }}
      />
      <style>{`
        .anki-stats-container table {
          border-collapse: collapse;
          margin: 10px 0;
        }
        .anki-stats-container td {
          padding: 4px 8px;
        }
        .anki-stats-container h1 {
          font-size: 18px;
          font-weight: bold;
          margin: 20px 0 10px 0;
        }
        .anki-stats-container .section {
          margin: 20px 0;
        }
        .pielabel {
          text-align: center;
          font-weight: bold;
          color: white;
          text-shadow: 1px 1px 1px black;
        }
      `}</style>
    </div>
  );
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHanziProgress = async () => {
      try {
        setLoading(true);
        // 1. Get all notes of the "Hanzi" note type
        // AnkiConnect's 'findNotes' action allows querying by note type
        const hanziNoteIds = await anki.note.findNotes({
          query: 'note:"Hanzi" -is:new -is:suspended',
        });

        // 2. Get detailed information for these notes (to extract the character field)
        const hanziNotesInfo = await anki.note.notesInfo({
          notes: hanziNoteIds,
        });

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
        const batchSize = 100; // Process 100 cards at a time
        const reviewsOfCards: { [key: string]: AnkiReview[] } = {};

        console.log(
          `Fetching reviews for ${allCardIds.length} cards in batches of ${batchSize}`
        );

        for (let i = 0; i < allCardIds.length; i += batchSize) {
          const batch = allCardIds.slice(i, i + batchSize);
          console.log(
            `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
              allCardIds.length / batchSize
            )} (${batch.length} cards)`
          );

          const batchReviews = await anki.statistic.getReviewsOfCards({
            cards: batch,
          });

          console.log(
            `Batch returned ${
              Object.keys(batchReviews).length
            } card review sets`
          );
          Object.assign(reviewsOfCards, batchReviews);
        }

        console.log(
          `Total reviews fetched for ${
            Object.keys(reviewsOfCards).length
          } cards`
        );

        // 4. Process reviews to build the daily character graph
        const dailyLearnedCharacters: { [key: string]: number } = {};
        const seenCharacters = new Set(); // To track uniquely learned characters

        // Sort reviews by timestamp to ensure chronological processing
        // Note: The 'id' in reviews is the reviewTime in milliseconds
        const allReviews: { cardId: string; id: number; ease: number }[] = [];

        Object.entries(reviewsOfCards).forEach(([cardId, reviews]) => {
          allReviews.push(
            ...reviews.map((r) => ({ id: r.id, ease: r.ease, cardId }))
          );
        });

        allReviews.sort((a, b) => a.id - b.id);

        allReviews.forEach((review) => {
          const cardId = review.cardId; // Anki-Connect getReviewsOfCards sample doesn't include cardId in review object.
          // This is a potential issue. You might need to restructure if it's not present.
          // For now, let's assume getReviewsOfCards returns { "cardId": [{review}, {review}] }
          // or we'd need to iterate through reviewsOfCards structure.
          // Based on the sample, reviewsOfCards is a map of cardId to list of reviews.
          // So, we need to iterate reviewsOfCards:
          const char = noteToCharMap[cardId]; // char for this review's card

          if (char && !seenCharacters.has(char)) {
            // A character is "learned" on its first "Good" or "Easy" review
            // Review 'type': 0 = learning, 1 = review, 2 = relearn, 3 = cram
            // 'ease': 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
            if (review.ease >= 3) {
              // Good or Easy
              const reviewDate = new Date(review.id).toLocaleDateString(
                "en-CA"
              ); // YYYY-MM-DD
              // Add this character to the count for this date
              dailyLearnedCharacters[reviewDate] =
                (dailyLearnedCharacters[reviewDate] || 0) + 1;
              seenCharacters.add(char); // Mark as learned
            }
          }
        });

        // Convert to cumulative graph data
        const sortedDates = Object.keys(dailyLearnedCharacters).sort();
        let cumulativeCount = 0;
        const cumulativeGraphData: { [key: string]: number } = {};

        sortedDates.forEach((date) => {
          cumulativeCount += dailyLearnedCharacters[date];
          cumulativeGraphData[date] = cumulativeCount;
        });

        setCharacterProgress(cumulativeGraphData);
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

  return { characterProgress, loading, error };
};

// Helper function to calculate linear regression
const calculateLinearRegression = (data: [number, number][]) => {
  const n = data.length;
  if (n < 2) return null;

  const sumX = data.reduce((sum, [x]) => sum + x, 0);
  const sumY = data.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = data.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumXX = data.reduce((sum, [x]) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

// Helper function to extrapolate progress
const extrapolateProgress = (characterProgress: { [key: string]: number }) => {
  const entries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  if (entries.length < 2) return null;

  // Convert dates to timestamps for regression
  const dataPoints: [number, number][] = entries.map(([date, count]) => [
    new Date(date).getTime(),
    count,
  ]);

  const regression = calculateLinearRegression(dataPoints);
  if (!regression) return null;

  const { slope, intercept } = regression;
  const currentDate = new Date();
  const currentCount = entries[entries.length - 1][1];

  // Calculate days until targets (slope is chars per millisecond, convert to chars per day)
  const charsPerDay = slope * (24 * 60 * 60 * 1000);

  if (charsPerDay <= 0) return null; // No progress or declining

  const daysTo2000 = Math.ceil((2000 - currentCount) / charsPerDay);
  const daysTo3000 = Math.ceil((3000 - currentCount) / charsPerDay);

  const dateTo2000 = new Date(
    currentDate.getTime() + daysTo2000 * 24 * 60 * 60 * 1000
  );
  const dateTo3000 = new Date(
    currentDate.getTime() + daysTo3000 * 24 * 60 * 60 * 1000
  );

  return {
    charsPerDay: Math.round(charsPerDay * 10) / 10, // Round to 1 decimal
    daysTo2000: daysTo2000 > 0 ? daysTo2000 : null,
    daysTo3000: daysTo3000 > 0 ? daysTo3000 : null,
    dateTo2000: daysTo2000 > 0 ? dateTo2000 : null,
    dateTo3000: daysTo3000 > 0 ? dateTo3000 : null,
    regression,
  };
};

// Recharts Progress Chart Component
const ProgressChart: React.FC<{
  characterProgress: { [key: string]: number };
}> = ({ characterProgress }) => {
  const extrapolation = extrapolateProgress(characterProgress);

  if (Object.keys(characterProgress).length === 0) {
    return <div>No data to display</div>;
  }

  // Prepare actual progress data
  const entries = Object.entries(characterProgress).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const allData = entries.map(([date, count]) => ({
    date,
    actual: count,
    dateObj: new Date(date),
  }));

  // Calculate max value for Y-axis
  const maxValue = Math.max(...entries.map(([, count]) => count));
  const yAxisMax = Math.ceil(maxValue * 1.1); // Add 10% padding above max

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label).toLocaleDateString();
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="text-sm font-medium">{date}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} characters
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Format date for x-axis
  const formatXAxisDate = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <div className="w-full h-96 mb-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={allData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisDate}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis domain={[0, yAxisMax]} tick={{ fontSize: 12 }} tickCount={8} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Actual progress line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            name="Actual Progress"
            connectNulls={false}
          />
          
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AnkiHtmlStats: React.FC<{}> = ({}) => {
  const { loading, error, result } = useAsync(
    async () =>
      await anki.statistic.getCollectionStatsHTML({
        wholeCollection: true,
      }),
    []
  );

  if (loading || !result) {
    return <>Loading HTML...</>;
  }

  if (error) {
    return <>Error with HTML: {error.message}</>;
  }

  return (
    <>
      <AnkiStatsRenderer htmlContent={result} />
    </>
  );
};

export const AnkiHanziProgress = () => {
  const { characterProgress, loading, error } = useAnkiHanziProgress();

  if (loading) {
    return <div>Loading Anki data...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (Object.keys(characterProgress).length === 0) {
    return <div>No Hanzi characters learned yet or no data found.</div>;
  }

  const extrapolation = extrapolateProgress(characterProgress);
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
        <h2 className="text-2xl font-bold mb-4">Hanzi Learning Progress</h2>

        {/* Progress Chart */}
        <ProgressChart characterProgress={characterProgress} />

        {/* Progress Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">
              {currentCount} Characters Progress
            </h3>
            <p className="text-2xl font-bold text-blue-600">
              {totalDays} <span className="text-sm">days past</span>
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Since {firstDate?.toLocaleDateString()}
            </p>
          </div>

          {extrapolation && (
            <>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-800">
                  2000 Characters Target
                </h3>
                {extrapolation.daysTo2000 ? (
                  <>
                    <p className="text-2xl font-bold text-red-600">
                      {extrapolation.daysTo2000}{" "}
                      <span className="text-sm text-red-600">
                        days remaining
                      </span>
                    </p>

                    <p className="text-xs text-red-500 mt-1">
                      {extrapolation.dateTo2000?.toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-red-600">Target reached!</p>
                )}
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-800">
                  3000 Characters Target
                </h3>
                {extrapolation.daysTo3000 ? (
                  <>
                    <p className="text-2xl font-bold text-yellow-600">
                      {extrapolation.daysTo3000}{" "}
                      <span className="text-sm text-yellow-600">
                        days remaining
                      </span>
                    </p>

                    <p className="text-xs text-yellow-500 mt-1">
                      {extrapolation.dateTo3000?.toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-yellow-600">Target reached!</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Learning Rate */}
        {extrapolation && (
          <div className="mt-4 bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Learning Rate</h3>
            <p className="text-lg font-bold text-green-600">
              {extrapolation.charsPerDay} characters per day
            </p>
            <p className="text-sm text-green-600">
              Based on recent progress trend
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
