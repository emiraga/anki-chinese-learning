import { useEffect, useRef } from "react";
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

