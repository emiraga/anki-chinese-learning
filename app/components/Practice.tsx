import React, { useState, useMemo } from "react";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";
import type { PhraseType } from "~/data/phrases";
import { pickRandomElements } from "~/data/utils";
import { useSettings } from "~/settings/SettingsContext";

const MODEL = "gemini-1.5-flash";

// Defines the structure for a pair of sentences (English and Chinese)
interface SentencePair {
  english: string;
  chinese: string;
  userInput: string;
  userIsCorrect: boolean;
}

// Defines the structure for the feedback from the AI
interface AIFeedback {
  isCorrect: boolean;
  advice: string;
  grammarPoint: string;
}

const Practice: React.FC<{
  phrases: PhraseType[];
  characterList: string[];
}> = ({ phrases, characterList }) => {
  // --- State Management ---
  const [sentences, setSentences] = useState<SentencePair[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>("");
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState<boolean>(false);
  const {
    settings: { googleCloudApiKey },
  } = useSettings();

  // Memoize the AI model instance to avoid re-creation on every render
  const genAI = useMemo(() => {
    if (!googleCloudApiKey) return null;
    try {
      return new GoogleGenerativeAI(googleCloudApiKey);
    } catch (e) {
      console.error(e);
      setError("Failed to initialize AI. Please check your API key.");
      return null;
    }
  }, [googleCloudApiKey]);

  // --- Core Functions ---

  const promptMain: string = `\
Generate 10 simple English sentences for a beginner learning Mandarin
Chinese in Taiwan. For each sentence, provide the corresponding
translation in informal Traditional Chinese used in Taiwan.

${
  characterList.length > 0
    ? "Only use following traditional characters:\n" + characterList.join("")
    : ""
}

${
  phrases.length > 0
    ? "To inspire your creativity, here are some phrases or words:\n" +
      pickRandomElements(phrases, 30)
        .map((phrase) => phrase.traditional)
        .join("\n")
    : ""
}

Consider using these phrases or words in sentences that you genenerate,
but mix elements from various phrases to make a new sentence.
`;
  /**
   * Generates 10 simple English sentences and their Traditional Chinese translations.
   */
  const handleGenerateSentences = async () => {
    if (!genAI) {
      setError("Please enter a valid API key first.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setSentences([]);
    setCurrentSentenceIndex(0);
    setFeedback(null);
    setUserInput("");

    const model = genAI.getGenerativeModel({ model: MODEL });

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
                english: { type: SchemaType.STRING },
                chinese: { type: SchemaType.STRING },
              },
              required: ["english", "chinese"],
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
      const result = await model.generateContent(request);
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

  /**
   * Submits the user's translation for grading.
   */
  const handleSubmitAnswer = async () => {
    const currentSentence = sentences[currentSentenceIndex];
    setSentences((sentences) => {
      sentences[currentSentenceIndex].userInput = userInput;
      return sentences;
    });
    // First, check for an exact match to save an API call.
    if (userInput.trim() === currentSentence.chinese.trim()) {
      setShowCorrect(true);
      setSentences((sentences) => {
        sentences[currentSentenceIndex].userIsCorrect = true;
        return sentences;
      });
      setTimeout(() => {
        handleNextSentence();
        setShowCorrect(false);
      }, 2000); // Show "Correct!" for 2.0 seconds
    } else {
      // If it's not an exact match, ask the AI for a semantic evaluation.
      await handleGetFeedback();
    }
  };

  /**
   * Gets feedback from the AI on the user's incorrect translation.
   */
  const handleGetFeedback = async () => {
    if (!genAI) {
      setError("API key is not set.");
      return;
    }
    setIsGrading(true);
    setError(null);
    setFeedback(null);

    const model = genAI.getGenerativeModel({ model: MODEL });
    const currentSentence = sentences[currentSentenceIndex];

    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          isCorrect: { type: SchemaType.BOOLEAN },
          advice: { type: SchemaType.STRING },
          grammarPoint: { type: SchemaType.STRING },
        },
        required: ["isCorrect", "advice", "grammarPoint"],
      },
    };

    const promptFeeback: string = `
      A language learner is practicing Chinese. Please evaluate their translation.

      - English Sentence: "${currentSentence.english}"
      - Correct Traditional Chinese (Taiwan) Answer: "${currentSentence.chinese}"
      - User's Chinese Answer: "${userInput}"

      Based on this, please provide the following:
      1. isCorrect: A boolean indicating if the user's answer is semantically correct, even with minor typos or alternative phrasing.
      2. advice: A friendly and concise explanation of the user's mistakes if any.
      3. grammarPoint: A brief explanation of a relevant grammar points or vocabulary usages from the correct sentence that would help the user learn.

      Speak using English language, and avoid using simplified characters in explanations use traditional characters instead.
    `;

    const request = {
      contents: [{ role: "user", parts: [{ text: promptFeeback }] }],
      generationConfig,
    };

    try {
      const result = await model.generateContent(request);
      const responseText = result.response.text();
      const parsedFeedback: AIFeedback = JSON.parse(responseText);

      setSentences((sentences) => {
        sentences[currentSentenceIndex].userIsCorrect =
          parsedFeedback.isCorrect;
        return sentences;
      });

      // The AI is now the source of truth for correctness
      if (parsedFeedback.isCorrect) {
        // If the AI says it's correct, show a success message and move on
        setFeedback(null); // Clear any previous incorrect feedback
        setShowCorrect(true);
        setTimeout(() => {
          handleNextSentence();
          setShowCorrect(false);
        }, 2000); // Give user time to see the "Correct" message
      } else {
        // If incorrect, show the detailed feedback from the AI
        setFeedback(parsedFeedback);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to get feedback from the AI. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  /**
   * Moves to the next sentence in the list.
   */
  const handleNextSentence = () => {
    setFeedback(null);
    setUserInput("");
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    } else {
      setSentences([]);
      setCurrentSentenceIndex(0);
    }
  };

  return (
    <div className="text-slate-800">
      <div className="container mx-auto max-w-2xl">
        {/* Practice Area */}
        {sentences.length === 0 ? (
          <div className="text-center p-3">
            <button
              onClick={handleGenerateSentences}
              disabled={isGenerating}
              className="flex mx-auto justify-center items-center px-6 py-3 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                  Generating...
                </>
              ) : (
                "✍️ Start Writting Practice"
              )}
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

            <div className="mt-20">
              <span className="text-xs text-gray-500">Prompt preview:</span>
              <pre className="text-sm text-gray-400 whitespace-pre-wrap break-all font-mono bg-gray-100 text-left">
                {promptMain}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="text-center mb-4">
              <p className="text-sm font-semibold text-slate-500">
                Sentence {currentSentenceIndex + 1} of {sentences.length}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                <div
                  className="bg-sky-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      ((currentSentenceIndex + 1) / sentences.length) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="mb-6 p-4 bg-slate-100 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">English Sentence:</p>
              <p className="text-lg font-semibold text-slate-900">
                {sentences[currentSentenceIndex].english}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="userInput"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  Your Chinese Translation:
                </label>
                <input
                  type="text"
                  id="userInput"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-lg shadow-sm placeholder-slate-400
                                 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="Please enter your translation here"
                  disabled={!!feedback || showCorrect || isGrading}
                />
              </div>
              <button
                onClick={handleSubmitAnswer}
                disabled={isGrading || !userInput || !!feedback || showCorrect}
                className="w-full flex justify-center items-center px-4 py-3 bg-green-600 text-white font-bold rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                {isGrading ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                    Grading...
                  </>
                ) : (
                  "Submit Answer"
                )}
              </button>
            </div>

            {showCorrect && (
              <>
                <div className="mt-4 p-4 bg-green-100 border-l-4 border-green-500 text-green-800 rounded-r-lg">
                  <p className="font-bold">Correct! Well done!</p>
                </div>
                {/* Comparison */}
                <div className="p-4 bg-slate-100 rounded-lg">
                  <h4 className="font-bold text-slate-900 mb-2">Comparison</h4>
                  <p className="text-sm">
                    <span className="font-semibold text-green-700">
                      Correct:
                    </span>{" "}
                    {sentences[currentSentenceIndex].chinese}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold text-red-700">Yours:</span>{" "}
                    {userInput}
                  </p>
                </div>
              </>
            )}

            {/* Feedback Section */}
            {feedback && (
              <div className="mt-6 border-t pt-6">
                <div className="space-y-4">
                  {/* Comparison */}
                  <div className="p-4 bg-slate-100 rounded-lg">
                    <h4 className="font-bold text-slate-900 mb-2">
                      Comparison
                    </h4>
                    <p className="text-sm">
                      <span className="font-semibold text-green-700">
                        Correct:
                      </span>{" "}
                      {sentences[currentSentenceIndex].chinese}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-red-700">Yours:</span>{" "}
                      {userInput}
                    </p>
                  </div>
                  {/* Advice */}
                  <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                    <h4 className="font-bold text-amber-900">Advice</h4>
                    <p className="text-amber-800">{feedback.advice}</p>
                  </div>
                  {/* Grammar Point */}
                  <div className="p-4 bg-sky-50 border-l-4 border-sky-400 rounded-r-lg">
                    <h4 className="font-bold text-sky-900">Grammar Point</h4>
                    <p className="text-sky-800">{feedback.grammarPoint}</p>
                  </div>
                </div>
                <button
                  onClick={handleNextSentence}
                  className="mt-6 w-full px-4 py-2 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 transition-colors"
                >
                  Next Sentence
                </button>
              </div>
            )}
          </div>
        )}
        {currentSentenceIndex > 0 ? (
          <>
            History:
            {sentences.slice(0, currentSentenceIndex).map((s, i) => (
              <p key={i}>
                {s.userIsCorrect ? "✅" : "⛔️"}
                {s.chinese} || {s.userInput} || {s.english}
              </p>
            ))}
          </>
        ) : undefined}
      </div>
    </div>
  );
};

export default Practice;
