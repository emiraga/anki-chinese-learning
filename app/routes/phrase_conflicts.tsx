import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { PhraseConflictSections } from "~/components/PhraseConflictSections";
import { getPhraseConflictsCount } from "~/data/integrity_checks";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Phrase Conflicts" },
    { name: "description", content: "Phrase integrity conflicts" },
  ];
}

export default function PhraseConflicts() {
  const { phrases } = useOutletContext<OutletContext>();
  const count = getPhraseConflictsCount(phrases);

  return (
    <MainFrame>
      <section className="block">
        <h2 className="font-serif text-4xl m-4">Phrase Conflicts ({count})</h2>
        <PhraseConflictSections />
      </section>
    </MainFrame>
  );
}
