import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "../+types/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Sylable: ${params.sylable}` },
    { name: "description", content: `Details for place ${params.sylable}` },
  ];
}

export default function SylableDetail() {
  const { sylable } = useParams();
  const { characters } = useOutletContext<OutletContext>();
  const sylables = sylable?.split(",") ?? [];

  const chars = Object.values(characters)
    .filter((c) => sylables.includes(c.sylable))
    .sort((a, b) => a.sylable.localeCompare(b.sylable));

  return (
    <main>
      <MainToolbar />
      <div className="m-4">
        <h3 className="font-serif text-4xl">
          <Link to="/" className="text-blue-800">
            Sylable
          </Link>
          : {sylable}
        </h3>
        <hr className="my-4" />
        <CharList characters={chars} />
        <hr className="my-4" />
        {chars.map((char, i) => {
          return <CharCardDetails key={i} char={char} />;
        })}
      </div>
    </main>
  );
}
