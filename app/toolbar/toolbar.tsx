import * as React from "react";

import { useLocation, NavLink, useOutletContext, Link } from "react-router";
import { getConflictingChars } from "~/components/CharList";
import type { CharactersType } from "~/data/characters";
import type { KnownPropsType } from "~/data/props";
import type { OutletContext } from "~/data/types";

export const MainToolbarNoOutlet: React.FC<{
  knownProps: KnownPropsType;
  characters: CharactersType;
  reload: () => void;
  loading: boolean;
}> = ({ knownProps, characters, reload, loading }) => {
  let styleSelected =
    "block mx-1 py-2 px-3 text-white bg-blue-700 rounded-sm md:bg-transparent md:text-blue-700 md:p-0 dark:text-white md:dark:text-blue-500";
  let styleInactive =
    "block mx-1 py-2 px-3 text-gray-900 rounded-sm hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-500 md:p-0 dark:text-white md:dark:hover:text-blue-400 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent";
  let location = useLocation();

  var list = [
    { pathname: "/", name: "Pinyin" },
    {
      pathname: "/props",
      name: "Props",
      show: Object.keys(knownProps).length > 0,
    },
    {
      pathname: "/todo_chars",
      name: "Characters",
      show: Object.keys(characters).length > 0,
    },
    { pathname: "/phrases", name: "Phrases" },
    { pathname: "/study", name: "Study" },
    { pathname: "/practice", name: "Practice" },
    { pathname: "/stats", name: "Stats" },
    {
      pathname: "/conflicts",
      name: "Conflicts",
      show: getConflictingChars(knownProps, characters).length > 0,
    },
    { pathname: "/settings", name: "Settings" },
  ].filter((element) => element.show !== false);

  return (
    <nav className="bg-white border-gray-200 dark:bg-gray-900">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">
          <Link to="/">Learning Chinese</Link>
          <button
            className="text-blue-500 bg-blue-900 px-3 py-1 rounded-lg mx-3 text-sm w-22"
            onClick={reload}
            disabled={loading}
          >
            {loading ? "loading..." : "🗘 reload"}
          </button>
        </span>
        <div className="w-full md:block md:w-auto">
          <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0 md:bg-white dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
            {list.map((item, i) => {
              return (
                <li key={i} className="flex">
                  <NavLink
                    to={item.pathname}
                    className={
                      item.pathname === location.pathname
                        ? styleSelected
                        : styleInactive
                    }
                  >
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
};

const MainToolbar: React.FC<{}> = ({}) => {
  const { knownProps, characters, reload, loading } =
    useOutletContext<OutletContext>();
  return (
    <MainToolbarNoOutlet
      knownProps={knownProps}
      characters={characters}
      reload={reload}
      loading={loading}
    />
  );
};
export default MainToolbar;
