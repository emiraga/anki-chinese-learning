import anki from "~/apis/anki";
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
    <table className="w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="w-10">Source</th>
          <th>Tags</th>
          <th>Traditional</th>
          <th>Pinyin</th>
          <th>Meaning</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {phrases.map((phrase, i) => {
          return (
            <tr key={i}>
              <td className="w-20">
                <button
                  className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
                  onClick={() => {
                    anki.graphical.guiBrowse({
                      query: `note:${phrase.source} Traditional:${phrase.traditional}`,
                    });
                  }}
                >
                  {phrase.source}
                </button>
              </td>
              <td>
                <TagList tags={phrase.tags} />
              </td>
              <td>
                <PhraseLink value={phrase.traditional} />
              </td>
              <td>
                <span
                  dangerouslySetInnerHTML={{ __html: phrase.pinyin }}
                ></span>
                <AnkiAudioPlayer audioField={phrase.audio} />
              </td>
              <td className="truncate max-w-150">
                <span
                  dangerouslySetInnerHTML={{ __html: phrase.meaning }}
                ></span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
