import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { MorePhrases } from "~/components/MorePhrases";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "More Phrases" },
    { name: "description", content: "Discover more phrases" },
  ];
}

export default function MorePhrasesRoute() {
  return (
    <MainFrame>
      <section className="block mx-4">
        <MorePhrases />
      </section>
    </MainFrame>
  );
}
