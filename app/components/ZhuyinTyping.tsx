import { useState, useEffect, useCallback } from "react";
import {
  getRandomZhuyinCharacter,
  type ZhuyinCharacter,
} from "~/utils/zhuyin_typing_mapping";
import { FingerHighlighter } from "~/components/FingerVisualization";
import {
  ZhuyinTypingAnswerLog,
  type LogEntry,
} from "~/components/ZhuyinTypingAnswerLog";

interface CharacterStats {
  character: string;
  attempts: number;
  successes: number;
  totalDelay: number;
  averageDelay: number;
  successRate: number;
}

interface TypingStats {
  [key: string]: CharacterStats;
}

const ZhuyinTyping = () => {
  const [stats, setStats] = useState<TypingStats>({});
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalSuccess, setTotalSuccess] = useState(0);
  const [answerLog, setAnswerLog] = useState<LogEntry[]>([]);

  // Initialize with first character immediately
  const [currentCharacter, setCurrentCharacter] = useState<ZhuyinCharacter | null>(
    () => getRandomZhuyinCharacter({})
  );
  const [showZhuyin, setShowZhuyin] = useState<boolean>(() => Math.random() < 0.5);
  const [startTime, setStartTime] = useState<number | null>(() => Date.now());
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lastDelay, setLastDelay] = useState<number | null>(null);

  const generateNewCharacter = useCallback((statsToUse: TypingStats) => {
    const newChar = getRandomZhuyinCharacter(statsToUse);
    setCurrentCharacter(newChar);
    setShowZhuyin(Math.random() < 0.5);
    setStartTime(Date.now());
    setIsCorrect(null);
    setLastDelay(null);
  }, []);

  const updateStats = useCallback(
    (character: ZhuyinCharacter, success: boolean, delay: number) => {
      setStats((prevStats) => {
        const existing = prevStats[character.zhuyin] || {
          character: character.zhuyin,
          attempts: 0,
          successes: 0,
          totalDelay: 0,
          averageDelay: 0,
          successRate: 0,
        };

        const newAttempts = existing.attempts + 1;
        const newSuccesses = existing.successes + (success ? 1 : 0);
        const newTotalDelay = existing.totalDelay + delay;
        const newAverageDelay = newTotalDelay / newAttempts;
        const newSuccessRate = (newSuccesses / newAttempts) * 100;

        return {
          ...prevStats,
          [character.zhuyin]: {
            ...existing,
            attempts: newAttempts,
            successes: newSuccesses,
            totalDelay: newTotalDelay,
            averageDelay: newAverageDelay,
            successRate: newSuccessRate,
          },
        };
      });
    },
    []
  );

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!currentCharacter || !startTime) return;

      // Ignore special keys
      const specialKeys = [
        "Meta",
        "Alt",
        "Control",
        "Shift",
        "CapsLock",
        "Tab",
        "Escape",
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "F8",
        "F9",
        "F10",
        "F11",
        "F12",
      ];
      if (
        specialKeys.includes(event.key) ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey
      ) {
        return;
      }

      // Prevent default browser behavior for all keys to avoid Firefox search bar
      event.preventDefault();

      const pressedKey = event.key.toLowerCase();
      const expectedKey = currentCharacter.englishKey.toLowerCase();
      const delay = Date.now() - startTime;
      const success = pressedKey === expectedKey;

      setIsCorrect(success);
      setLastDelay(delay);
      setTotalAttempts((prev) => prev + 1);

      // Add to answer log
      setAnswerLog((prevLog) => [
        {
          id: Date.now(),
          zhuyinChar: currentCharacter.zhuyin,
          expectedKey: expectedKey.toUpperCase(),
          pressedKey: pressedKey.toUpperCase(),
          isCorrect: success,
          delay,
          timestamp: Date.now(),
          showedZhuyin: showZhuyin,
        },
        ...prevLog,
      ]);

      if (success) {
        setTotalSuccess((prev) => prev + 1);
      }

      updateStats(currentCharacter, success, delay);

      if (success) {
        setTimeout(() => {
          setStats((currentStats) => {
            generateNewCharacter(currentStats);
            return currentStats;
          });
        }, 500);
      }
    },
    [currentCharacter, startTime, updateStats, showZhuyin, generateNewCharacter]
  );


  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const overallSuccessRate =
    totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;
  const sortedStats = Object.values(stats).sort(
    (a, b) => b.attempts - a.attempts
  );

  return (
    <div className="min-h-screen py-4">
      <div className="mx-auto max-w-4xl px-2">
        <div className="mb-4 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">
            Zhuyin Touch Typing Practice
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Type the English key shown below when you see a Zhuyin character, or
            the Zhuyin character when you see an English key
          </p>
        </div>

        <div className="mb-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <div className="text-center">
            <div className="mb-4">
              <div className="mb-4 text-8xl font-bold text-gray-800 dark:text-white">
                {showZhuyin
                  ? currentCharacter?.zhuyin || ""
                  : currentCharacter?.pinyin || ""}
              </div>
              {lastDelay && (
                <div className="text-lg">
                  <span
                    className={`font-semibold ${
                      isCorrect ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                  <span className="ml-4 text-gray-500 dark:text-gray-400">
                    {lastDelay}ms
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Overall Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Total Attempts:
                </span>
                <span className="font-semibold dark:text-white">
                  {totalAttempts}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Successful:
                </span>
                <span className="font-semibold text-green-600">
                  {totalSuccess}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Success Rate:
                </span>
                <span className="font-semibold dark:text-white">
                  {overallSuccessRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Character Stats
            </h3>
            <div className="max-h-80 overflow-y-auto">
              {sortedStats.length === 0 ? (
                <p className="py-4 text-center text-gray-500 dark:text-gray-400">
                  Start typing to see stats
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedStats.slice(0, 10).map((stat) => (
                    <div
                      key={stat.character}
                      className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-gray-700"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl font-bold dark:text-white">
                          {stat.character}
                        </span>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <div>{stat.attempts} attempts</div>
                          <div>{stat.averageDelay.toFixed(0)}ms avg</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-semibold ${
                            stat.successRate >= 80
                              ? "text-green-600"
                              : stat.successRate >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {stat.successRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {currentCharacter && (
          <FingerHighlighter highlightedFingerName={currentCharacter.finger} />
        )}
        <div className="mb-4 text-2xl text-gray-600 dark:text-gray-300">
          Press:{" "}
          <span className="rounded bg-gray-200 px-3 py-1 font-mono dark:bg-gray-700 dark:text-white">
            {currentCharacter?.englishKey.toUpperCase()}
          </span>
        </div>

        <ZhuyinTypingAnswerLog answerLog={answerLog} />
      </div>
    </div>
  );
};

export default ZhuyinTyping;
