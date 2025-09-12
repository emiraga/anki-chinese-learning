interface LogEntry {
  id: number;
  zhuyinChar: string;
  expectedKey: string;
  pressedKey: string;
  isCorrect: boolean;
  delay: number;
  timestamp: number;
  showedZhuyin: boolean;
}

interface ZhuyinTypingAnswerLogProps {
  answerLog: LogEntry[];
}

export const ZhuyinTypingAnswerLog = ({ answerLog }: ZhuyinTypingAnswerLogProps) => {
  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">Answer Log</h3>
      <div className="max-h-64 overflow-y-auto">
        {answerLog.length === 0 ? (
          <p className="py-4 text-center text-gray-500 dark:text-gray-400">
            No answers yet - start typing to see your history
          </p>
        ) : (
          <div className="space-y-1">
            {answerLog.slice(0, 50).map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded p-2 ${
                  entry.isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold dark:text-white">{entry.zhuyinChar}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.showedZhuyin ? 'Showed Zhuyin' : 'Showed Key'}
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Expected:</span>{' '}
                    <span className="rounded bg-gray-200 px-2 py-1 font-mono dark:bg-gray-700 dark:text-white">
                      {entry.expectedKey}
                    </span>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">Pressed:</span>{' '}
                    <span
                      className={`rounded px-2 py-1 font-mono ${
                        entry.isCorrect
                          ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                      }`}
                    >
                      {entry.pressedKey}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`font-semibold ${entry.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.isCorrect ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{entry.delay}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export type { LogEntry };