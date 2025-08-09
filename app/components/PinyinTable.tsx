import {
  JSON_DATA,
  FULL_MAP,
  INITIAL_TYPE,
  PLACE_TAGS_MAP,
  ACTOR_TAGS_MAP,
  PLACE_TAGS_ZHUYIN,
  ACTOR_NAMES_ZHUYIN,
} from "~/data/pinyin_table";
import { PinyinCell } from "./PinyinCell";
import type { KnownSoundsType } from "~/data/characters";
import { Link } from "react-router";

export const PinyinTable: React.FC<{
  knownSounds: KnownSoundsType;
  showZhuyin?: boolean;
}> = ({ knownSounds, showZhuyin }) => {
  return (
    <table className="pinyin-table">
      <thead>
        <tr>
          <th></th>
          {JSON_DATA.finals.map((final) => {
            return (
              <th key={final}>
                <Link
                  to={"/place/" + PLACE_TAGS_MAP[final].replace("place::", "")}
                >
                  {final}
                  {showZhuyin ? (
                    <div className="text-sm">{PLACE_TAGS_ZHUYIN[final]}</div>
                  ) : undefined}
                </Link>
              </th>
            );
          })}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {JSON_DATA.initials.map((initial) => {
          return (
            <tr key={initial} className={"row-" + INITIAL_TYPE[initial]}>
              <th scope="row">
                <Link
                  to={
                    "/actor/" +
                    (ACTOR_TAGS_MAP[initial] || "").replace("actor::", "")
                  }
                >
                  {initial}
                </Link>
              </th>
              {JSON_DATA.finals.map((final) => {
                return (
                  <td key={final}>
                    <PinyinCell
                      sylable={FULL_MAP[initial][final]}
                      knownSounds={knownSounds}
                      showZhuyin={showZhuyin}
                    ></PinyinCell>
                  </td>
                );
              })}
              <th scope="row" className="text-nowrap">
                <Link
                  to={
                    "/actor/" +
                    (ACTOR_TAGS_MAP[initial] || "").replace("actor::", "")
                  }
                >
                  {showZhuyin ? (
                    <span className="text-sm">
                      {ACTOR_NAMES_ZHUYIN[initial]}
                    </span>
                  ) : (
                    initial
                  )}
                </Link>
              </th>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
