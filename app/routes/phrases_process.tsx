import MainFrame from "~/toolbar/frame";
import PhrasesProcess from "~/components/PhrasesProcess";
import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Process Phrases" },
    { name: "description", content: "Process phrases with AI analysis" },
  ];
}

export default function PhrasesProcessRoute() {
  return (
    <MainFrame>
      <section className="block mx-4">
        <PhrasesProcess />
      </section>
    </MainFrame>
  );
}
