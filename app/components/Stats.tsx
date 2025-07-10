import { useEffect, useRef, useState } from "react";
import anki from "~/apis/anki";
import { useAsync } from "react-async-hook";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HtmlStats: React.FC<{}> = ({}) => {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AnkiHanziProgress = () => {
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
        // Assuming your "Hanzi" note type has a field named "HanziCharacter"
        // Adjust 'HanziCharacter' to the actual field name in your note type that stores the character.
        const noteToCharMap: { [key: string]: string } = {};
        const allCardIds: string[] = [];
        hanziNotesInfo.forEach((note) => {
          const character = note.fields.Traditional?.value; // Replace 'HanziCharacter'
          if (character) {
            const cardId = note.cards[0].toString();
            noteToCharMap[cardId] = character;
            allCardIds.push(cardId);
          }
        });

        // 3. Get all reviews for the cards associated with these Hanzi notes
        const reviewsOfCards = await anki.statistic.getReviewsOfCards({
          cards: allCardIds,
        });

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

  if (loading) {
    return <div>Loading Anki data...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (Object.keys(characterProgress).length === 0) {
    return <div>No Hanzi characters learned yet or no data found.</div>;
  }

  // You would then render this data using a charting library (e.g., Chart.js, Recharts, Nivo)
  // For simplicity, let's just display it as text for now.
  return (
    <div>
      <h2>Historical Hanzi Character Learning Progress</h2>
      <ul>
        {Object.entries(characterProgress).map(([date, count]) => (
          <li key={date}>
            {date}: {count} characters learned so far
          </li>
        ))}
      </ul>
      {/* Implement your charting component here, passing characterProgress as data */}
      {/* Example: <LineChart data={characterProgress} /> */}
    </div>
  );
};
