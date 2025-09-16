import type { Route } from "./+types/index";
import { Link, useOutletContext } from "react-router";
import MainFrame from "~/toolbar/frame";
import Section from "~/toolbar/section";
import { HanziText } from "~/components/HanziText";
import { LearnLink } from "~/components/Learn";
import type { OutletContext } from "~/data/types";
import { getWeakCharacters } from "~/data/weak_chars";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Study Weak Characters" },
    {
      name: "description",
      content: "Study characters with fewest phrase occurrences",
    },
  ];
}

export default function StudyWeakChars() {
  const { loading, characters, phrases } = useOutletContext<OutletContext>();

  const weakChars = loading || !characters || !phrases
    ? []
    : getWeakCharacters(phrases, characters, 300);

  return (
    <MainFrame>
      <Section className="m-1">
        <h1 className="text-2xl font-bold mb-4">Study Weak Characters</h1>
        <p className="text-gray-600 mb-4">
          Characters with the fewest phrase occurrences - these may need more
          practice!
        </p>
      </Section>

      <Section loading={loading} display={weakChars.length > 0}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {weakChars.map((charInfo) => (
            <div
              key={charInfo.char}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-center mb-3">
                <div className="text-6xl font-bold text-blue-600">
                  <HanziText value={charInfo.char} />
                </div>
              </div>

              <div className="text-center mb-3">
                <div className="text-sm text-gray-600">
                  Appears in{" "}
                  <span className="font-bold">{charInfo.totalPhraseCount}</span>{" "}
                  phrase{charInfo.totalPhraseCount !== 1 ? "s" : ""}
                </div>
              </div>

              {characters[charInfo.char] && (
                <div className="text-center mb-3">
                  <div className="text-sm text-gray-700">
                    {characters[charInfo.char].meaning}
                  </div>
                  <div className="text-xs text-gray-500">
                    {characters[charInfo.char].pinyin
                      .map((p) => p.pinyinAccented)
                      .join(", ")}
                  </div>
                </div>
              )}

              <div className="text-center">
                <Link
                  to={`/char/${charInfo.char}`}
                  className="inline-block px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm mr-2"
                >
                  Study
                </Link>
                <LearnLink char={charInfo.char} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section display={!loading && weakChars.length === 0}>
        <div className="text-center text-gray-500">
          No weak characters found. All characters appear in multiple phrases!
        </div>
      </Section>
    </MainFrame>
  );
}
