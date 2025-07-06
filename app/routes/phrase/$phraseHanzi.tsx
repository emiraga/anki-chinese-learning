import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { PhraseList } from "~/components/Phrase";
import { SearchMorePhrases } from "~/components/StudyMore";
import { TodoCharsList } from "~/components/TodoChars";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { removeDuplicateChars } from "~/data/utils";
import { HanziText } from "~/components/HanziText";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Phrase: ${params.phraseHanzi}` },
    {
      name: "description",
      content: `Details for phrase ${params.phraseHanzi}`,
    },
  ];
}

export default function PhraseHanzi() {
  const { phraseHanzi } = useParams();
  const { phrases, characters } = useOutletContext<OutletContext>();

  if (!phraseHanzi) {
    throw new Error("Expected hanzi");
  }

  const filteredPhrases = phrases.filter((phrase) =>
    phrase.traditional.includes(phraseHanzi)
  );
  return (
    <main>
      <MainToolbar />
      <TodoCharsList
        phrases={phrases}
        sentence={removeDuplicateChars(phraseHanzi, IGNORE_PHRASE_CHARS)}
        characters={characters}
      />

      <h3 className="font-serif text-4xl m-4">
        List of <HanziText value={phraseHanzi} /> phrases: (
        {filteredPhrases.length})
      </h3>
      <section className="block m-4">
        <PhraseList phrases={filteredPhrases} />
      </section>

      <hr className="my-4" />
      <h2 className="text-2xl">Known character phrases:</h2>
      <SearchMorePhrases
        noteType={["TOCFL", "Dangdai", "MyWords"]}
        search={phraseHanzi}
        filterKnownChars={true}
      />
      <hr className="my-4" />
      <h2 className="text-2xl">All other phrases:</h2>
      <SearchMorePhrases
        noteType={["TOCFL", "Dangdai", "MyWords"]}
        search={phraseHanzi}
        filterKnownChars={false}
      />
    </main>
  );
}
