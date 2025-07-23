import { useOutletContext } from "react-router";
import { getNewCharacter, type CharactersType } from "~/data/characters";
import type { OutletContext } from "~/data/types";
import { CharCardDetails, CharLink } from "./CharCard";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";

export const HanziText: React.FC<{ value?: string }> = ({ value }) => {
  const { characters } = useOutletContext<OutletContext>();
  if (!value) {
    return <></>;
  }
  return (
    <>
      {[...value].map((c, i) => {
        if (c === "\n") {
          return <br key={i} />;
        }
        var className = "";
        if (IGNORE_PHRASE_CHARS.has(c)) {
          return c;
        } else if (!characters[c]) {
          className = "text-red-600";
        } else if (!characters[c].withSound) {
          className = "text-green-600";
        } else if (!characters[c].withMeaning) {
          className = "text-blue-500";
        }

        return <CharLink key={i} traditional={c} className={className} />;
      })}
    </>
  );
};

export const HanziCardDetails: React.FC<{
  c: string;
  characters: CharactersType;
}> = ({ c, characters }) => {
  if (characters[c] === undefined) {
    let char = getNewCharacter(c);
    if (char !== null) {
      return <CharCardDetails key={c} char={char} />;
    } else {
      return (
        <div key={c} className="text-xl mx-6 bg-red-100">
          {c}
        </div>
      );
    }
  } else {
    return <CharCardDetails key={c} char={characters[c]} />;
  }
};
