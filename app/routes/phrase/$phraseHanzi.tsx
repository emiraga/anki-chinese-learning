import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/$phraseHanzi";
import { useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { PhraseCard, PhraseList } from "~/components/Phrase";
import { SearchMorePhrases } from "~/components/MorePhrases";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { removeDuplicateChars } from "~/utils/array";
import { HanziCardDetails, HanziText } from "~/components/HanziText";
import { useSettings } from "~/settings/SettingsContext";

export function meta({ params }: Route.MetaArgs) {
  const phraseHanzi = decodeURIComponent(params.phraseHanzi || "");
  return [
    { title: `Phrase: ${phraseHanzi}` },
    {
      name: "description",
      content: `Details for phrase ${phraseHanzi}`,
    },
  ];
}

export default function PhraseHanzi() {
  const { phraseHanzi: encodedPhraseHanzi } = useParams();
  const { phrases, characters } = useOutletContext<OutletContext>();
  const { settings } = useSettings();

  if (!encodedPhraseHanzi) {
    throw new Error("Expected hanzi");
  }

  const phraseHanzi = decodeURIComponent(encodedPhraseHanzi);

  const filteredPhrases = phrases.filter((phrase) =>
    phrase.traditional.includes(phraseHanzi)
  );
  const noteTypes = settings.phraseNotes.map((pn) => pn.noteType);
  return (
    <MainFrame>
      <PhraseCard phraseHanzi={phraseHanzi} />
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
    </MainFrame>
  );
}
