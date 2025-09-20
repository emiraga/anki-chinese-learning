import * as React from "react";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";
import { PhraseMeaning } from "~/components/Phrase";
import { stripZhuyinTones, stripPinyinTones } from "~/utils/pinyin_zhuyin";

type HomophoneGroup = {
  zhuyinWithoutTones: string;
  pinyinWithoutTones: string;
  phrases: Array<{
    traditional: string;
    pinyin: string;
    meaning: string;
    zhuyin?: string;
  }>;
};

const constructHomophoneGroups = (phrases: Array<{
  traditional: string;
  pinyin: string;
  meaning: string;
  zhuyin?: string;
}>): HomophoneGroup[] => {
  // Group phrases by stripped pinyin
  const pinyinGroups: { [key: string]: typeof phrases } = {};

  phrases.forEach((phrase) => {
    const strippedPinyin = stripPinyinTones(phrase.pinyin);
    if (!pinyinGroups[strippedPinyin]) {
      pinyinGroups[strippedPinyin] = [];
    }
    pinyinGroups[strippedPinyin].push(phrase);
  });

  // Filter to only include groups with multiple different traditional characters
  const homophones: HomophoneGroup[] = [];

  Object.entries(pinyinGroups).forEach(([strippedPinyin, groupPhrases]) => {
    // Get unique traditional characters in this group
    const uniqueTraditional = new Set(groupPhrases.map((p) => p.traditional));

    // Only include if there are multiple different traditional characters
    if (uniqueTraditional.size > 1) {
      // Deduplicate phrases with same traditional character
      const uniquePhrases = Array.from(uniqueTraditional).map((traditional) => {
        return groupPhrases.find((p) => p.traditional === traditional)!;
      });

      // Get the stripped zhuyin from the first phrase in the group (if available)
      const strippedZhuyin = uniquePhrases[0].zhuyin ? stripZhuyinTones(uniquePhrases[0].zhuyin) : "";

      homophones.push({
        zhuyinWithoutTones: strippedZhuyin,
        pinyinWithoutTones: strippedPinyin,
        phrases: uniquePhrases.map((phrase) => ({
          traditional: phrase.traditional,
          pinyin: phrase.pinyin,
          meaning: phrase.meaning,
          zhuyin: phrase.zhuyin,
        })),
      });
    }
  });

  // Sort by length of traditional field (longest first), then by number of homophones (descending), then alphabetically
  return homophones.sort((a, b) => {
    // First sort by maximum length of traditional characters in each group
    const maxLengthA = Math.max(...a.phrases.map((p) => p.traditional.length));
    const maxLengthB = Math.max(...b.phrases.map((p) => p.traditional.length));

    if (maxLengthA !== maxLengthB) {
      return maxLengthB - maxLengthA; // Longest first
    }

    // Then by number of homophones (descending)
    if (a.phrases.length !== b.phrases.length) {
      return b.phrases.length - a.phrases.length;
    }

    // Finally alphabetically by pronunciation
    return a.pinyinWithoutTones.localeCompare(b.pinyinWithoutTones);
  });
};

export default function Homophones() {
  const { phrases } = useOutletContext<OutletContext>();

  const homophoneGroups = constructHomophoneGroups(phrases);

  return (
    <MainFrame>
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Words with the similar syllables (but often different tones). Found{" "}
          {homophoneGroups.length} homophone groups.
        </p>

        {homophoneGroups.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No homophones found in your current phrase collection.
          </p>
        ) : (
          <div className="space-y-6">
            {homophoneGroups.map((group, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
              >
                <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  Pronunciation: {group.pinyinWithoutTones}
                  {group.zhuyinWithoutTones && ` (${group.zhuyinWithoutTones})`}
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
                            <PhraseMeaning meaning={phrase.meaning} />
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
