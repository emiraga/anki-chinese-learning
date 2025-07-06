import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { CharList } from "~/components/CharList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "All characters listed in a grid." },
  ];
}

export default function Chars() {
  const { characters } = useOutletContext<OutletContext>();
  return (
    <main>
      <MainToolbar />
      <section className="block">
        <CharList characters={Object.values(characters)} />
      </section>
    </main>
  );
}
