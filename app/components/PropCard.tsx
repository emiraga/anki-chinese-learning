import { Link } from "react-router";
import { anki_open_browse } from "~/apis/anki";
import { PinyinText } from "./PinyinText";
import { getNewCharacter } from "~/data/characters";

export const PropCard: React.FC<{
  prop: {
    hanzi: string;
    prop: string;
    description: string;
    main_tagname: string;
  };
}> = ({ prop }) => {
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
        <div className="font-mono text-blue-800 font-bold">
          <Link
            to={`/prop/${prop.prop}`}
            className="hover:text-blue-600 mr-2 hover:underline"
          >
            {prop.main_tagname.substring(6)}
          </Link>
          <button
            className="rounded-2xl bg-blue-100 p-1 ml-2 inline text-xs text-blue-500"
            onClick={async () => {
              await anki_open_browse(
                "note:Props tag:prop::" + prop.prop + " " + prop.prop
              );
            }}
          >
            anki
          </button>
          <div>
            <PinyinText v={getNewCharacter(prop.hanzi.substring(0, 1))} />
          </div>
        </div>
        <div
          className="text-gray-500"
          dangerouslySetInnerHTML={{ __html: prop.description }}
        ></div>
      </div>
    </div>
  );
};
