import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useState } from "react";
import { PhraseList } from "~/components/Phrase";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Phrases" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Phrases() {
  const { phrases } = useOutletContext<OutletContext>();
  const [search, setSearch] = useState("");

  const filteredPhrases =
    search.length > 0
      ? phrases.filter(
          (phrase) =>
            phrase.meaning.includes(search) ||
            phrase.traditional.includes(search) ||
            phrase.pinyin.includes(search)
        )
      : phrases;

  return (
    <main>
      <MainToolbar />
      <h3 className="font-serif text-4xl m-4 text-gray-900 dark:text-gray-100">
        List of phrases: ({phrases.length})
        <input
          value={search}
          className="font-sans text-lg border ml-4 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search..."
          onChange={(x) => {
            setSearch(x.currentTarget.value);
          }}
        />
      </h3>
      <section className="block m-4">
        <PhraseList phrases={filteredPhrases} />
      </section>
    </main>
  );
}
