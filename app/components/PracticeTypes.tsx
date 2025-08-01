import {
  GenerativeModel,
  SchemaType,
  type GenerationConfig,
} from "@google/generative-ai";
import { useState } from "react";
import GenerateAudio from "./GenerateAudio";
import {
  PracticeHistoryType,
  type PracticeHistory,
  type PracticeSentencePair,
} from "./Practice";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { HanziText } from "./HanziText";

// Defines the structure for the feedback from the AI
interface AIFeedback {
  advice: string;
  grammarPoint: string;
  isCorrect: boolean;
}

export const PracticeWarnUknownChars: React.FC<{
  characterList: string[];
  sentence: string;
}> = ({ characterList, sentence }) => {
  const unknown = [...sentence].filter((c) => {
    if (IGNORE_PHRASE_CHARS.has(c)) {
      return false;
    }
    return !characterList.includes(c);
  });
  if (unknown.length === 0) {
    return undefined;
  }
  return (
    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 rounded-lg border border-red-300 dark:border-red-700">
      <p className="text-sm text-slate-600 dark:text-red-300 mb-1">
        Warning uknown chars:
      </p>
      <p className="text-5xl font-semibold text-slate-900 dark:text-red-100">
        <HanziText value={unknown.join("")} />
      </p>
      <p className="text-sm text-slate-600 dark:text-red-300 my-1">
        Given that AI used some characters that are uknown to you, consider
        skipping this sentence, unless you can figure it out with your current
        vocabulary.
      </p>
    </div>
  );
};

export const PracticeEnglishToChinese: React.FC<{
  characterList: string[];
  genAImodel: GenerativeModel;
  sentences: PracticeSentencePair[];
  setError: (_: string | null) => void;
  finishedPracticeCallback: () => void;
  addHistoryCallback: (add: PracticeHistory) => void;
}> = ({
  characterList,
  sentences,
  genAImodel,
  setError,
  finishedPracticeCallback,
  addHistoryCallback,
}) => {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>("");
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [showCorrect, setShowCorrect] = useState<boolean>(false);

  /**
   * Submits the user's translation for grading.
   */
  const handleSubmitAnswer = async () => {
    const currentSentence = sentences[currentSentenceIndex];
    // First, check for an exact match to save an API call.
    if (userInput.trim() === currentSentence.chinese.trim()) {
      setShowCorrect(true);
      addHistoryCallback({
        ...sentences[currentSentenceIndex],
        userInput: userInput,
        type: PracticeHistoryType.CORRECT,
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

  const handleSkipAnswer = async () => {
    addHistoryCallback({
      ...sentences[currentSentenceIndex],
      userInput: userInput,
      type: PracticeHistoryType.SKIPPED,
    });
    handleNextSentence();
    setShowCorrect(false);
  };

  /**
   * Gets feedback from the AI on the user's incorrect translation.
   */
  const handleGetFeedback = async () => {
    if (!genAImodel) {
      setError("API key is not set.");
      return;
    }
    setIsGrading(true);
    setError(null);
    setFeedback(null);

    const currentSentence = sentences[currentSentenceIndex];

    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          advice: { type: SchemaType.STRING },
          grammarPoint: { type: SchemaType.STRING },
          isCorrect: { type: SchemaType.BOOLEAN },
        },
        required: ["advice", "grammarPoint", "isCorrect"],
      },
    };

    const promptFeeback: string = `
      A language learner is practicing Chinese. Please evaluate their translation.

      - English Sentence: "${currentSentence.english}"
      - Correct Traditional Chinese (Taiwan) Answer: "${currentSentence.chinese}"
      - User's Chinese Answer: "${userInput}"

      Based on this, please provide the following:
      1. advice: A friendly and concise explanation of the user's mistakes if any.
      2. grammarPoint: A brief explanation of a relevant grammar points or vocabulary usages from the correct sentence that would help the user learn.
      3. isCorrect: A boolean indicating if the user's answer is semantically correct, even with minor typos or alternative phrasing.

      Speak using English language, and avoid using simplified characters in explanations use traditional characters instead.
    `;

    const request = {
      contents: [{ role: "user", parts: [{ text: promptFeeback }] }],
      generationConfig,
    };

    try {
      const result = await genAImodel.generateContent(request);
      const responseText = result.response.text();
      const parsedFeedback: AIFeedback = JSON.parse(responseText);

      addHistoryCallback({
        ...sentences[currentSentenceIndex],
        userInput: userInput,
        type: parsedFeedback.isCorrect
          ? PracticeHistoryType.CORRECT
          : PracticeHistoryType.WRONG,
        aiAdvice: parsedFeedback.advice,
        aiGrammarPoint: parsedFeedback.grammarPoint,
      });

      // The AI is now the source of truth for correctness
      if (parsedFeedback.isCorrect) {
        // If the AI says it's correct, show a success message and move on
        setFeedback(null);
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
      finishedPracticeCallback();
      setCurrentSentenceIndex(0);
    }
  };

  const handleTryAgainSentence = () => {
    setFeedback(null);
    setUserInput("");
  };

  return (
    <div className="container mx-auto max-w-2xl">
      <div className="p-3">
        <div className="text-center mb-4">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Sentence {currentSentenceIndex + 1} of {sentences.length}
          </p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-2">
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

        <PracticeWarnUknownChars
          characterList={characterList}
          sentence={sentences[currentSentenceIndex].chinese}
        />

        <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
            English Sentence:
          </p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {sentences[currentSentenceIndex].english}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="userInput"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Your Chinese Translation:
            </label>
            <input
              type="text"
              id="userInput"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-lg shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="Please enter your translation here"
              disabled={!!feedback || showCorrect || isGrading}
            />
          </div>

          {!showCorrect && !feedback ? (
            <div className="flex w-full gap-x-4">
              <button
                onClick={handleSubmitAnswer}
                disabled={isGrading || !userInput}
                className="w-3/4 flex justify-center items-center px-4 py-3 bg-green-600 text-white font-bold rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
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

              <button
                className="w-1/4 items-center px-4 py-3 text-white font-bold rounded-md shadow-sm transition-colors bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
                onClick={handleSkipAnswer}
              >
                Skip
              </button>
            </div>
          ) : undefined}
        </div>

        {showCorrect && (
          <>
            <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 border-l-4 border-green-500 dark:border-green-400 text-green-800 dark:text-green-200 rounded-r-lg">
              <p className="font-bold">Correct! Well done!</p>
            </div>
            {/* Comparison */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">
                Comparison
              </h4>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                <span className="font-semibold text-green-700 dark:text-green-300">
                  Correct:
                </span>{" "}
                {sentences[currentSentenceIndex].chinese}
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100">
                <span className="font-semibold text-red-700 dark:text-red-300">
                  Yours:
                </span>{" "}
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
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Comparison
                </h4>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  <span className="font-semibold text-green-700 dark:text-green-300">
                    Correct:
                  </span>{" "}
                  {sentences[currentSentenceIndex].chinese}
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  <span className="font-semibold text-red-700 dark:text-red-300">
                    Yours:
                  </span>{" "}
                  {userInput}
                </p>
              </div>
              {/* Advice */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900 border-l-4 border-amber-400 dark:border-amber-300 rounded-r-lg">
                <h4 className="font-bold text-amber-900 dark:text-amber-100">
                  Advice
                </h4>
                <p className="text-amber-800 dark:text-amber-200">
                  {feedback.advice}
                </p>
              </div>
              {/* Grammar Point */}
              <div className="p-4 bg-sky-50 dark:bg-sky-900 border-l-4 border-sky-400 dark:border-sky-300 rounded-r-lg">
                <h4 className="font-bold text-sky-900 dark:text-sky-100">
                  Grammar Point
                </h4>
                <p className="text-sky-800 dark:text-sky-200">
                  {feedback.grammarPoint}
                </p>
              </div>
            </div>
            <div className="flex w-full gap-x-4">
              <button
                onClick={handleNextSentence}
                className="w-3/4 mt-6 px-4 py-2 bg-sky-600 text-white font-semibold rounded-md shadow-sm hover:bg-sky-700 transition-colors"
              >
                Next Sentence
              </button>
              <button
                className="w-1/4 mt-6 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 transition-colors"
                onClick={handleTryAgainSentence}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PartialReveal: React.FC<{
  textInput: string;
}> = ({ textInput }) => {
  const [shown, setShown] = useState(0);
  return (
    <>
      {textInput.slice(0, shown)}
      {shown < textInput.length ? (
        <button
          onClick={() => {
            setShown((shown) => shown + 1);
          }}
        >
          ... (show more)
        </button>
      ) : undefined}
    </>
  );
};

export const PracticeListeningToChinese: React.FC<{
  characterList: string[];
  genAImodel: GenerativeModel;
  sentences: PracticeSentencePair[];
  setError: (_: string | null) => void;
  finishedPracticeCallback: () => void;
  addHistoryCallback: (add: PracticeHistory) => void;
}> = ({
  characterList,
  sentences,
  finishedPracticeCallback,
  addHistoryCallback,
}) => {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  /**
   * Moves to the next sentence in the list.
   */
  const handleNextSentence = () => {
    setSoundPlayed(false);
    setAnswerRevealed(false);
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    } else {
      finishedPracticeCallback();
      setCurrentSentenceIndex(0);
    }
  };

  const handleSkipAnswer = async () => {
    addHistoryCallback({
      ...sentences[currentSentenceIndex],
      type: PracticeHistoryType.SKIPPED,
    });
    handleNextSentence();
  };

  return (
    <div className="container mx-auto max-w-2xl">
      <div className="p-3">
        <div className="text-center mb-4">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Sentence {currentSentenceIndex + 1} of {sentences.length}
          </p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-2">
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

        <PracticeWarnUknownChars
          characterList={characterList}
          sentence={sentences[currentSentenceIndex].chinese}
        />

        <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <p className="text-md text-slate-600 dark:text-slate-400 font-bold mb-1">
            Listen to the Sentence:
          </p>
          <GenerateAudio
            textInput={sentences[currentSentenceIndex].chinese}
            finishedPlayCallback={() => setSoundPlayed(true)}
          />
          <button
            className="w-full mt-3 items-center px-4 py-3 text-white font-bold rounded-md shadow-sm transition-colors bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
            onClick={handleSkipAnswer}
          >
            Skip
          </button>
        </div>

        {soundPlayed ? (
          <>
            <div className="space-y-4 mb-6 ">
              <div>
                <label
                  htmlFor="userInput"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Chinese text (you can reveal it partially if not sure)
                </label>
                <div
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-lg shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                               focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <PartialReveal
                    key={sentences[currentSentenceIndex].chinese}
                    textInput={sentences[currentSentenceIndex].chinese}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="userInput"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  English text (correct answer)
                </label>
                <div
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md text-lg shadow-sm placeholder-slate-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  {answerRevealed ? (
                    sentences[currentSentenceIndex].english
                  ) : (
                    <button
                      className="w-full text-left"
                      onClick={() => setAnswerRevealed(true)}
                    >
                      show correct answer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : undefined}

        {answerRevealed ? (
          <>
            <div className="flex">
              <button
                onClick={() => {
                  addHistoryCallback({
                    ...sentences[currentSentenceIndex],
                    type: PracticeHistoryType.CORRECT,
                  });
                  handleNextSentence();
                }}
                className="mt-6 mr-2 w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 transition-colors"
              >
                Correct
              </button>
              <button
                onClick={() => {
                  addHistoryCallback({
                    ...sentences[currentSentenceIndex],
                    type: PracticeHistoryType.WRONG,
                  });
                  handleNextSentence();
                }}
                className="mt-6 ml-2 w-full px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 transition-colors"
              >
                Incorrect
              </button>
            </div>
          </>
        ) : undefined}
      </div>
    </div>
  );
};
