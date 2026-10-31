import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/grammar";
import { Link, useSearchParams } from "react-router";
import { POS, isPosCode, type PosCode } from "~/data/pos";
import {
  GRAMMAR_LEVELS,
  GRAMMAR_POINTS,
  GRAMMAR_SOURCE,
  matchesGrammarQuery,
} from "~/data/tbcl_grammar";
import { GrammarPointList } from "~/components/GrammarPoint";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Grammar points" },
    {
      name: "description",
      content: "Grammar points of the Taiwan Benchmarks for the Chinese Language",
    },
  ];
}

const ALL = "all";

/** POS codes that occur in some grammar point, in the order of pos.json. */
const USED_CODES = (Object.keys(POS) as PosCode[]).filter((code) =>
  GRAMMAR_POINTS.some((point) => point.pos.includes(code)),
);

const TAB = "rounded px-3 py-1 text-sm border";
const TAB_ACTIVE = "bg-blue-600 text-white border-blue-600";
const TAB_INACTIVE =
  "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800";

export default function Grammar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const posParam = searchParams.get("pos") ?? "";
  const pos = isPosCode(posParam) ? posParam : undefined;
  // Searching or filtering by POS looks through all levels unless one is chosen.
  const level =
    searchParams.get("level") ?? (query || pos ? ALL : GRAMMAR_LEVELS[0].level);

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (params) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
        return params;
      },
      { replace: true },
    );
  };

  const matching = GRAMMAR_POINTS.filter(
    (point) =>
      (!pos || point.pos.includes(pos)) &&
      (!query || matchesGrammarQuery(point, query)),
  );
  const shown =
    level === ALL ? matching : matching.filter((p) => p.level === level);
  const countAt = (lv: string) =>
    matching.filter((point) => point.level === lv).length;

  return (
    <MainFrame>
      <div className="mx-4 max-w-5xl">
        <h1 className="font-serif text-4xl my-4">Grammar points</h1>
        <p className="mb-2 text-gray-700 dark:text-gray-300">
          {GRAMMAR_SOURCE.title} ({GRAMMAR_SOURCE.titleEn}), version{" "}
          {GRAMMAR_SOURCE.version}. Names and Chinese examples are the original
          text; English names, patterns, explanations and translations were
          added. The highlighted words are printed in bold in the original.
        </p>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Patterns use the{" "}
          <Link to="/pos" className="text-blue-700 dark:text-blue-300">
            part of speech codes
          </Link>
          ; hover over the other symbols (S, VP, PW…) for their meaning. A
          number at the end of a name (在1, 在3) tells apart different uses of
          the same word.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => updateParam("q", e.target.value)}
            placeholder="Search 把, comparison, 'even if'…"
            className="flex-1 min-w-60 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5"
          />
          <label className="text-sm">
            POS{" "}
            <select
              value={pos ?? ""}
              onChange={(e) => updateParam("pos", e.target.value)}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5"
            >
              <option value="">any</option>
              {USED_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} ({POS[code][0]})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateParam("level", ALL)}
            className={`${TAB} ${level === ALL ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            All ({matching.length})
          </button>
          {GRAMMAR_LEVELS.map(({ level: lv, name }) => (
            <button
              key={lv}
              type="button"
              title={name}
              onClick={() => updateParam("level", lv)}
              className={`${TAB} ${level === lv ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              Level {lv} ({countAt(lv)})
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No grammar points match.
          </p>
        ) : (
          <GrammarPointList points={shown} />
        )}
      </div>
    </MainFrame>
  );
}
