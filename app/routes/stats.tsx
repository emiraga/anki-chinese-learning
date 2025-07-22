import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";
import Section from "~/toolbar/section";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stats" },
    { name: "description", content: "Detailed statistics!" },
  ];
}

export default function Stats() {
  const { props, phrases, characters } = useOutletContext<OutletContext>();

  let charsComplete = Object.values(characters).filter(
    (c) => c.withSound && c.withMeaning
  );
  let charsWithoutSound = Object.values(characters).filter((c) => !c.withSound);
  let charsWithoutMeaning = Object.values(characters).filter(
    (c) => !c.withMeaning
  );
  const uniquePhrases = new Set(phrases.map((phrase) => phrase.traditional));
  return (
    <MainFrame>
      <Section className="block" display={props.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of props: ({props.length})
        </h3>
        {props.map((p, i) => (
          <span key={i}>{p.hanzi.startsWith("<img") ? "?" : p.hanzi}</span>
        ))}
      </Section>

      <Section className="block" display={charsWithoutSound.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of characters without sound: ({charsWithoutSound.length})
        </h3>
        {charsWithoutSound.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </Section>

      <Section className="block" display={charsWithoutMeaning.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of characters without meaning: ({charsWithoutMeaning.length})
        </h3>
        {charsWithoutMeaning.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </Section>

      <Section className="block" display={charsComplete.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of characters: ({charsComplete.length})
        </h3>
        {charsComplete.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </Section>

      <Section className="block" display={uniquePhrases.size > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of phrases: ({uniquePhrases.size})
        </h3>
        {[...uniquePhrases].map((p, i) => (
          <span key={i}>{p}。</span>
        ))}
      </Section>
    </MainFrame>
  );
}
