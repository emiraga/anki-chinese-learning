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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoChars() {
  const { phrases, characters, charPhrasesPinyin } =
    useOutletContext<OutletContext>();
  let [sentence, setSentence] = useState("");

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
        <Link
          to="/props"
          className="ml-2 mt-1 text-blue-900 font-extrabold hover:text-blue-700 underline"
        >
          See all props.
        </Link>
        <h3 className="font-serif text-2xl m-4">
          Sentence:{" "}
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
        <TodoCharsList
          phrases={phrases}
          sentence={removeDuplicateChars(sentence, IGNORE_PHRASE_CHARS)}
          characters={characters}
        />
        <div className="m-3">
          <h3 className="font-serif text-2xl">Multiple pronounciations:</h3>
          {Object.values(characters)
            .map((char) => ({
              ...char,
              phrasesPinyin: charPhrasesPinyin[char.traditional] || {},
            }))
            .filter(
              (char) =>
                Object.keys(char.phrasesPinyin).length !== 1 && char.withSound
            )
            .map((char) => (
              <div key={char.ankiId}>
                <CharLink traditional={char.traditional} className="text-2xl" />
                {Object.values(char.phrasesPinyin).map((pinyin) => (
                  <span className="mx-3" key={pinyin.pinyin}>
                    <PinyinText v={pinyin} />:{pinyin.count}
                  </span>
                ))}
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
