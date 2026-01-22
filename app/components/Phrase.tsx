import { ankiOpenBrowse } from "~/apis/anki";
import { IGNORE_PHRASE_CHARS, type PhraseType } from "~/data/phrases";
import { TagList } from "./TagList";
import { Link, useOutletContext } from "react-router";
import AnkiAudioPlayer from "./AnkiAudioPlayer";
import type { OutletContext } from "~/data/types";
import { HanziText } from "./HanziText";
import { POSList } from "./POSDisplay";

export const PhraseCard: React.FC<{ phraseHanzi: string }> = ({
  phraseHanzi,
}) => {
  const sources = [
    {
      name: "MoE",
      link:
        "https://dict.revised.moe.edu.tw/search.jsp?md=1&word=" +
        encodeURIComponent(phraseHanzi) +
        "&qMd=0&qCol=1",
    },
    {
      name: "dong",
      link:
        "https://www.dong-chinese.com/dictionary/search/" +
        encodeURIComponent(phraseHanzi),
    },
    {
      name: "wiki",
      link:
        "https://en.wiktionary.org/wiki/" +
        encodeURIComponent(phraseHanzi) +
        "#Chinese",
    },
  ];

  return (
    <div className="mx-6 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-6">
        <div className="text-6xl font-serif">
          <HanziText value={phraseHanzi} />
        </div>
        <div className="flex flex-wrap gap-2">
          {sources.map(({ name, link }) => (
            <a
              key={name}
              href={link}
              rel="noreferrer"
              target="_blank"
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
            >
              {name} 🔗
            </a>
          ))}
          <button
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
            onClick={() => {
              sources.forEach((source) => {
                window.open(source.link, "_blank");
              });
            }}
          >
            Open all
          </button>
        </div>
      </div>
    </div>
  );
};

export const PhraseMeaning: React.FC<{
  meaning: string;
  className?: string;
}> = ({ meaning, className = "" }) => {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: meaning }}
    />
  );
};

export const PhraseLink: React.FC<{ value: string }> = ({ value }) => {
  const { characters } = useOutletContext<OutletContext>();
  return (
    <Link to={`/phrase/${encodeURIComponent(value)}`}>
      {[...value].map((c, i) =>
        !characters[c] && !IGNORE_PHRASE_CHARS.has(c) ? (
          <span key={i} className="text-red-600">
            {c}
          </span>
        ) : (
          c
        )
      )}
    </Link>
  );
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
              Part of Speech
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
                      await ankiOpenBrowse(
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
                  <span className="inline-block mr-2">{phrase.zhuyin}</span>
                  <span
                    dangerouslySetInnerHTML={{ __html: phrase.pinyin }}
                  ></span>
                  <AnkiAudioPlayer audioField={phrase.audio} />
                </td>
                <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  <POSList posString={phrase.partOfSpeech || ""} />
                </td>
                <td className="text-gray-900 dark:text-gray-100 px-2 py-3">
                  <div className="max-w-md truncate">
                    <PhraseMeaning meaning={phrase.meaning} />
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
