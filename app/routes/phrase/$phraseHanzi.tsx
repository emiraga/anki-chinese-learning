import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "../+types/index";
import { useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { PhraseList } from "~/components/Phrase";
import { SearchMorePhrases } from "~/components/StudyMore";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { removeDuplicateChars } from "~/data/utils";
import { HanziCardDetails, HanziText } from "~/components/HanziText";
import { useSettings } from "~/settings/SettingsContext";

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
  const { settings } = useSettings();

  if (!phraseHanzi) {
    throw new Error("Expected hanzi");
  }

  const noteTypes = settings.phraseNotes.map((pn) => pn.noteType);
  const filteredPhrases = phrases.filter((phrase) =>
    phrase.traditional.includes(phraseHanzi)
  );
  return (
    <main>
      <MainToolbar />
      {[
        ...removeDuplicateChars(
          removeDuplicateChars(phraseHanzi, IGNORE_PHRASE_CHARS),
          IGNORE_PHRASE_CHARS
        ),
      ].map((c, i) => (
        <HanziCardDetails key={i} c={c} characters={characters} />
      ))}
      <h3 className="font-serif text-4xl m-4">
        List of <HanziText value={phraseHanzi} /> phrases: (
        {filteredPhrases.length})
      </h3>
      <section className="block mx-4">
        <PhraseList phrases={filteredPhrases} />
      </section>

      <hr className="my-4" />
      <h2 className="text-2xl">Known character phrases:</h2>
      <SearchMorePhrases
        noteTypes={noteTypes}
        search={phraseHanzi}
        filterKnownChars={true}
      />
      <hr className="my-4" />
      <h2 className="text-2xl">Phrases with unknown characters:</h2>
      <SearchMorePhrases
        noteTypes={noteTypes}
        search={phraseHanzi}
        filterUnknownChars={true}
      />
    </main>
  );
}
