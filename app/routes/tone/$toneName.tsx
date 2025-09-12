import MainFrame from "~/toolbar/frame";
import type { Route } from "../+types/index";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Tone: ${params.toneName}` },
    { name: "description", content: `Details for tone ${params.toneName}` },
  ];
}

export default function ToneDetail() {
  const { toneName } = useParams();
  const { characters } = useOutletContext<OutletContext>();

  const chars = Object.values(characters)
    .filter((c) => c.tags.includes("tone::" + toneName))
    .sort((a, b) => a.pinyin[0].sylable.localeCompare(b.pinyin[0].sylable));

  return (
    <MainFrame>
      <div className="mx-4">
        <h3 className="font-serif text-4xl">
          <Link to="/tones" className="text-blue-800">
            Tone
          </Link>
          : {toneName}
        </h3>
        <hr className="my-4" />
        <CharList characters={chars} />
        <hr className="my-4" />
        {chars.map((char, i) => {
          return <CharCardDetails key={i} char={char} />;
        })}
      </div>
    </MainFrame>
  );
}
