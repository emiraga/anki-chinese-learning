import * as React from "react";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";

type HomophoneGroup = {
  zhuyinWithoutTones: string;
  phrases: Array<{
    traditional: string;
    pinyin: string;
    meaning: string;
    zhuyin?: string;
  }>;
};

const stripZhuyinTones = (zhuyin: string): string => {
  // Remove tone marks: ˊ ˇ ˋ ˙ (tones 2, 3, 4, 5) and keep tone 1 (no mark)
  return zhuyin.replace(/[ˊˇˋ˙]/g, "");
};

export default function Homophones() {
  const { phrases } = useOutletContext<OutletContext>();

  // Group phrases by stripped zhuyin
  const zhuyinGroups: { [key: string]: typeof phrases } = {};

  phrases.forEach(phrase => {
    if (!phrase.zhuyin) return;

    const strippedZhuyin = stripZhuyinTones(phrase.zhuyin);
    if (!zhuyinGroups[strippedZhuyin]) {
      zhuyinGroups[strippedZhuyin] = [];
    }
    zhuyinGroups[strippedZhuyin].push(phrase);
  });

  // Filter to only include groups with multiple different traditional characters
  const homophones: HomophoneGroup[] = [];

  Object.entries(zhuyinGroups).forEach(([strippedZhuyin, groupPhrases]) => {
    // Get unique traditional characters in this group
    const uniqueTraditional = new Set(groupPhrases.map(p => p.traditional));

    // Only include if there are multiple different traditional characters
    if (uniqueTraditional.size > 1) {
      // Deduplicate phrases with same traditional character
      const uniquePhrases = Array.from(uniqueTraditional).map(traditional => {
        return groupPhrases.find(p => p.traditional === traditional)!;
      });

      homophones.push({
        zhuyinWithoutTones: strippedZhuyin,
        phrases: uniquePhrases.map(phrase => ({
          traditional: phrase.traditional,
          pinyin: phrase.pinyin,
          meaning: phrase.meaning,
          zhuyin: phrase.zhuyin,
        })),
      });
    }
  });

  // Sort by length of traditional field (longest first), then by number of homophones (descending), then alphabetically
  const homophoneGroups = homophones.sort((a, b) => {
    // First sort by maximum length of traditional characters in each group
    const maxLengthA = Math.max(...a.phrases.map(p => p.traditional.length));
    const maxLengthB = Math.max(...b.phrases.map(p => p.traditional.length));

    if (maxLengthA !== maxLengthB) {
      return maxLengthB - maxLengthA; // Longest first
    }

    // Then by number of homophones (descending)
    if (a.phrases.length !== b.phrases.length) {
      return b.phrases.length - a.phrases.length;
    }

    // Finally alphabetically by pronunciation
    return a.zhuyinWithoutTones.localeCompare(b.zhuyinWithoutTones);
  });

  if (phrases.length === 0) {
    return (
      <MainFrame>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Homophones
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            No phrases loaded. Please load some phrases first.
          </p>
        </div>
      </MainFrame>
    );
  }

  return (
    <MainFrame>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
          Homophones
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Words with the same pronunciation (zhuyin without tone marks) but different characters.
          Found {homophoneGroups.length} homophone groups.
        </p>

        {homophoneGroups.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No homophones found in your current phrase collection.
          </p>
        ) : (
          <div className="space-y-6">
            {homophoneGroups.map((group, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  Pronunciation: {group.zhuyinWithoutTones}
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                          Traditional
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                          Pinyin
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                          Zhuyin
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-white">
                          Meaning
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.phrases.map((phrase, phraseIndex) => (
                        <tr
                          key={phraseIndex}
                          className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                            {phrase.traditional}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {phrase.pinyin}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {phrase.zhuyin}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {phrase.meaning}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainFrame>
  );
}