import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import GenerateAudio from "../components/GenerateAudio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "test1" }, { name: "description", content: "Do it live!" }];
}

export default function Test1() {
  const { phrases, characterList } = useOutletContext<OutletContext>();

  return (
    <main>
      <MainToolbar />
      <section className="block m-4">
        <GenerateAudio />
      </section>
    </main>
  );
}
