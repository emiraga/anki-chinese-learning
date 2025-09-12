import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { CharList } from "~/components/CharList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "All characters listed in a grid." },
  ];
}

export default function Chars() {
  const { characters } = useOutletContext<OutletContext>();
  const {
    settings: { features },
  } = useSettings();
  return (
    <MainFrame>
      <section className="block">
        <CharList
          characters={Object.values(characters)}
          showZhuyin={features?.showZhuyin}
        />
      </section>
    </MainFrame>
  );
}
