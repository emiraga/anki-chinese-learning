import React, { useState } from "react";
import { SchemaType } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";
import type { PhraseType } from "~/data/phrases";
import { pickRandomElements, useLocalStorageState } from "~/data/utils";
import { useSettings } from "~/settings/SettingsContext";
import { useGenerativeModel } from "~/apis/google_genai";
import {
  PracticeEnglishToChinese,
  PracticeListeningToChinese,
} from "./PracticeTypes";
import Textarea from "react-textarea-autosize";

export interface PracticeSentencePair {
  english: string;
  chinese: string;
}

export enum PracticeHistoryType {
  CORRECT,
  WRONG,
  SKIPPED,
}

export interface PracticeHistory {
  english: string;
  chinese: string;
  userInput?: string;
  type: PracticeHistoryType;
  aiAdvice?: string;
  aiGrammarPoint?: string;
}

enum PracticeType {
  ENGLISH_TO_CHINESE_TEXT,
  LISTENING_TO_CHINESE,
}

const Practice: React.FC<{
  phrases: PhraseType[];
  characterList: string[];
}> = ({ phrases, characterList }) => {
  const [sentences, setSentences] = useState<PracticeSentencePair[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [practiceType, setPracticeType] = useState<PracticeType>(
    PracticeType.ENGLISH_TO_CHINESE_TEXT
  );
  const { settings } = useSettings();
  const [history, setHistory] = useState<PracticeHistory[]>([]);
  const [instructions, setInstructions] = useLocalStorageState<string>(
    "practicePromptCustomInstructions",
    ""
  );

  const [error, setError] = useState<string | null>(null);

  // Memoize the AI model instance to avoid re-creation on every render
  const genAImodel = useGenerativeModel(settings);

  // --- Core Functions ---

  const promptMain: string = `\
Generate 10 Mandarin Chinese sentences for a student learning Mandarin Chinese and living in Taiwan.
For each sentence, provide the corresponding translation to English.

Your sentences should be the normal way that chinese is used in Taiwan, not mainland China.

Only use traditional characters, and never simplified characters.

${
  characterList.length > 0
    ? "Student has a limited vocabulary, so only use these characters: " +
      characterList.join("") +
      "\n\nDo not use any other characters!"
    : ""
}

${
  phrases.length > 0
    ? "To inspire your creativity, here are some phrases or words:\n" +
      pickRandomElements(phrases, 60)
        .map((phrase) => phrase.traditional)
        .join("\n")
    : ""
}

Consider using these phrases or words in sentences that you genenerate,
but mix elements from various phrases to make a new sentence.

${instructions}
`;
  /**
   * Generates 10 simple English sentences and their Traditional Chinese translations.
   */
  const handleGenerateSentences = async () => {
    if (!genAImodel) {
      setError("Please enter a valid API key first.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setSentences([]);

    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          sentences: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                chinese: { type: SchemaType.STRING },
                english: { type: SchemaType.STRING },
              },
              required: ["chinese", "english"],
            },
          },
        },
        required: ["sentences"],
      },
    };

    const request = {
      contents: [{ role: "user", parts: [{ text: promptMain }] }],
      generationConfig,
    };

    try {
      const result = await genAImodel.generateContent(request);
      const responseText = result.response.text();
      const parsedResponse = JSON.parse(responseText);

      if (parsedResponse.sentences && parsedResponse.sentences.length > 0) {
        setSentences(parsedResponse.sentences);
      } else {
        setError("AI did not return the expected sentence format.");
      }
    } catch (e) {
      console.error(e);
      setError(
        "Failed to generate sentences. Please check your API key and network connection."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const historyUI =
    history.length > 0 ? (
      <>
        History:
        {[...history].reverse().map((s, i) => (
          <p key={i}>
            {s.type === PracticeHistoryType.CORRECT
              ? "✅"
              : s.type === PracticeHistoryType.WRONG
              ? "⛔️"
              : "🟡"}{" "}
            {s.chinese} || {s.userInput} || {s.english}
            {s.aiAdvice || s.aiGrammarPoint ? (
              <span className="text-xs block">
                {s.aiAdvice} || {s.aiGrammarPoint}
              </span>
            ) : undefined}
          </p>
        ))}
      </>
    ) : undefined;

  if (sentences.length === 0) {
    /* Choosing which type of practice we will do. */
    return (
      <>
        <div className="container mx-auto max-w-2xl text-center p-3">
          {isGenerating ? (
            <>
              <div className="animate-spin mx-auto rounded-full h-16 w-16 m-4 border-b-2 border-gray-900 mb-4"></div>
              Generating...
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor="userInput"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  (optional) Any instructions for the practice:
                </label>
                <Textarea
                  id="userInput"
                  minRows={1}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 mb-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-md shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="For example: Focus on..."
                  disabled={isGenerating}
                />
              </div>

              <button
                onClick={async () => {
                  setPracticeType(PracticeType.ENGLISH_TO_CHINESE_TEXT);
                  await handleGenerateSentences();
                }}
                className="mr-2 justify-center items-center px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                English to Chinese Practice
              </button>
              <button
                onClick={async () => {
                  setPracticeType(PracticeType.LISTENING_TO_CHINESE);
                  await handleGenerateSentences();
                }}
                className="ml-2 justify-center items-center px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                Chinese Listening Practice
              </button>
            </>
          )}
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <div className="mt-20">
            <span className="text-xs text-gray-500 dark:text-gray-400">Prompt preview:</span>
            <pre className="text-sm text-gray-400 dark:text-gray-300 whitespace-pre-wrap break-all font-mono bg-gray-100 dark:bg-gray-800 text-left p-3 rounded">
              {promptMain}
            </pre>
          </div>
        </div>
        {historyUI}
      </>
    );
  }

  if (!genAImodel) {
    return <>Issue with Generative AI model</>;
  }

  const addHistory = (add: PracticeHistory) => {
    setHistory((history) => [...history, add]);
  };

  const finishedPractice = () => setSentences([]);

  switch (practiceType) {
    case PracticeType.ENGLISH_TO_CHINESE_TEXT:
      return (
        <>
          <PracticeEnglishToChinese
            characterList={characterList}
            genAImodel={genAImodel}
            sentences={sentences}
            setError={setError}
            finishedPracticeCallback={finishedPractice}
            addHistoryCallback={addHistory}
          />
          {historyUI}
        </>
      );
    case PracticeType.LISTENING_TO_CHINESE: {
      return (
        <>
          <PracticeListeningToChinese
            characterList={characterList}
            genAImodel={genAImodel}
            sentences={sentences}
            setError={setError}
            finishedPracticeCallback={finishedPractice}
            addHistoryCallback={addHistory}
          />
          {historyUI}
        </>
      );
    }
  }
};

export default Practice;
