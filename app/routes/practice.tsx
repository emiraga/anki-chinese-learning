import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import PracticeComponent from "../components/Practice";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Practice" },
    { name: "description", content: "Do it live!" },
  ];
}

export default function Practice() {
  const { phrases, characterList } = useOutletContext<OutletContext>();

  return (
    <main>
      <MainToolbar />
      <section className="block mx-4">
        <PracticeComponent phrases={phrases} characterList={characterList} />
      </section>
    </main>
  );
}
