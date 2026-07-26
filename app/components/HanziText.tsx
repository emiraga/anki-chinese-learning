import { useOutletContext, Link } from "react-router";
import { getNewCharacter, type CharactersType } from "~/data/characters";
import type { OutletContext } from "~/data/types";
import { CharCardDetails, CharLink } from "./CharCard";
import { IGNORE_PHRASE_CHARS, IGNORE_PHRASES } from "~/data/phrases";
import { segmentChineseText, type SegmentationAlgorithm } from "~/utils/text";
import { useMemo } from "react";

export const MissingCharsByFrequency: React.FC<{ text: string }> = ({
  text,
}) => {
  const { characters } = useOutletContext<OutletContext>();

  const missingChars = useMemo(() => {
    if (!text) return [];

    const charCounts = new Map<string, number>();

    for (const c of text) {
      if (IGNORE_PHRASE_CHARS.has(c)) continue;
      if (characters[c]) continue;

      charCounts.set(c, (charCounts.get(c) || 0) + 1);
    }

    return Array.from(charCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([char, count]) => ({ char, count }));
  }, [text, characters]);

  if (missingChars.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-lg font-semibold mb-2">
        Missing Characters ({missingChars.length}):
      </h4>
      <div className="flex flex-wrap gap-2">
        {missingChars.map(({ char, count }) => (
          <span key={char} className="inline-flex items-center">
            <CharLink traditional={char} className="text-red-600 text-2xl" />
            <span className="text-sm text-gray-500 ml-1">×{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

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

// Matches any CJK ideograph so we only linkify actual Chinese, leaving
// surrounding English text (as produced by the AI) untouched.
const CJK_REGEX = /[㐀-䶿一-鿿豈-﫿]/;

const containsChinese = (text: string): boolean => CJK_REGEX.test(text);

/**
 * Renders arbitrary text (typically mixed English/Chinese coming back from the
 * AI) with the Chinese portions linkified via segmentation, while keeping the
 * original font, spacing and flow of the surrounding text intact. Multi-char
 * Chinese words are underlined to show segmentation boundaries; single chars
 * are only colored to indicate their learning status.
 */
export const HanziInlineText: React.FC<{
  value?: string;
  algorithm?: SegmentationAlgorithm;
}> = ({ value, algorithm }) => {
  const { characters, phrases } = useOutletContext<OutletContext>();

  const knowPhrases = useMemo(() => {
    return new Set(phrases.map((p) => p.traditional));
  }, [phrases]);

  if (!value) {
    return <></>;
  }

  const segments = segmentChineseText(value, algorithm);

  const charClassName = (c: string): string => {
    if (!characters[c]) {
      return "text-red-600";
    } else if (!characters[c].withSound) {
      return "text-green-600";
    }
    return "";
  };

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.text === "\n") {
          return <br key={i} />;
        }

        // Leave non-Chinese runs (English words, spaces, punctuation) as plain
        // text so the surrounding prose flows exactly as before.
        if (!containsChinese(segment.text)) {
          return <span key={i}>{segment.text}</span>;
        }

        // Multi-character Chinese word: link to the phrase, underlined to show
        // the segmentation boundary. Kept inline so text flow is preserved.
        if (segment.text.length > 1 && !IGNORE_PHRASES.has(segment.text)) {
          return (
            <Link
              key={i}
              to={`/phrase/${segment.text}`}
              className={
                knowPhrases.has(segment.text)
                  ? "border-b-2 border-gray-600 hover:border-blue-500"
                  : "border-b-2 border-red-500 hover:border-blue-500"
              }
            >
              {[...segment.text].map((c, charIndex) => {
                if (IGNORE_PHRASE_CHARS.has(c)) {
                  return c;
                }
                return (
                  <span key={charIndex} className={charClassName(c)}>
                    {c}
                  </span>
                );
              })}
            </Link>
          );
        }

        // Single character (or an ignored phrase falling through): linkify each
        // Chinese char on its own.
        return [...segment.text].map((c, charIndex) => {
          if (IGNORE_PHRASE_CHARS.has(c)) {
            return <span key={`${i}-${charIndex}`}>{c}</span>;
          }
          return (
            <CharLink
              key={`${i}-${charIndex}`}
              traditional={c}
              className={charClassName(c)}
            />
          );
        });
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
          // Check if the phrase should be ignored completely
          const isIgnoredPhrase = IGNORE_PHRASES.has(segment.text);

          const shouldUnderline =
            !isIgnoredPhrase &&
            [...segment.text].filter((c) => !IGNORE_PHRASE_CHARS.has(c))
              .length > 0;

          return (
            <Link
              key={i}
              to={`/phrase/${segment.text}`}
              className={`inline-block ${
                shouldUnderline
                  ? knowPhrases.has(segment.text)
                    ? " border-b-2 border-gray-600 hover:border-blue-500 "
                    : " border-b-2 border-red-500 hover:border-blue-500 "
                  : ""
              } mx-1 px-1 py-1`}
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
                  <span key={charIndex} className={className}>
                    {c}
                  </span>
                );
              })}
            </Link>
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
