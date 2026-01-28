import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { PropList } from "~/components/PropList";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useMemo, useState } from "react";
import type { PropType } from "~/data/props";
import type { CharactersType } from "~/data/characters";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Props" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

type SortOption = "none" | "subprops" | "characters";

function getSubpropCount(prop: { mainTagname: string; tagnames: string[] }) {
  return prop.tagnames.filter(
    (name) => name !== prop.mainTagname && name.startsWith("prop::")
  ).length;
}

function getCharacterCount(prop: PropType, characters: CharactersType) {
  return Object.values(characters).filter((c) =>
    c.tags.includes(prop.mainTagname)
  ).length;
}

export default function Props() {
  const { props, characters } = useOutletContext<OutletContext>();
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("none");

  const characterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const prop of props) {
      counts[prop.mainTagname] = getCharacterCount(prop, characters);
    }
    return counts;
  }, [props, characters]);

  const sortedProps = useMemo(() => {
    if (sortOption === "none") {
      return props;
    }
    return [...props].sort((a, b) => {
      if (sortOption === "subprops") {
        return getSubpropCount(b) - getSubpropCount(a);
      }
      return characterCounts[b.mainTagname] - characterCounts[a.mainTagname];
    });
  }, [props, characterCounts, sortOption]);

  const filteredProps =
    search.length > 0
      ? sortedProps.filter((x) => x.prop.includes(search))
      : sortedProps;

  return (
    <MainFrame>
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
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="font-sans text-lg border dark:border-gray-600 ml-4 px-3 py-1 rounded dark:bg-gray-800"
        >
          <option value="none">Default order</option>
          <option value="subprops">Sort by subprops</option>
          <option value="characters">Sort by characters</option>
        </select>
      </h3>
      <section className="block">
        <PropList props={filteredProps} characterCounts={characterCounts} />
      </section>
    </MainFrame>
  );
}
