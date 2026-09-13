import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { CharListConflicts } from "~/components/CharList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import {
  getConflictingChars,
  getMissingSentenceChars,
  type CharacterConflict,
} from "~/data/char_conflicts";
import { CharConflictSections } from "~/components/CharConflictSections";
import { CharCardDetails } from "~/components/CharCard";
import { getNewCharacter } from "~/data/characters";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Conflicts" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

type GroupedConflicts = {
  messyProps: CharacterConflict[];
  missingProps: CharacterConflict[];
  noPinyinFromPhrases: CharacterConflict[];
  pinyinMismatch: CharacterConflict[];
};

export default function Conflicts() {
  const { knownProps, characters, charPhrasesPinyin, phrases } =
    useOutletContext<OutletContext>();

  const conflicting = getConflictingChars(
    knownProps,
    characters,
    charPhrasesPinyin,
  );

  const missingSentenceChars = getMissingSentenceChars(phrases, characters);

  // Group conflicts by reason
  const groupedConflicts: GroupedConflicts = {
    messyProps: [],
    missingProps: [],
    noPinyinFromPhrases: [],
    pinyinMismatch: [],
  };

  for (const conflict of conflicting) {
    const reasonType = conflict.reason.type;
    if (reasonType === "messy_props") {
      groupedConflicts.messyProps.push(conflict);
    } else if (reasonType === "missing_props") {
      groupedConflicts.missingProps.push(conflict);
    } else if (reasonType === "no_pinyin_from_phrases") {
      groupedConflicts.noPinyinFromPhrases.push(conflict);
    } else if (reasonType === "pinyin_mismatch") {
      groupedConflicts.pinyinMismatch.push(conflict);
    }
  }

  return (
    <MainFrame>
      <section className="block">
        <h2 className="font-serif text-4xl m-4">
          Character Conflicts ({conflicting.length})
        </h2>
        <CharListConflicts
          title="Messy Props (Position Conflicts)"
          conflicts={groupedConflicts.messyProps}
          charPhrasesPinyin={charPhrasesPinyin}
        />

        <CharListConflicts
          title="Pinyin Mismatch"
          conflicts={groupedConflicts.pinyinMismatch}
          charPhrasesPinyin={charPhrasesPinyin}
        />

        <CharListConflicts
          title="Missing Props"
          conflicts={groupedConflicts.missingProps}
          charPhrasesPinyin={charPhrasesPinyin}
        />

        <CharListConflicts
          title="No Pinyin from Phrases"
          conflicts={groupedConflicts.noPinyinFromPhrases}
          charPhrasesPinyin={charPhrasesPinyin}
        />

        {missingSentenceChars.length > 0 && (
          <section className="block m-4">
            <h3 className="font-serif text-3xl m-4">
              Missing Sentence Traditional Chars ({missingSentenceChars.length}):
            </h3>
            <div className="text-8xl mx-6 bg-red-100 w-full">
              {missingSentenceChars.join("")}
            </div>
            {missingSentenceChars.map((c, i) => {
              const char = characters[c] ?? getNewCharacter(c);
              if (!char) {
                return (
                  <div key={i} className="text-8xl mx-6 bg-red-100 w-full">
                    {c}
                  </div>
                );
              }
              return <CharCardDetails key={i} char={char} />;
            })}
          </section>
        )}

        <CharConflictSections />
      </section>
    </MainFrame>
  );
}
