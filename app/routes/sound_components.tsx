import type { Route } from "./+types/sound_components";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import SoundComponents from "~/components/SoundComponents";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sound Components" },
    {
      name: "description",
      content: "Characters grouped by their sound components.",
    },
  ];
}

export default function SoundComponentsRoute() {
  const { characters } = useOutletContext<OutletContext>();

  return <SoundComponents characters={characters} />;
}
