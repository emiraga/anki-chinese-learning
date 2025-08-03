import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "../+types/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Place: ${params.placeName}` },
    { name: "description", content: `Details for place ${params.placeName}` },
  ];
}

export default function PlaceDetail() {
  const { placeName } = useParams();
  const { characters } = useOutletContext<OutletContext>();

  const chars = Object.values(characters)
    .filter((c) => c.tags.includes("place::" + placeName))
    .sort((a, b) => a.pinyin[0].sylable.localeCompare(b.pinyin[0].sylable));

  return (
    <main>
      <MainToolbar />
      <div className="mx-4">
        <h3 className="font-serif text-4xl">
          <Link to="/places" className="text-blue-800">
            Place
          </Link>
          : {placeName}
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
