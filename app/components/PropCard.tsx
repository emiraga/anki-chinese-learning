import { Link } from "react-router";
import { ankiOpenBrowse } from "~/apis/anki";
import { PinyinList } from "./PinyinText";
import { getNewCharacter } from "~/data/characters";

export const PropCard: React.FC<{
  prop: {
    hanzi: string;
    prop: string;
    description: string;
    mainTagname: string;
  };
  characterCount?: number;
}> = ({ prop, characterCount }) => {
  var hanzi = prop.hanzi;
  if (hanzi.startsWith("<img")) {
    hanzi = "?"; // TODO: support image props
  }

  return (
    <div className="flex w-full">
      <div className="w-12 text-4xl">
        <Link to={`/prop/${prop.prop}`}>{hanzi}</Link>
      </div>
      <div className="flex-1">
        <div className="font-mono text-blue-800 dark:text-blue-400 font-bold">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/prop/${prop.prop}`}
              className="hover:text-blue-600 dark:hover:text-blue-300 hover:underline"
            >
              {prop.mainTagname.substring(6)}
            </Link>
            {characterCount !== undefined && (
              <span className="rounded-2xl bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {characterCount} chars
              </span>
            )}
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-800 p-1 text-xs text-blue-500 dark:text-blue-100"
              onClick={async () => {
                await ankiOpenBrowse(
                  "note:Props tag:prop::" + prop.prop + " " + prop.prop
                );
              }}
            >
              anki
            </button>
          </div>
          <div>
            <PinyinList
              pinyin={getNewCharacter(prop.hanzi.substring(0, 1))?.pinyin ?? []}
            />
          </div>
        </div>
        <div
          className="text-gray-500 dark:text-gray-400"
          dangerouslySetInnerHTML={{ __html: prop.description }}
        ></div>
      </div>
    </div>
  );
};
