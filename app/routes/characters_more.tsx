import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharactersMore } from "~/components/CharactersMore";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "More Characters" },
    {
      name: "description",
      content: "Unknown characters from phrase examples, by frequency",
    },
  ];
}

export default function CharactersMoreRoute() {
  const { phrases, characters } = useOutletContext<OutletContext>();
  const {
    settings: { features },
  } = useSettings();

  return (
    <MainFrame>
      <section className="block mx-4">
        <CharactersMore
          phrases={phrases}
          characters={characters}
          showZhuyin={features?.showZhuyin}
        />
      </section>
    </MainFrame>
  );
}
