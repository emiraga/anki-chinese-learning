import { useEffect, useState } from "react";
import anki from "~/apis/anki";

/**
 * A React component that renders Anki note content, automatically
 * fetching and embedding media files like images.
 */
const AnkiContentRenderer: React.FC<{
  htmlContent: string;
  className?: string;
}> = ({ htmlContent, className }) => {
  // State to hold the HTML after processing image sources.
  const [processedHtml, setProcessedHtml] = useState<string>("");
  // State to track if we are currently fetching media.
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Define an async function to process the HTML.
    const processAndEmbedMedia = async () => {
      setIsLoading(true);

      // Use the browser's built-in DOMParser to safely parse the HTML string.
      // This is more robust and safer than using regular expressions.
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");

      // Find all image elements in the parsed HTML.
      const images = Array.from(doc.querySelectorAll("img"));

      // If there are no images, we can just use the original HTML.
      if (images.length === 0) {
        setProcessedHtml(htmlContent);
        setIsLoading(false);
        return;
      }

      // Create an array of promises for fetching all image data concurrently.
      const imagePromises = images.map(async (img) => {
        const originalSrc = img.getAttribute("src");
        if (!originalSrc) return;

        try {
          // Anki media filenames in HTML can be URL-encoded (e.g., spaces become %20).
          // We need to decode it to get the actual filename.
          const filename = decodeURIComponent(originalSrc);

          // Use the provided anki-connect function to retrieve the media file.
          // This returns the file's data as a base64 encoded string.
          const mediaData = await anki.media.retrieveMediaFile({ filename });

          if (mediaData) {
            // If data is retrieved, construct a data URL.
            // First, determine the image's MIME type from its file extension.
            const extension = filename.split(".").pop()?.toLowerCase();
            let mimeType = "image/jpeg"; // Default MIME type
            if (extension === "png") mimeType = "image/png";
            if (extension === "gif") mimeType = "image/gif";
            if (extension === "svg") mimeType = "image/svg+xml";
            if (extension === "webp") mimeType = "image/webp";

            // Set the image's src attribute to the new data URL.
            // The browser can render this directly without making a network request.
            img.src = `data:${mimeType};base64,${mediaData}`;
          } else {
            // If media retrieval fails, log a warning and update the image
            // to show it couldn't be loaded.
            console.warn(`Could not retrieve media file: ${filename}`);
            img.alt = `Failed to load: ${filename}`;
            // You can use a placeholder service or a local asset for broken images.
            img.src = `https://placehold.co/100x50/f87171/ffffff?text=Not+Found`;
            img.style.border = "2px dashed red";
          }
        } catch (error) {
          console.error(
            `Error processing image with src: ${originalSrc}`,
            error
          );
        }
      });

      // Wait for all the image fetching and processing to complete.
      await Promise.all(imagePromises);

      // Serialize the modified HTML document body back into a string.
      setProcessedHtml(doc.body.innerHTML);
      setIsLoading(false);
    };

    processAndEmbedMedia();

    // This effect should re-run if the source HTML content changes.
  }, [htmlContent]);

  // While loading, you can show a simple message or a spinner component.
  const content = isLoading
    ? `<div class="p-4 text-center text-gray-500 dark:text-gray-400">Loading content...</div>`
    : processedHtml;

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

export default AnkiContentRenderer;
