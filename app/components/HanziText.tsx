import { useOutletContext } from "react-router";
import { getNewCharacter, type CharactersType } from "~/data/characters";
import type { OutletContext } from "~/data/types";
import { CharCardDetails, CharLink } from "./CharCard";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { segmentChineseText, type SegmentationAlgorithm } from "~/data/utils";

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

export const HanziSegmentedText: React.FC<{
  value?: string;
  algorithm?: SegmentationAlgorithm;
}> = ({ value, algorithm }) => {
  const { characters } = useOutletContext<OutletContext>();

  if (!value) {
    return <></>;
  }

  const segments = segmentChineseText(value, algorithm);

  return (
    <>
      {/*<div className="font-mono text-lg">
        {segments.map((x) => (x.isWord ? "(" + x.text + ")" : x.text)).join("")}
      </div>*/}
      {segments.map((segment, i) => {
        if (segment.text === "\n") {
          return <br key={i} />;
        }

        // For multi-character words, wrap in a container with word styling
        if (segment.isWord) {
          return (
            <span
              key={i}
              className="inline-block border-b border-gray-600 mx-1"
            >
              {[...segment.text].map((c, charIndex) => {
                if (IGNORE_PHRASE_CHARS.has(c)) {
                  return c;
                }

                let className = "";
                if (!characters[c]) {
                  className = "text-red-600";
                } else if (!characters[c].withSound) {
                  className = "text-green-600";
                }

                return (
                  <CharLink
                    key={charIndex}
                    traditional={c}
                    className={className}
                  />
                );
              })}
            </span>
          );
        } else {
          // Single character or punctuation
          if (IGNORE_PHRASE_CHARS.has(segment.text)) {
            return segment.text;
          }
          const c = segment.text[0];

          let className = "";
          if (!characters[c]) {
            className = "text-red-600";
          } else if (!characters[c].withSound) {
            className = "text-green-600";
          }

          return (
            <CharLink
              key={i}
              traditional={segment.text}
              className={className}
            />
          );
        }
      })}
    </>
  );
};
