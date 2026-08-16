import React, { useState, useMemo } from "react";
import { SchemaType } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";
import { useSettings } from "~/settings/SettingsContext";
import { useGenerativeModel } from "~/apis/google_genai";
import { useAnkiPhrases } from "~/data/phrases";
import Textarea from "react-textarea-autosize";
import { PhraseLink } from "./Phrase";

interface ProcessedPhrase {
  traditional: string;
  pinyin: string;
  meaning: string;
  comment: string;
}

const DEFAULT_PROMPT = `Analyze the following Chinese phrases and identify which ones are unlikely to be spoken verbally in everyday conversation and therefore don't need spaced repetition flashcards with audio.

Consider phrases that:
- Are only used in formal/written contexts
- Have more common spoken alternatives
- Are literary or archaic expressions
- Are technical terms rarely spoken aloud

For each phrase that doesn't need audio cards, provide a brief comment explaining why. Only return phrases that should NOT have audio cards - do not include commonly spoken phrases in your response.`;

const PhrasesProcess: React.FC = () => {
  const [maxLength, setMaxLength] = useState<number>(4);
  const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);
  const [processedPhrases, setProcessedPhrases] = useState<ProcessedPhrase[]>(
    []
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();
  const { phrases, loading: phrasesLoading } = useAnkiPhrases();

  const genAImodel = useGenerativeModel(settings);

  // Filter phrases by max length
  const filteredPhrases = useMemo(() => {
    return phrases.filter(
      (phrase) => phrase.traditional.length <= maxLength
    );
  }, [phrases, maxLength]);

  const handleProcess = async () => {
    if (!genAImodel) {
      setError("Please enter a valid API key first.");
      return;
    }

    if (filteredPhrases.length === 0) {
      setError("No phrases to process after filtering.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessedPhrases([]);

    // Prepare phrases data for AI
    const phrasesData = filteredPhrases.map((p) => ({
      traditional: p.traditional,
      pinyin: p.pinyin,
      meaning: p.meaning,
    }));

    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          phrases: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                traditional: { type: SchemaType.STRING },
                comment: { type: SchemaType.STRING },
              },
              required: ["traditional", "comment"],
            },
          },
        },
        required: ["phrases"],
      },
    };

    const request = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${customPrompt}\n\nPHRASES TO ANALYZE:\n${JSON.stringify(phrasesData, null, 2)}`,
            },
          ],
        },
      ],
      generationConfig,
    };

    try {
      const result = await genAImodel.generateContent(request);
      const responseText = result.response.text();
      const parsedResponse = JSON.parse(responseText) as {
        phrases: { traditional: string; comment: string }[];
      };

      if (parsedResponse.phrases && parsedResponse.phrases.length > 0) {
        // Match back with original phrase data for pinyin and meaning
        const processedWithDetails = parsedResponse.phrases.map((p) => {
          const original = filteredPhrases.find(
            (fp) => fp.traditional === p.traditional
          );
          return {
            traditional: p.traditional,
            pinyin: original?.pinyin || "",
            meaning: original?.meaning || "",
            comment: p.comment,
          };
        });
        setProcessedPhrases(processedWithDetails);
      } else {
        setProcessedPhrases([]);
      }
    } catch (e) {
      console.error(e);
      setError(
        "Failed to process phrases. Please check your API key and network connection."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setProcessedPhrases([]);
    setError(null);
  };

  const handleResetPrompt = () => {
    setCustomPrompt(DEFAULT_PROMPT);
  };

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Process Phrases with AI
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="maxLength"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Maximum Traditional Length:
            </label>
            <input
              type="number"
              id="maxLength"
              min={1}
              max={20}
              value={maxLength}
              onChange={(e) => setMaxLength(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm text-gray-900 dark:text-gray-100
                         focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              disabled={isProcessing}
            />
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {phrasesLoading ? (
                "Loading phrases..."
              ) : (
                <>
                  Total phrases: {phrases.length} | After filter:{" "}
                  {filteredPhrases.length}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label
              htmlFor="customPrompt"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              AI Prompt:
            </label>
            <button
              onClick={handleResetPrompt}
              className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Reset to Default
            </button>
          </div>
          <Textarea
            id="customPrompt"
            minRows={6}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={handleProcess}
          disabled={isProcessing || phrasesLoading || filteredPhrases.length === 0}
          className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing
            ? "Processing..."
            : phrasesLoading
              ? "Loading phrases..."
              : `Process ${filteredPhrases.length} Phrases`}
        </button>
        <button
          onClick={handleClear}
          disabled={isProcessing}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          Clear Results
        </button>
      </div>

      {isProcessing && (
        <div className="text-center mb-6">
          <div className="animate-spin mx-auto rounded-full h-8 w-8 border-b-2 border-sky-600 mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Processing phrases with AI...
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {processedPhrases.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Phrases That May Not Need Audio Cards ({processedPhrases.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Traditional
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pinyin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Meaning
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Comment
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {processedPhrases.map((phrase, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 whitespace-nowrap text-lg font-medium text-gray-900 dark:text-gray-100">
                      <PhraseLink value={phrase.traditional} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {phrase.pinyin}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {phrase.meaning}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {phrase.comment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isProcessing && processedPhrases.length === 0 && !error && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>
            Click &quot;Process Phrases&quot; to analyze which phrases may not need audio
            cards.
          </p>
        </div>
      )}
    </div>
  );
};

export default PhrasesProcess;
