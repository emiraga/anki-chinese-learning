import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { CharListConflicts, getConflictingChars } from "~/components/CharList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Conflicts" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Conflicts() {
  const { knownProps, characters, charPhrasesPinyin } =
    useOutletContext<OutletContext>();

  let conflicting = getConflictingChars(
    knownProps,
    characters,
    charPhrasesPinyin
  );

  return (
    <main>
      <MainToolbar />
      <section className="block">
        <CharListConflicts
          knownProps={knownProps}
          conflicting={conflicting}
          charPhrasesPinyin={charPhrasesPinyin}
        />
      </section>
    </main>
  );
}
