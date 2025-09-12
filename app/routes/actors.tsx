import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { Link } from "react-router";
import { ACTOR_TAGS_MAP } from "~/data/pinyin_table";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Actors" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Actors() {
  return (
    <MainFrame>
      <h3 className="font-serif text-4xl m-4">
        List of actors: ({Object.values(ACTOR_TAGS_MAP).length})
      </h3>
      <section className="block mx-4">
        {Object.values(ACTOR_TAGS_MAP).map((actorName, i) => {
          return (
            <Link
              key={i}
              className="block"
              to={`/actor/${actorName.substring(7)}`}
            >
              {actorName}
            </Link>
          );
        })}
      </section>
    </MainFrame>
  );
}
