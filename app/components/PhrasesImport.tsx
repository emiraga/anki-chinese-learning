import React, { useState, useMemo, useEffect } from "react";
import { SchemaType } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";
import { useSettings } from "~/settings/SettingsContext";
import { useGenerativeModel } from "~/apis/google_genai";
import { useAnkiPhrases } from "~/data/phrases";
import anki from "~/apis/anki";
import Textarea from "react-textarea-autosize";
import { HanziText } from "./HanziText";

export interface ExtractedPhrase {
  traditional: string;
  pinyin: string;
  zhuyin?: string;
  meaning: string;
  isDuplicate?: boolean;
}

const PhrasesImport: React.FC = () => {
  const [inputText, setInputText] = useState<string>("");
  const [extractedPhrases, setExtractedPhrases] = useState<ExtractedPhrase[]>(
    []
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAddingToAnki, setIsAddingToAnki] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ankiSuccess, setAnkiSuccess] = useState<string | null>(null);
  const [selectedPhraseNoteIndex, setSelectedPhraseNoteIndex] =
    useState<number>(0);
  const { settings } = useSettings();
  const { phrases: existingPhrases, loading: phrasesLoading } =
    useAnkiPhrases();

  const genAImodel = useGenerativeModel(settings);

  // Create a set of existing traditional characters for quick lookup
  const existingPhrasesSet = useMemo(() => {
    return new Set(existingPhrases.map((phrase) => phrase.traditional));
  }, [existingPhrases]);

  // Reset selected phrase note index if it becomes invalid
  useEffect(() => {
    if (selectedPhraseNoteIndex >= settings.phraseNotes.length) {
      setSelectedPhraseNoteIndex(0);
    }
  }, [settings.phraseNotes.length, selectedPhraseNoteIndex]);

  const promptMain = `
Analyze the provided text and extract Chinese phrases/words with their corresponding information.

For each Chinese phrase or word found in the text, extract:
1. Traditional Chinese characters
2. Pinyin (romanization)
3. Zhuyin (optional, if available in the text)
4. English meaning/translation

The input text may be formatted in various ways (tables, lists, sentences, etc.). Please identify all Chinese phrases and their associated information regardless of formatting.

If pinyin or meaning is not explicitly provided in the text, use your knowledge to provide accurate pinyin and English translations for the traditional Chinese characters.

OUTPUT FORMAT: Return your response as JSON in this exact format:
{
  "phrases": [
    {
      "traditional": "Traditional Chinese characters here",
      "pinyin": "pinyin romanization here",
      "zhuyin": "zhuyin notation here (if available, otherwise omit this field)",
      "meaning": "English translation/meaning here"
    }
  ]
}

IMPORTANT RULES:
- Only use traditional characters, never simplified
- Provide accurate pinyin with tone marks
- If zhuyin is not available in the source text, omit the zhuyin field entirely
- Provide clear, concise English meanings
- Extract ALL Chinese phrases/words from the text, even if they appear in different formats
`;

  const handleExtractPhrases = async () => {
    if (!genAImodel) {
      setError("Please enter a valid API key first.");
      return;
    }

    if (!inputText.trim()) {
      setError("Please enter some text to analyze.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedPhrases([]);

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
                pinyin: { type: SchemaType.STRING },
                zhuyin: { type: SchemaType.STRING },
                meaning: { type: SchemaType.STRING },
              },
              required: ["traditional", "pinyin", "meaning"],
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
              text: `${promptMain}\n\nTEXT TO ANALYZE:\n${inputText}`,
            },
          ],
        },
      ],
      generationConfig,
    };

    try {
      const result = await genAImodel.generateContent(request);
      const responseText = result.response.text();
      const parsedResponse = JSON.parse(responseText);

      if (parsedResponse.phrases && parsedResponse.phrases.length > 0) {
        // Check for duplicates and mark them
        const phrasesWithDuplicateCheck = parsedResponse.phrases.map(
          (phrase: ExtractedPhrase) => ({
            ...phrase,
            isDuplicate: existingPhrasesSet.has(phrase.traditional),
          })
        );
        setExtractedPhrases(phrasesWithDuplicateCheck);
      } else {
        setError("No Chinese phrases found in the provided text.");
      }
    } catch (e) {
      console.error(e);
      setError(
        "Failed to extract phrases. Please check your API key and network connection."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setExtractedPhrases([]);
    setError(null);
    setAnkiSuccess(null);
  };

  const handleDeletePhrase = (indexToDelete: number) => {
    setExtractedPhrases((phrases) =>
      phrases.filter((_, index) => index !== indexToDelete)
    );
  };

  const handleAddToAnki = async () => {
    if (extractedPhrases.length === 0) {
      setError("No phrases to add to Anki.");
      return;
    }

    if (settings.phraseNotes.length === 0) {
      setError("No phrase note types configured in settings.");
      return;
    }

    if (selectedPhraseNoteIndex >= settings.phraseNotes.length) {
      setError("Selected note type is invalid.");
      return;
    }

    setIsAddingToAnki(true);
    setError(null);
    setAnkiSuccess(null);

    try {
      // Use the selected phrase note type
      const noteType = settings.phraseNotes[selectedPhraseNoteIndex];

      // Get deck name from the first card configuration, or use a default
      const deckName = noteType.cards?.[0]?.deckName || "Default";

      // Filter out duplicates if user wants to avoid them
      const phrasesToAdd = extractedPhrases.filter(
        (phrase) => !phrase.isDuplicate
      );

      if (phrasesToAdd.length === 0) {
        setError("No new phrases to add (all are duplicates).");
        setIsAddingToAnki(false);
        return;
      }

      // Prepare notes for Anki
      const notes = phrasesToAdd.map((phrase) => ({
        deckName: deckName,
        modelName: noteType.noteType,
        fields: {
          Traditional: phrase.traditional,
          Pinyin: phrase.pinyin,
          Meaning: phrase.meaning,
          ...(phrase.zhuyin ? { Zhuyin: phrase.zhuyin } : {}),
        },
        tags: [],
        options: {
          allowDuplicate: false,
        },
      }));

      // Add notes to Anki
      const results = await anki.note.addNotes({ notes });

      if (results) {
        const successCount = results.filter((id) => id !== null).length;
        const failureCount = results.length - successCount;

        if (successCount > 0) {
          // Get successful note IDs
          const successfulNoteIds = results.filter(
            (id) => id !== null
          ) as string[];

          // Get cards for the created notes and set due date to today
          try {
            const notesInfo = await anki.note.notesInfo({
              notes: successfulNoteIds.map((id) => parseInt(id)),
            });
            const allCardIds: number[] = [];

            for (const note of notesInfo) {
              allCardIds.push(...note.cards);
            }

            if (allCardIds.length > 0) {
              await anki.card.setDueDate({ cards: allCardIds, days: "0" });
            }
          } catch (dueDateError) {
            console.error("Failed to set due dates:", dueDateError);
            // Don't fail the whole operation if due date setting fails
          }

          setAnkiSuccess(
            `Successfully added ${successCount} phrases to Anki${
              failureCount > 0 ? ` (${failureCount} failed)` : ""
            }.`
          );
          // Remove successfully added phrases
          const failedIndices = new Set();
          results.forEach((id, index) => {
            if (id === null) failedIndices.add(index);
          });
          setExtractedPhrases((phrases) =>
            phrases.filter(
              (phrase, index) =>
                phrase.isDuplicate ||
                failedIndices.has(phrasesToAdd.findIndex((p) => p === phrase))
            )
          );
        } else {
          setError("Failed to add any phrases to Anki.");
        }
      } else {
        setError("Failed to add phrases to Anki.");
      }
    } catch (e) {
      console.error(e);
      setError(
        "Error adding phrases to Anki. Please check your Anki connection."
      );
    } finally {
      setIsAddingToAnki(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <div className="mb-6">
        <label
          htmlFor="inputText"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          Paste text containing Chinese phrases:
        </label>
        <Textarea
          id="inputText"
          minRows={6}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                     focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          placeholder="Paste your text here... It can contain Chinese phrases in any format (tables, lists, sentences, etc.)"
          disabled={isProcessing}
        />
      </div>

      {settings.phraseNotes.length > 1 && (
        <div className="mb-6">
          <label
            htmlFor="phraseNoteSelect"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
          >
            Anki Note Type:
          </label>
          <select
            id="phraseNoteSelect"
            value={selectedPhraseNoteIndex}
            onChange={(e) =>
              setSelectedPhraseNoteIndex(parseInt(e.target.value))
            }
            disabled={isProcessing || isAddingToAnki}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm text-gray-900 dark:text-gray-100
                       focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          >
            {settings.phraseNotes.map((phraseNote, index) => (
              <option key={index} value={index}>
                {phraseNote.noteType}
                {phraseNote.cards?.[0]?.deckName &&
                  ` (${phraseNote.cards[0].deckName})`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button
          onClick={handleExtractPhrases}
          disabled={isProcessing || !inputText.trim() || phrasesLoading}
          className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing
            ? "Extracting..."
            : phrasesLoading
            ? "Loading existing phrases..."
            : "Extract Phrases"}
        </button>
        <button
          onClick={handleClear}
          disabled={isProcessing || isAddingToAnki}
          className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
        {extractedPhrases.length > 0 && (
          <button
            onClick={handleAddToAnki}
            disabled={
              isProcessing ||
              isAddingToAnki ||
              extractedPhrases.filter((p) => !p.isDuplicate).length === 0
            }
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAddingToAnki
              ? "Adding to Anki..."
              : `Add to Anki (${
                  extractedPhrases.filter((p) => !p.isDuplicate).length
                })`}
          </button>
        )}
      </div>

      {(isProcessing || isAddingToAnki) && (
        <div className="text-center mb-6">
          <div
            className={`animate-spin mx-auto rounded-full h-8 w-8 border-b-2 mb-2 ${
              isAddingToAnki ? "border-green-600" : "border-sky-600"
            }`}
          ></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isProcessing
              ? "Analyzing text and extracting phrases..."
              : "Adding phrases to Anki..."}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {ankiSuccess && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p className="text-green-700 dark:text-green-400 text-sm">
            {ankiSuccess}
          </p>
        </div>
      )}

      {extractedPhrases.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Extracted Phrases ({extractedPhrases.length})
            {extractedPhrases.some((p) => p.isDuplicate) && (
              <span className="ml-2 text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ {extractedPhrases.filter((p) => p.isDuplicate).length}{" "}
                duplicates found
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {extractedPhrases.map((phrase, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg shadow-sm relative ${
                  phrase.isDuplicate
                    ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                    : "bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700"
                }`}
              >
                <button
                  onClick={() => handleDeletePhrase(index)}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete this phrase"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"></path>
                  </svg>
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Traditional
                    </span>
                    <p className="text-xl font-medium text-gray-900 dark:text-gray-100">
                      <HanziText value={phrase.traditional} />
                      {phrase.isDuplicate && (
                        <span className="text-sm ml-2 text-yellow-800 dark:text-yellow-200 font-medium">
                          ⚠️
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Pinyin
                    </span>
                    <p className="text-lg text-gray-800 dark:text-gray-200">
                      {phrase.pinyin}
                    </p>
                  </div>
                  {phrase.zhuyin && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Zhuyin
                      </span>
                      <p className="text-lg text-gray-800 dark:text-gray-200">
                        {phrase.zhuyin}
                      </p>
                    </div>
                  )}
                  <div
                    className={
                      phrase.zhuyin ? "md:col-span-1" : "md:col-span-2"
                    }
                  >
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Meaning
                    </span>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {phrase.meaning}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhrasesImport;
