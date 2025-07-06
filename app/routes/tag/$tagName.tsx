import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "../+types/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { PropCard } from "~/components/PropCard";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";
import { PhraseList } from "~/components/Phrase";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Tag: ${params.tagName}` },
    { name: "description", content: `Details for tag ${params.tagName}` },
  ];
}

export default function PropDetail() {
  const { tagName } = useParams();
  const { characters, phrases } = useOutletContext<OutletContext>();

  if (!tagName) {
    throw new Error("Missing tagName");
  }

  return (
    <main>
      <MainToolbar />
      <div className="m-4">
        <h3 className="font-serif text-4xl">
          <Link to="/tags" className="text-blue-800">
            Tag
          </Link>
          : {tagName}
        </h3>
        <PhraseList phrases={phrases.filter((p) => p.tags.includes(tagName))} />
        <hr />
        {Object.values(characters)
          .filter((char) => char.tags.includes(tagName))
          .map((char) => (
            <CharCardDetails key={char.ankiId} char={char} />
          ))}
      </div>
    </main>
  );
}
