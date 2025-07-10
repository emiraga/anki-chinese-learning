import type { Route } from "./+types/index";
import { Link, useOutletContext } from "react-router";
import { MigrationEverything } from "~/components/Migration";
import type { OutletContext } from "~/data/types";
import MainFrame from "~/toolbar/frame";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Stats" },
    { name: "description", content: "Detailed statistics!" },
  ];
}

export default function Stats() {
  const { props, phrases, characters } = useOutletContext<OutletContext>();

  let charsComplete = Object.values(characters).filter(
    (c) => c.withSound && c.withMeaning
  );
  let charsWithoutSound = Object.values(characters).filter((c) => !c.withSound);
  let charsWithoutMeaning = Object.values(characters).filter(
    (c) => !c.withMeaning
  );
  const uniquePhrases = new Set(phrases.map((phrase) => phrase.traditional));
  return (
    <MainFrame>
      <h3 className="font-serif text-4xl my-2">
        <Link to="/migration" className="text-2xl underline text-blue-700">
          Migration
        </Link>
        :
      </h3>
      <MigrationEverything />

      <h3 className="font-serif text-4xl my-2">
        List of props: ({props.length})
      </h3>
      <section className="block">
        {props.map((p, i) => (
          <span key={i}>{p.hanzi.startsWith("<img") ? "?" : p.hanzi}</span>
        ))}
      </section>

      <h3 className="font-serif text-4xl my-2">
        List of characters without sound: ({charsWithoutSound.length})
      </h3>
      <section className="block">
        {charsWithoutSound.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </section>

      <h3 className="font-serif text-4xl my-2">
        List of characters without meaning: ({charsWithoutMeaning.length})
      </h3>
      <section className="block">
        {charsWithoutMeaning.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </section>

      <h3 className="font-serif text-4xl my-2">
        List of characters: ({charsComplete.length})
      </h3>
      <section className="block">
        {charsComplete.map((p, i) => (
          <span key={i}>{p.traditional}</span>
        ))}
      </section>

      <h3 className="font-serif text-4xl my-2">
        List of phrases: ({uniquePhrases.size})
      </h3>
      <section className="block">
        {[...uniquePhrases].map((p, i) => (
          <span key={i}>{p}。</span>
        ))}
      </section>

      {/* <section className="block">
        <AnkiHanziProgress />
      </section>

      <section className="block">
        <HtmlStats />
      </section> */}
    </MainFrame>
  );
}
