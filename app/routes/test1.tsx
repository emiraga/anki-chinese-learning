import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import GenerateAudio from "../components/GenerateAudio";

export function meta({}: Route.MetaArgs) {
  return [{ title: "test1" }, { name: "description", content: "Do it live!" }];
}

export default function Test1() {
  return (
    <main>
      <MainToolbar />
      <section className="block m-4">
        <GenerateAudio />
      </section>
    </main>
  );
}
