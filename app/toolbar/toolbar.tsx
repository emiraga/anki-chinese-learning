import * as React from "react";
import { useState } from "react";
import { useLocation, NavLink, useOutletContext, Link } from "react-router";
import type { CharactersType } from "~/data/characters";
import type { CharsToPhrasesPinyin, PhraseType } from "~/data/phrases";
import type { KnownPropsType } from "~/data/props";
import type { InvalidDataRecord, OutletContext } from "~/data/types";
import { useSettings } from "~/settings/SettingsContext";
import { DarkModeToggle } from "~/components/DarkModeToggle";
import {
  getConflictingChars,
  getMissingPhraseChars,
} from "~/data/char_conflicts";

type MenuItem = {
  pathname: string;
  name: string;
  show: boolean;
  isDropdown?: boolean;
  submenu?: MenuItem[];
  counter?: number;
};

const Counter: React.FC<{ count: number; show?: boolean }> = ({
  count,
  show = true,
}) => {
  if (!show || count === 0) return null;
  return (
    <span className="ml-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
      {count}
    </span>
  );
};

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
  const [openDropdownPath, setOpenDropdownPath] = useState<string | null>(null);

  let styleSelected =
    "block mx-1 py-2 px-3 text-white bg-blue-700 rounded-sm md:bg-transparent md:text-blue-700 md:p-0 dark:text-white md:dark:text-blue-500";
  let styleInactive =
    "block mx-1 py-2 px-3 text-gray-900 rounded-sm hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-500 md:p-0 dark:text-white md:dark:hover:text-blue-400 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent";
  let location = useLocation();
  let { settings } = useSettings();

  const conflictingChars = getConflictingChars(
    knownProps,
    characters,
    charPhrasesPinyin
  ).length;
  const missingChars = getMissingPhraseChars(phrases, characters);

  var list: MenuItem[] = [
    { pathname: "/pinyin", name: "Pinyin", show: phrases.length > 0 },
    {
      pathname: "/props",
      name: "Props",
      show: !!settings.toolbar?.showPropsLink,
    },
    {
      pathname: "/chars_sentence_input",
      name: "Characters",
      show: Object.keys(characters).length > 0,
      isDropdown: true,
      submenu: [
        {
          pathname: "/chars_sentence_input",
          name: "Sentence input",
          show: true,
        },
        {
          pathname: "/todo_chars",
          name: "Todo Chars",
          show:
            Object.values(characters).filter((c) => c.todoMoreWork).length +
              missingChars.length >
            0,
          counter:
            Object.values(characters).filter((c) => c.todoMoreWork).length +
            missingChars.length,
        },
        {
          pathname: "/conflicts",
          name: "Conflicts",
          show: conflictingChars > 0,
          counter: conflictingChars,
        },
        {
          pathname: "/props",
          name: "All Props",
          show: Object.keys(knownProps).length > 0,
        },
        { pathname: "/chars", name: "All Chars", show: true },
        {
          pathname: "/chars_multiple_pronunciation",
          name: "Heteronyms",
          show: true,
        },
      ],
    },
    { pathname: "/phrases", name: "Phrases", show: phrases.length > 0 },
    { pathname: "/study", name: "Study", show: phrases.length > 0 },
    { pathname: "/practice", name: "Practice", show: phrases.length > 0 },
    {
      pathname: "/stats",
      name: "Stats",
      show: !!settings.toolbar?.showStatsLink && phrases.length > 0,
    },
    {
      pathname: "/settings",
      name: "Settings",
      show: true,
      isDropdown: true,
      submenu: [
        {
          pathname: "/settings",
          name: "Settings",
          show: true,
        },
        {
          pathname: "/stats",
          name: "Stats",
          show: phrases.length > 0,
        },
        {
          pathname: "/integrity",
          name: "Integrity",
          show: phrases.length > 0,
        },
        {
          pathname: "/stats_progress",
          name: "Progress",
          show: phrases.length > 0,
        },
      ],
    },
  ].filter((element) => !!element.show);

  // Helper function to check if any menu item is active
  const isMenuItemActive = (item: MenuItem): boolean => {
    // Check if main item is active
    if (
      location.pathname === item.pathname ||
      location.pathname.startsWith(item.pathname + "/")
    ) {
      return true;
    }

    // Check if any submenu item is active (for dropdown items)
    if (item.isDropdown && item.submenu) {
      return item.submenu
        .filter((submenuItem) => submenuItem.show)
        .some(
          (submenuItem) =>
            location.pathname === submenuItem.pathname ||
            location.pathname.startsWith(submenuItem.pathname + "/")
        );
    }

    return false;
  };

  // Add aggregated counters to dropdown items
  const listWithCounters = list.map((item) => {
    if (item.isDropdown && item.submenu) {
      const totalCount = item.submenu
        .filter((submenuItem) => submenuItem.show)
        .reduce((sum, submenuItem) => sum + (submenuItem.counter || 0), 0);
      return {
        ...item,
        counter: totalCount > 0 ? totalCount : undefined,
      };
    }
    return item;
  });

  // Determine the active submenu for the subtoolbar
  const activeDropdownItem = listWithCounters.find((item) =>
    isMenuItemActive(item)
  );
  const activeSubmenu =
    activeDropdownItem?.submenu?.filter((item) => item.show) || [];

  const SubToolbar = ({ submenu }: { submenu: MenuItem[] }) => {
    if (!submenu.length) return null;

    return (
      <div className="bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-screen-xl mx-auto px-4">
          <ul className="flex space-x-4 py-2">
            {submenu.map((item, i) => (
              <li key={i}>
                <NavLink
                  to={item.pathname}
                  className={({ isActive }) =>
                    isActive
                      ? "text-blue-600 bg-blue-50 px-3 py-1 rounded text-sm font-medium dark:text-blue-400 dark:bg-blue-900"
                      : "text-gray-600 hover:text-blue-600 px-3 py-1 rounded text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                  }
                >
                  {item.name}
                  <Counter count={item.counter || 0} />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <nav className="bg-gray-200 border-gray-200 dark:bg-gray-900">
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
            {listWithCounters.map((item, i) => {
              if (item.isDropdown) {
                return (
                  <li
                    key={i}
                    className="relative"
                    onMouseEnter={() => setOpenDropdownPath(item.pathname)}
                    onMouseLeave={() => setOpenDropdownPath(null)}
                  >
                    <Link
                      to={item.pathname}
                      id="dropdownNavbarLink"
                      data-dropdown-toggle="dropdownNavbar"
                      className={`flex items-center justify-between w-full py-2 px-3 text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent md:border-0 md:hover:text-blue-700 md:p-0 md:w-auto dark:text-white md:dark:hover:text-blue-500 dark:focus:text-white dark:hover:bg-gray-700 md:dark:hover:bg-transparent ${
                        isMenuItemActive(item) ? styleSelected : styleInactive
                      }`}
                    >
                      {item.name}
                      <Counter count={item.counter || 0} />
                      <svg
                        className="w-2.5 h-2.5 ms-2.5"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 10 6"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m1 1 4 4 4-4"
                        />
                      </svg>
                    </Link>
                    {openDropdownPath === item.pathname && (
                      <div
                        id="dropdownNavbar"
                        className="z-10 font-normal bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700 dark:divide-gray-600 absolute right-0 mt-0"
                      >
                        <ul
                          className="p-2 text-sm text-gray-700 dark:text-gray-400"
                          aria-labelledby="dropdownLargeButton"
                        >
                          {item.submenu
                            ?.filter((submenuItem) => submenuItem.show)
                            .map((submenuItem, j) => (
                              <li key={j}>
                                <NavLink
                                  to={submenuItem.pathname}
                                  className={`${styleInactive} block px-4 py-2`}
                                >
                                  {submenuItem.name}
                                  <Counter count={submenuItem.counter || 0} />
                                </NavLink>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              } else {
                return (
                  <li key={i} className="flex">
                    <NavLink
                      to={item.pathname}
                      className={
                        isMenuItemActive(item) ? styleSelected : styleInactive
                      }
                    >
                      {item.name}
                    </NavLink>
                  </li>
                );
              }
            })}
          </ul>
        </div>
      </div>
      <SubToolbar submenu={activeSubmenu} />
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
