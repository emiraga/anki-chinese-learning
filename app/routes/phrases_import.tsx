import MainToolbar from "~/toolbar/toolbar";
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
    <main>
      <MainToolbar />
      <h3 className="font-serif text-4xl m-4 text-gray-900 dark:text-gray-100">
        Import Phrases
      </h3>
      <section className="block mx-4">
        <PhrasesImport />
      </section>
    </main>
  );
}