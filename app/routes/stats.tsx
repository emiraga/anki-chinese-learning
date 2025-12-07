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
  const { props, characters } = useOutletContext<OutletContext>();

  let chars = Object.values(characters);
  let charsWithSoundComponent = Object.values(characters).filter(
    (c) => c.soundComponentCharacter && c.soundComponentCharacter.length > 0,
  );

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

      <Section className="block" display={chars.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of characters: ({chars.length})
        </h3>
        {chars.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </Section>

      <Section className="block" display={charsWithSoundComponent.length > 0}>
        <h3 className="font-serif text-4xl my-2">
          List of characters with sound component: (
          {charsWithSoundComponent.length})
        </h3>
        {charsWithSoundComponent.map((p, i) => (
          <span key={i} className="mx-1">
            {p.traditional} ({p.soundComponentCharacter})
          </span>
        ))}
      </Section>
    </MainFrame>
  );
}
