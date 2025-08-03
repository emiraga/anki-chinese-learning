import { getNewCharacter, type CharactersType } from "~/data/characters";
import { type PhraseType } from "~/data/phrases";
import { CharCardDetails } from "./CharCard";
import React from "react";
import { getMissingPhraseChars } from "~/data/char_conflicts";

export const TodoCharsList: React.FC<{
  phrases: PhraseType[];
  characters: CharactersType;
}> = ({ phrases, characters }) => {
  let todo = Object.values(characters).filter((c) => c.todoMoreWork);
  let somePropsIgnored = Object.values(characters).filter((c) =>
    c.tags.includes("some-props-ignored")
  );
  let missingChars = getMissingPhraseChars(phrases, characters);

  return (
    <>
      {[...missingChars].map((c, i) => {
        if (characters[c] === undefined || characters[c].withSound === false) {
          let char = characters[c] ? characters[c] : getNewCharacter(c);
          if (char !== null) {
            return <CharCardDetails key={i} char={char} />;
          } else {
            return (
              <div key={i} className="text-8xl mx-6 bg-red-100 w-full">
                {c}
              </div>
            );
          }
        } else {
          return <React.Fragment key={i}></React.Fragment>;
        }
      })}
      {todo.length > 0 ? (
        <h3 className="font-serif text-3xl m-4">
          List of TODO: ({todo.length}){" "}
        </h3>
      ) : undefined}
      {todo.map((char, i) => {
        return <CharCardDetails key={i} char={char} />;
      })}
      {somePropsIgnored.length > 0 ? (
        <h3 className="font-serif text-3xl m-4">
          Ignored props: ({somePropsIgnored.length})
        </h3>
      ) : undefined}
      <div className="bg-gray-300">
        {somePropsIgnored.map((char, i) => {
          return <CharCardDetails key={i} char={char} />;
        })}
      </div>
    </>
  );
};
