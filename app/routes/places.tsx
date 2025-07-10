import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { Link } from "react-router";
import { PLACE_TAGS_MAP } from "~/data/pinyin_table";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Places" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Places() {
  return (
    <main>
      <MainToolbar />
      <h3 className="font-serif text-4xl m-4">
        List of places: ({Object.values(PLACE_TAGS_MAP).length})
      </h3>
      <section className="block m-4">
        {Object.values(PLACE_TAGS_MAP).map((placeName, i) => {
          return (
            <Link
              key={i}
              className="block"
              to={`/place/${placeName.substring(7)}`}
            >
              {placeName}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
