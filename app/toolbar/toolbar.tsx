import * as React from "react";

import { useLocation, NavLink, useOutletContext, Link } from "react-router";
import { getConflictingChars } from "~/components/CharList";
import type { CharactersType } from "~/data/characters";
import type { CharsToPhrasesPinyin, PhraseType } from "~/data/phrases";
import type { KnownPropsType } from "~/data/props";
import type { InvalidDataRecord, OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";
import { DarkModeToggle } from "~/components/DarkModeToggle";

export const MainToolbarNoOutlet: React.FC<{
  knownProps: KnownPropsType;
  characters: CharactersType;
  phrases: PhraseType[];
  charPhrasesPinyin: CharsToPhrasesPinyin;
  invalidData: InvalidDataRecord[];
  reload: () => void;
  loading: boolean;
}> = ({
  knownProps,
  characters,
  phrases,
  reload,
  loading,
  charPhrasesPinyin,
  invalidData,
}) => {
  let styleSelected =
    "block mx-1 py-2 px-3 text-white bg-blue-700 rounded-sm md:bg-transparent md:text-blue-700 md:p-0 dark:text-white md:dark:text-blue-500";
  let styleInactive =
    "block mx-1 py-2 px-3 text-gray-900 rounded-sm hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-500 md:p-0 dark:text-white md:dark:hover:text-blue-400 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent";
  let location = useLocation();
  let { settings } = useSettings();

  var list = [
    { pathname: "/pinyin", name: "Pinyin", show: phrases.length > 0 },
    {
      pathname: "/props",
      name: "Props",
      show: settings.toolbar?.showPropsLink,
    },
    {
      pathname: "/todo_chars",
      name: "Characters",
      show: Object.keys(characters).length > 0,
    },
    {
      pathname: "/conflicts",
      name: "Conflicts",
      show:
        getConflictingChars(knownProps, characters, charPhrasesPinyin).length >
        0,
    },
    { pathname: "/phrases", name: "Phrases", show: phrases.length > 0 },
    { pathname: "/study", name: "Study", show: phrases.length > 0 },
    { pathname: "/practice", name: "Practice", show: phrases.length > 0 },
    {
      pathname: "/stats",
      name: "Stats",
      show: settings.toolbar?.showStatsLink && phrases.length > 0,
    },
    { pathname: "/settings", name: "Settings", show: true },
  ].filter((element) => !!element.show);

  return (
    <nav className="bg-gray-100 border-gray-200 dark:bg-gray-900">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">
          <Link to="/">Learning Chinese</Link>
          <button
            className="text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed px-3 py-1 rounded-lg mx-3 text-sm w-22 transition-colors dark:text-blue-500 dark:bg-blue-900"
            onClick={reload}
            disabled={loading}
          >
            {loading ? "loading..." : "🗘 reload"}
          </button>
        </span>
        <span className="self-center whitespace-nowrap mr-auto">
          <DarkModeToggle />
          {invalidData.length > 0 && (
            <NavLink
              to="/invalid_data"
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-600 font-bold"
            >
              ({invalidData.length})
            </NavLink>
          )}
        </span>
        <div className="w-full md:block md:w-auto">
          <ul className="font-medium flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:border-0  dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
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
  const {
    knownProps,
    characters,
    phrases,
    charPhrasesPinyin,
    invalidData,
    reload,
    loading,
  } = useOutletContext<OutletContext>();
  return (
    <MainToolbarNoOutlet
      knownProps={knownProps}
      characters={characters}
      phrases={phrases}
      charPhrasesPinyin={charPhrasesPinyin}
      invalidData={invalidData}
      reload={reload}
      loading={loading}
    />
  );
};
export default MainToolbar;
