import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "../+types/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Actor: ${params.actorName}` },
    { name: "description", content: `Details for actor ${params.actorName}` },
  ];
}

export default function ActorDetail() {
  const { actorName } = useParams();
  const { characters } = useOutletContext<OutletContext>();

  const chars = Object.values(characters)
    .filter((c) => c.tags.includes("actor::" + actorName))
    .sort((a, b) => a.sylable.localeCompare(b.sylable));

  return (
    <main>
      <MainToolbar />
      <div className="mx-4">
        <h3 className="font-serif text-4xl">
          <Link to="/actors" className="text-blue-800">
            Actor
          </Link>
          : {actorName}
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
