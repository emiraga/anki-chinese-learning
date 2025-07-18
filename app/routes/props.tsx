import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { PropList } from "~/components/PropList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Props" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Props() {
  const { props } = useOutletContext<OutletContext>();
  const [search, setSearch] = useState("");

  return (
    <main>
      <MainToolbar />
      <h3 className="font-serif text-4xl m-4">
        List of props: ({props.length})
        <input
          value={search}
          className="font-sans text-lg border dark:border-gray-600 ml-4 px-3 py-1 rounded dark:bg-gray-800"
          placeholder="Search..."
          onChange={(x) => {
            setSearch(x.currentTarget.value);
          }}
        />
      </h3>
      <section className="block">
        <PropList
          props={
            search.length > 0
              ? props.filter((x) => x.prop.includes(search))
              : props
          }
        />
      </section>
    </main>
  );
}
