import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { PinyinText } from "~/components/PinyinText";
import { CharLink } from "~/components/CharCard";
import Section from "~/toolbar/section";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoCharsMultiplePronunciation() {
  const { characters, charPhrasesPinyin } = useOutletContext<OutletContext>();

  const multiple = Object.values(characters)
    .map((char) => {
      var phrasesPinyin = charPhrasesPinyin[char.traditional] || {};
      const keys = Object.keys(phrasesPinyin);
      if (
        keys.length === 2 &&
        phrasesPinyin[keys[0]].sylable === phrasesPinyin[keys[1]].sylable
      ) {
        if (phrasesPinyin[keys[0]].tone === 5) {
          delete phrasesPinyin[keys[0]];
        }
        if (phrasesPinyin[keys[1]].tone === 5) {
          delete phrasesPinyin[keys[1]];
        }
      }
      return {
        ...char,
        phrasesPinyin,
        showWarning:
          Object.keys(phrasesPinyin).length !== 1 &&
          char.withSound &&
          !char.tags.includes("multiple-pronounciation-character"),
      };
    })
    .filter(
      (char) => Object.keys(char.phrasesPinyin).length !== 1 && char.withSound
    );

  return (
    <main>
      <MainToolbar />
      <Section className="m-3" display={multiple.length > 0}>
        <h3 className="font-serif text-2xl">Multiple pronounciations:</h3>
        {multiple.map((char) => (
          <div key={char.ankiId}>
            <CharLink traditional={char.traditional} className="text-2xl" />
            {Object.values(char.phrasesPinyin).map((pinyin) => (
              <span className="mx-3" key={pinyin.pinyin_1}>
                <PinyinText v={pinyin} />:{pinyin.count}
              </span>
            ))}
            {char.showWarning ? (
              <span className="p-1 m-1 rounded-4xl bg-red-400 dark:bg-red-600">
                Warning!
              </span>
            ) : undefined}
          </div>
        ))}
      </Section>
    </main>
  );
}
