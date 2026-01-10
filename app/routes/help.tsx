import MainFrame from "~/toolbar/frame";

export default function Help() {
  return (
    <MainFrame>
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          Help & Keyboard Shortcuts
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            Keyboard Shortcuts
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Quick Syllable Navigation
              </h3>
              <div className="flex items-center gap-4 mb-2">
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  P
                </kbd>
                <span className="text-gray-700 dark:text-gray-300">
                  Press anywhere to open pinyin syllable prompt
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Press the <strong>P</strong> key on any page to quickly navigate
                to a syllable page. A prompt will appear where you can enter a
                pinyin syllable (e.g., &quot;pai&quot;, &quot;ma&quot;,
                &quot;zhong&quot;). After entering the syllable, you&apos;ll be
                taken to{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  /sylable/[syllable]
                </code>
                to study characters and phrases with that pronunciation.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Quick Character Navigation
              </h3>
              <div className="flex items-center gap-4 mb-2">
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  H
                </kbd>
                <span className="text-gray-700 dark:text-gray-300">
                  Press anywhere to open character (hanzi) prompt
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Press the <strong>H</strong> key on any page to quickly navigate
                to a character page. A prompt will appear where you can enter a
                Chinese character. After entering the character, you&apos;ll be
                taken to{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  /char/[character]
                </code>
                to view detailed information about that character.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Current Study Phrase Navigation
              </h3>
              <div className="flex items-center gap-4 mb-2">
                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                  S
                </kbd>
                <span className="text-gray-700 dark:text-gray-300">
                  Press anywhere to navigate to the current study phrase
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Press the <strong>S</strong> key on any page to navigate to the
                page for the card currently being studied in Anki. This fetches
                the Traditional field from the current Anki card and takes you
                to{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  /char/[traditional]
                </code>{" "}
                for single characters or{" "}
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  /phrase/[traditional]
                </code>{" "}
                for phrases.
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Note: These shortcuts are disabled when typing in input fields or
              text areas.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
            Navigation Tips
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Character Study
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Browse characters by frequency and difficulty</li>
                <li>
                  • View detailed breakdowns including radicals and components
                </li>
                <li>• Practice writing and recognition</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Phrase Learning
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Study phrases with pinyin and translations</li>
                <li>• Import new phrases from various sources</li>
                <li>• Discover contextual usage examples</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Practice Modes
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• English to Chinese translation exercises</li>
                <li>• Listening comprehension practice</li>
                <li>• Pinyin tone recognition</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Anki Integration
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Sync with your Anki desktop application</li>
                <li>• Track learning progress automatically</li>
                <li>• Create spaced repetition flashcards</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3 text-blue-900 dark:text-blue-100">
            Getting Started
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>
              Make sure Anki desktop is running with AnkiConnect addon installed
            </li>
            <li>Configure your API keys in Settings if using AI features</li>
            <li>Import or create your first set of phrases and characters</li>
            <li>
              Start studying with the Practice mode or browse by categories
            </li>
            <li>
              Use the{" "}
              <kbd className="px-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">
                P
              </kbd>{" "}
              shortcut for quick syllable lookup,{" "}
              <kbd className="px-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">
                H
              </kbd>{" "}
              for character lookup, or{" "}
              <kbd className="px-1 bg-blue-200 dark:bg-blue-800 rounded text-xs">
                S
              </kbd>{" "}
              to jump to the current study phrase
            </li>
          </ol>
        </div>
      </div>
    </MainFrame>
  );
}
