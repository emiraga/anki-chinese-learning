import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { IGNORE_PHRASE_CHARS } from "~/data/phrases";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { HanziCardDetails, HanziText } from "~/components/HanziText";
import { removeDuplicateChars, useLocalStorageState } from "~/data/utils";
import Section from "~/toolbar/section";
import { useSettings } from "~/settings/SettingsContext";
import Textarea from "react-textarea-autosize";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoCharsSentenceInput() {
  const { characters } = useOutletContext<OutletContext>();
  let [sentence, setSentence] = useLocalStorageState(
    "todoCharsSentenceInput",
    ""
  );
  const { settings } = useSettings();

  return (
    <main>
      <MainToolbar />
      <section className="block">
        <h3 className="font-serif text-2xl m-4">
          <p>Write some chinese text (or copy-paste it):</p>
          <Textarea
            className="border-2"
            value={sentence}
            minRows={2}
            cols={60}
            onChange={(v) => setSentence(v.target.value)}
          />
        </h3>
        <div className="text-2xl m-2">
          <HanziText value={sentence} />
        </div>
      </section>
      <Section display={!!settings.characterNote?.noteType}>
        {[...removeDuplicateChars(sentence, IGNORE_PHRASE_CHARS)].map(
          (c, i) => (
            <HanziCardDetails key={i} c={c} characters={characters} />
          )
        )}
      </Section>
    </main>
  );
}
