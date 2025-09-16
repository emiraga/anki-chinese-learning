import { useOutletContext, useNavigate } from "react-router";
import { getNewCharacter, type CharactersType } from "~/data/characters";
import type { OutletContext } from "~/data/types";
import { CharCardDetails, CharLink } from "./CharCard";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { segmentChineseText, type SegmentationAlgorithm } from "~/data/utils";
import { useMemo } from "react";

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
  const { characters, phrases } = useOutletContext<OutletContext>();
  const navigate = useNavigate();

  const knowPhrases = useMemo(() => {
    return new Set(phrases.map((p) => p.traditional));
  }, [phrases]);

  const segments = value ? segmentChineseText(value, algorithm) : [];

  if (!value) {
    return <></>;
  }

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.text === "\n") {
          return <br key={i} />;
        }

        // For multi-character words, wrap in a container with word styling
        if (segment.text.length > 1) {
          const shouldUnderline =
            [...segment.text].filter((c) => !IGNORE_PHRASE_CHARS.has(c))
              .length > 0;

          return (
            <span
              key={i}
              onClick={() => navigate(`/phrase/${segment.text}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/phrase/${segment.text}`);
                }
              }}
              tabIndex={0}
              role="button"
              className={`inline-block ${
                shouldUnderline
                  ? knowPhrases.has(segment.text)
                    ? " border-b-2 border-gray-600 hover:border-blue-500 "
                    : " border-b-2 border-red-500 hover:border-blue-500 "
                  : ""
              } mx-1 px-1 py-1 cursor-pointer`}
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
          const c = segment.text[0];
          if (IGNORE_PHRASE_CHARS.has(c)) {
            return c;
          }

          let className = "";
          if (!characters[c]) {
            className = "text-red-600";
          } else if (!characters[c].withSound) {
            className = "text-green-600";
          }

          return <CharLink key={i} traditional={c} className={className} />;
        }
      })}
    </>
  );
};
