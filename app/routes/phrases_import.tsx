import MainFrame from "~/toolbar/frame";
import PhrasesImport from "~/components/PhrasesImport";
import type { Route } from "./+types/index";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Import Phrases" },
    { name: "description", content: "Import phrases into the application" },
  ];
}

export default function PhrasesImportRoute() {
  return (
    <MainFrame>
      <section className="block mx-4">
        <PhrasesImport />
      </section>
    </MainFrame>
  );
}
