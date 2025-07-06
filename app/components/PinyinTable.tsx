import {
  JSON_DATA,
  FULL_MAP,
  INITIAL_TYPE,
  PLACE_TAGS_MAP,
  ACTOR_TAGS_MAP,
} from "~/data/pinyin_table";
import { PinyinCell } from "./PinyinCell";
import type { KnownSoundsType } from "~/data/characters";
import { Link } from "react-router";

export const PinyinTable: React.FC<{ knownSounds: KnownSoundsType }> = ({
  knownSounds,
}) => {
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
                </Link>
              </th>
            );
          })}
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
                      value={FULL_MAP[initial][final]}
                      knownSounds={knownSounds}
                    ></PinyinCell>
                  </td>
                );
              })}
              <th scope="row">{initial}</th>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
