import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { Link, useOutletContext } from "react-router";
import { LOCATION_TAGS_MAP } from "~/data/pinyin_table";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tones" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Tones() {
  return (
    <main>
      <MainToolbar />
      <h3 className="font-serif text-4xl m-4">
        List of tones: ({Object.values(LOCATION_TAGS_MAP).length})
      </h3>
      <section className="block m-4">
        {Object.values(LOCATION_TAGS_MAP).map((toneName) => {
          return (
            <Link className="block" to={`/tone/${toneName.substring(6)}`}>
              {toneName}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
