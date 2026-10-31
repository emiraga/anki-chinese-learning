import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/grammar";
import { Link, useSearchParams } from "react-router";
import { POS, isPosCode, type PosCode } from "~/data/pos";
import {
  GRAMMAR_LEVELS,
  GRAMMAR_POINTS,
  GRAMMAR_SOURCE,
  matchesGrammarQuery,
  type GrammarPoint,
} from "~/data/tbcl_grammar";
import { GrammarPointList } from "~/components/GrammarPoint";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Grammar points" },
    {
      name: "description",
      content:
        "Grammar points of the Taiwan Benchmarks for the Chinese Language",
    },
  ];
}

const ALL = "all";

/** POS codes that occur in some grammar point, in the order of pos.json. */
const USED_CODES = (Object.keys(POS) as PosCode[]).filter((code) =>
  GRAMMAR_POINTS.some((point) => point.pos.includes(code)),
);

const COVERAGE = {
  studied: "studied",
  partial: "partly studied",
  complete: "fully studied",
  unstudied: "not studied",
} as const;
type Coverage = keyof typeof COVERAGE;

function isCoverage(value: string): value is Coverage {
  return value in COVERAGE;
}

function hasCoverage(point: GrammarPoint, coverage: Coverage): boolean {
  switch (coverage) {
    case "studied":
      return point.studied !== undefined;
    case "partial":
      return point.missing !== undefined;
    case "complete":
      return point.studied !== undefined && point.missing === undefined;
    case "unstudied":
      return point.studied === undefined;
  }
}

const TAB = "rounded px-3 py-1 text-sm border";
const TAB_ACTIVE = "bg-blue-600 text-white border-blue-600";
const TAB_INACTIVE =
  "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800";

export default function Grammar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const posParam = searchParams.get("pos") ?? "";
  const pos = isPosCode(posParam) ? posParam : undefined;
  const coverageParam = searchParams.get("coverage") ?? "";
  const coverage = isCoverage(coverageParam) ? coverageParam : undefined;
  const level = searchParams.get("level") ?? ALL;

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

  // Every filter except coverage, so the coverage links count all categories.
  const inScope = GRAMMAR_POINTS.filter(
    (point) =>
      (level === ALL || point.level === level) &&
      (!pos || point.pos.includes(pos)) &&
      (!query || matchesGrammarQuery(point, query)),
  );
  const shown = coverage
    ? inScope.filter((point) => hasCoverage(point, coverage))
    : inScope;

  /** Link to the current filters with coverage set to `key` (none: cleared). */
  const coverageLink = (key: Coverage | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (key) {
      params.set("coverage", key);
    } else {
      params.delete("coverage");
    }
    return `?${params.toString()}`;
  };
  const coverageStats: {
    key: Coverage | undefined;
    label: string;
    count: number;
  }[] = [
    { key: undefined, label: "total", count: inScope.length },
    ...(["unstudied", "studied", "complete", "partial"] as const).map(
      (key) => ({
        key,
        label: COVERAGE[key],
        count: inScope.filter((point) => hasCoverage(point, key)).length,
      }),
    ),
  ];

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
          <label className="text-sm">
            Coverage{" "}
            <select
              value={coverage ?? ""}
              onChange={(e) => updateParam("coverage", e.target.value)}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5"
            >
              <option value="">any</option>
              {(Object.keys(COVERAGE) as Coverage[]).map((key) => (
                <option key={key} value={key}>
                  {COVERAGE[key]}
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
            All
          </button>
          {GRAMMAR_LEVELS.map(({ level: lv, name }) => (
            <button
              key={lv}
              type="button"
              title={name}
              onClick={() => updateParam("level", lv)}
              className={`${TAB} ${level === lv ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              Level {lv}
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          {coverageStats.map(({ key, label, count }, i) => (
            <span key={label}>
              {i > 0 && ", "}
              <Link
                to={coverageLink(key)}
                replace
                className={
                  coverage === key
                    ? "font-semibold text-blue-700 dark:text-blue-300"
                    : "text-blue-700 dark:text-blue-300 hover:underline"
                }
              >
                {count} {label}
              </Link>
            </span>
          ))}
        </p>

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
