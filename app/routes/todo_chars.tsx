import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { useState } from "react";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { HanziCardDetails, HanziText } from "~/components/HanziText";
import { Link } from "react-router";
import { TodoCharsList } from "~/components/TodoChars";
import { removeDuplicateChars } from "~/data/utils";
import { PinyinText } from "~/components/PinyinText";
import { CharLink } from "~/components/CharCard";
import Section from "~/toolbar/section";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoChars() {
  const { phrases, characters, charPhrasesPinyin, props } =
    useOutletContext<OutletContext>();
  let [sentence, setSentence] = useState("");
  const { settings } = useSettings();

  const multiple = Object.values(characters)
    .map((char) => ({
      ...char,
      phrasesPinyin: charPhrasesPinyin[char.traditional] || {},
    }))
    .filter(
      (char) => Object.keys(char.phrasesPinyin).length !== 1 && char.withSound
    );

  return (
    <main>
      <MainToolbar />
      <section className="block">
        <Link
          to="/chars"
          className="ml-2 mt-1 text-blue-900 font-extrabold hover:text-blue-700 underline"
        >
          See all chars.
        </Link>
        {props.length > 0 ? (
          <Link
            to="/props"
            className="ml-2 mt-1 text-blue-900 font-extrabold hover:text-blue-700 underline"
          >
            See all props.
          </Link>
        ) : undefined}
        <h3 className="font-serif text-2xl m-4">
          <p>Write some chinese text (or copy-paste it):</p>
          <textarea
            className="border-2"
            value={sentence}
            rows={2}
            cols={60}
            onChange={(v) => setSentence(v.target.value)}
          />
        </h3>
        <div className="text-2xl m-2">
          <HanziText value={sentence} />
        </div>
      </section>
      <Section display={!!settings.characterNote?.noteType}>
        <TodoCharsList
          phrases={phrases}
          sentence={removeDuplicateChars(sentence, IGNORE_PHRASE_CHARS)}
          characters={characters}
        />
      </Section>
      <Section className="m-3" display={multiple.length > 0}>
        <h3 className="font-serif text-2xl">Multiple pronounciations:</h3>
        {multiple.map((char) => (
          <div key={char.ankiId}>
            <CharLink traditional={char.traditional} className="text-2xl" />
            {Object.values(char.phrasesPinyin).map((pinyin) => (
              <span className="mx-3" key={pinyin.pinyin}>
                <PinyinText v={pinyin} />:{pinyin.count}
              </span>
            ))}
          </div>
        ))}
      </Section>
    </main>
  );
}
