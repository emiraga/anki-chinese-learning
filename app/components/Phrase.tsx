import { anki_open_browse } from "~/apis/anki";
import type { PhraseType } from "~/data/phrases";
import { TagList } from "./TagList";
import { Link } from "react-router";
import AnkiAudioPlayer from "./AnkiAudioPlayer";

export const PhraseLink: React.FC<{ value?: string }> = ({ value }) => {
  return <Link to={`/phrase/${value}`}>{value}</Link>;
};

export const PhraseList: React.FC<{ phrases: PhraseType[] }> = ({
  phrases,
}) => {
  if (phrases.length === 0) {
    return <></>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full divide-y divide-gray-200 dark:divide-gray-600">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="w-10 text-gray-900 dark:text-gray-100 px-2 py-3">
              Source
            </th>
            <th className="text-gray-900 dark:text-gray-100 px-2 py-3">Tags</th>
            <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
              Traditional
            </th>
            <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
              Pinyin
            </th>
            <th className="text-gray-900 dark:text-gray-100 px-2 py-3">
              Meaning
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-600">
          {phrases.map((phrase, i) => {
            return (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="w-20 px-2 py-3">
                  <button
                    className="rounded-2xl bg-blue-100 dark:bg-blue-800 dark:text-blue-100 p-1 ml-2 inline text-xs text-blue-500"
                    onClick={async () => {
                      await anki_open_browse(
                        `note:${phrase.source} Traditional:${phrase.traditional}`
                      );
                    }}
                  >
                    {phrase.source}
                  </button>
                </td>
                <td className="px-2 py-3 max-w-30">
                  <TagList tags={phrase.tags} />
                </td>
                <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  <PhraseLink value={phrase.traditional} />
                </td>
                <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  <span
                    dangerouslySetInnerHTML={{ __html: phrase.pinyin }}
                  ></span>
                  <AnkiAudioPlayer audioField={phrase.audio} />
                </td>
                <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  <div className="max-w-md truncate">
                    <span
                      dangerouslySetInnerHTML={{ __html: phrase.meaning }}
                    ></span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
