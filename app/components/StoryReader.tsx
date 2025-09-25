import React, { useState, useEffect } from "react";
import GenerateAudio from "./GenerateAudio";
import { PracticeWarnUknownChars } from "./PracticeTypes";
import { HanziText } from "./HanziText";

interface StoryReaderProps {
  story: string;
  characterList: string[];
  onBack: () => void;
}

const StoryReader: React.FC<StoryReaderProps> = ({
  story,
  characterList,
  onBack,
}) => {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showTraditional, setShowTraditional] = useState<boolean>(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);

  // Split story into sentences on component mount
  const splitSentences = React.useMemo(() => {
    return story
      .split(/[。！？]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s + (s.match(/[。！？]$/) ? "" : "。"));
  }, [story]);

  useEffect(() => {
    setSentences(splitSentences);
  }, [splitSentences]);

  const currentSentence = sentences[currentIndex] || "";

  const handlePlayComplete = () => {
    if (autoPlay && currentIndex < sentences.length - 1) {
      setTimeout(() => {
        handleNext();
      }, 1000);
    }
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowTraditional(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowTraditional(false);
    }
  };

  const handleGoToBeginning = () => {
    setCurrentIndex(0);
    setShowTraditional(false);
  };

  if (sentences.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl p-3">
        <div className="text-center">
          <div className="animate-spin mx-auto rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
          <p>Processing story...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-3">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            ← Back to Generate
          </button>
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Sentence {currentIndex + 1} of {sentences.length}
          </div>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-sky-500 h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${((currentIndex + 1) / sentences.length) * 100}%`,
            }}
          ></div>
        </div>
      </div>

      {/* Auto-play toggle */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
            className="mr-2 h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Auto-play next sentence
          </span>
        </label>
      </div>

      {/* Unknown characters warning */}
      <PracticeWarnUknownChars
        characterList={characterList}
        sentence={currentSentence}
      />

      {/* Main audio section */}
      <div className="mb-6 p-6 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <div className="text-center mb-4">
          <h2 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-4">
            Listen to the sentence:
          </h2>
          <GenerateAudio
            key={`${currentIndex}-${currentSentence}`}
            textInput={currentSentence}
            finishedPlayCallback={handlePlayComplete}
          />
        </div>

        {/* Traditional Chinese reveal */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-700 rounded-lg border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-slate-700 dark:text-slate-300">
              Chinese Text:
            </h3>
            <button
              onClick={() => setShowTraditional(!showTraditional)}
              className="px-3 py-1 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors"
            >
              {showTraditional ? "Hide" : "Reveal"}
            </button>
          </div>

          {showTraditional ? (
            <div className="text-2xl text-slate-900 dark:text-slate-100 leading-relaxed">
              <HanziText value={currentSentence} />
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400 italic">
              Click &quot;Reveal&quot; to see the Chinese text
            </div>
          )}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button
          onClick={handleGoToBeginning}
          disabled={currentIndex === 0}
          className="px-4 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          ⏮ Beginning
        </button>

        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-4 py-3 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          ⏪ Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === sentences.length - 1}
          className="px-4 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          Next ⏩
        </button>

        <button
          onClick={() => window.location.reload()}
          className="px-4 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors"
        >
          🔄 Replay Audio
        </button>
      </div>

      {/* Story overview (collapsible) */}
      <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300 mb-2">
          📖 Full Story ({sentences.length} sentences)
        </summary>
        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
          {sentences.map((sentence, index) => (
            <button
              key={index}
              className={`w-full text-left p-2 rounded cursor-pointer transition-colors ${
                index === currentIndex
                  ? "bg-sky-100 dark:bg-sky-900 border-l-4 border-sky-500"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
              onClick={() => {
                setCurrentIndex(index);
                setShowTraditional(false);
              }}
            >
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">
                {index + 1}.
              </span>
              <HanziText value={sentence} />
            </button>
          ))}
        </div>
      </details>
    </div>
  );
};

export default StoryReader;
