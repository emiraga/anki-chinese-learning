import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/story";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import Story from "~/components/Story";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Story" },
    { name: "description", content: "Chinese Story Reader" },
  ];
}

export default function StoryRoute() {
  const { phrases, characterList } = useOutletContext<OutletContext>();

  return (
    <MainFrame>
      <section className="block mx-4">
        <Story phrases={phrases} characterList={characterList} />
      </section>
    </MainFrame>
  );
}
