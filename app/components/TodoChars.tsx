import { getNewCharacter, type CharactersType } from "~/data/characters";
import { IGNORE_PHRASE_CHARS, type PhraseType } from "~/data/phrases";
import { HanziCardDetails } from "./HanziText";
import { CharCardDetails } from "./CharCard";
import React from "react";
import { removeDuplicateChars } from "~/data/utils";

export const TodoCharsList: React.FC<{
  sentence: string;
  phrases: PhraseType[];
  characters: CharactersType;
}> = ({ sentence, phrases, characters }) => {
  if (sentence.length > 0) {
    return (
      <>
        {[...sentence].map((c, i) => (
          <HanziCardDetails key={i} c={c} characters={characters} />
        ))}
      </>
    );
  }

  let todo = Object.values(characters).filter((c) => {
    if (c.tags.includes("TODO")) {
      return true;
    }
    if (c.tags.length < 2) {
      return true;
    }
    if (c.tags.filter((t) => t.startsWith("prop::")).length === 0) {
      return true;
    }
    return false;
  });
  let somePropsMissing = Object.values(characters).filter((c) =>
    c.tags.includes("some-props-missing")
  );
  let somePropsIgnored = Object.values(characters).filter((c) =>
    c.tags.includes("some-props-ignored")
  );
  let tocflChars = removeDuplicateChars(
    phrases.map((c) => c.traditional).join(""),
    IGNORE_PHRASE_CHARS
  );

  return (
    <>
      {[...tocflChars].map((c, i) => {
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
        <h3 className="font-serif text-4xl m-4">
          List of TODO: ({todo.length}){" "}
        </h3>
      ) : undefined}
      {todo.map((char, i) => {
        return <CharCardDetails key={i} char={char} />;
      })}
      {somePropsMissing.length > 0 ? (
        <h3 className="font-serif text-4xl m-4">
          Missing props: ({somePropsMissing.length})
        </h3>
      ) : undefined}
      {somePropsMissing.map((char, i) => {
        return <CharCardDetails key={i} char={char} />;
      })}
      {somePropsIgnored.length > 0 ? (
        <h3 className="font-serif text-4xl m-4">
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
