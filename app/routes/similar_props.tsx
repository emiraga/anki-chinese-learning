import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { SimilarPropsList } from "~/components/SimilarProps";
import Section from "~/toolbar/section";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Similar Props" },
    { name: "description", content: "Characters with similar props" },
  ];
}

export default function SimilarProps() {
  const { characters } = useOutletContext<OutletContext>();
  const { settings } = useSettings();

  return (
    <MainFrame>
      <Section display={!!settings.characterNote?.noteType}>
        <SimilarPropsList characters={characters} />
      </Section>
    </MainFrame>
  );
}
