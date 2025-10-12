import { type CharactersType } from "~/data/characters";
import React from "react";
import { getCharacterPairsWithSimilarProps } from "~/data/char_conflicts";
import { Link } from "react-router";

export const SimilarPropsList: React.FC<{
  characters: CharactersType;
}> = ({ characters }) => {
  const pairs = getCharacterPairsWithSimilarProps(characters);

  if (pairs.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 p-8">
        No character pairs found with shared props (minimum 3 common props required)
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
        Character pairs sharing at least 3 common props. Sorted by number of shared props.
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Total pairs: {pairs.length}
      </p>

      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
              Char 1
            </th>
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
              Char 2
            </th>
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left">
              Shared Props
            </th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair, i) => (
            <tr key={i} className="hover:bg-gray-100 dark:hover:bg-gray-800">
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                <Link
                  to={`/char/${pair.char1.traditional}`}
                  className="text-4xl hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {pair.char1.traditional}
                </Link>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {pair.char1.meaning}
                </div>
              </td>
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                <Link
                  to={`/char/${pair.char2.traditional}`}
                  className="text-4xl hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {pair.char2.traditional}
                </Link>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {pair.char2.meaning}
                </div>
              </td>
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                <div className="font-semibold mb-2">
                  {pair.sharedPropsCount} prop{pair.sharedPropsCount !== 1 ? 's' : ''}
                </div>
                <div className="flex flex-wrap gap-1">
                  {pair.sharedProps.map((prop, idx) => (
                    <Link
                      key={idx}
                      to={`/prop/${encodeURIComponent(prop.replace("prop::", ""))}`}
                      className="inline-block bg-green-200 dark:bg-green-700 px-2 py-1 rounded text-sm hover:bg-green-300 dark:hover:bg-green-600"
                    >
                      {prop.replace("prop::", "")}
                    </Link>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
