import { Link } from "react-router";
import { ankiOpenBrowse } from "~/apis/anki";
import { isPosCode } from "~/data/pos";
import {
  PATTERN_SYMBOLS,
  parseBold,
  type GrammarExample,
  type GrammarPoint,
  type GrammarStudiedNote,
} from "~/data/tbcl_grammar";
import { POSDisplay } from "./POSDisplay";
import { HanziText } from "./HanziText";

/** Badge with the TBCL level, e.g. "2*". */
export const GrammarLevelBadge: React.FC<{ level: string }> = ({ level }) => (
  <span className="inline-block rounded bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-200">
    L{level}
  </span>
);

const SYMBOL_REGEX = /[A-Za-z][A-Za-z-]*\d*/g;

/**
 * A grammar pattern such as "S + 把 + O + V + 在 + PW". POS codes link to their
 * page, the other symbols explain themselves on hover.
 */
export const GrammarPattern: React.FC<{ pattern: string }> = ({ pattern }) => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of pattern.matchAll(SYMBOL_REGEX)) {
    const symbol = match[0];
    const base = symbol.replace(/\d+$/, "");
    const index = symbol.length > base.length ? symbol.slice(base.length) : "";
    parts.push(pattern.slice(last, match.index));
    if (isPosCode(base)) {
      parts.push(
        <span key={match.index}>
          <POSDisplay posKey={base} />
          {index && <sub>{index}</sub>}
        </span>,
      );
    } else if (PATTERN_SYMBOLS[base]) {
      parts.push(
        <abbr
          key={match.index}
          title={PATTERN_SYMBOLS[base]}
          className="cursor-help font-medium text-teal-700 dark:text-teal-400 no-underline"
        >
          {base}
          {index && <sub>{index}</sub>}
        </abbr>,
      );
    } else {
      parts.push(symbol);
    }
    last = match.index + symbol.length;
  }
  parts.push(pattern.slice(last));
  return <span className="font-mono text-sm">{parts}</span>;
};

/** Chinese example text with the grammar point (`**bold**`) highlighted. */
export const GrammarZh: React.FC<{ value: string }> = ({ value }) => (
  <>
    {parseBold(value).map((segment, i) =>
      segment.bold ? (
        <strong
          key={i}
          className="rounded bg-yellow-100 dark:bg-yellow-900/50 px-0.5"
        >
          <HanziText value={segment.text} />
        </strong>
      ) : (
        <HanziText key={i} value={segment.text} />
      ),
    )}
  </>
);

const GrammarExampleItem: React.FC<{ example: GrammarExample }> = ({
  example,
}) => (
  <li className="flex flex-col sm:flex-row sm:gap-3">
    <span className="text-lg">
      <GrammarZh value={example.zh} />
    </span>
    <span className="whitespace-pre-line text-gray-600 dark:text-gray-400 sm:pt-1">
      {example.en}
    </span>
  </li>
);

export const GrammarPointCard: React.FC<{ point: GrammarPoint }> = ({
  point,
}) => (
  <div className="rounded border border-gray-300 dark:border-gray-600 p-3">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <GrammarLevelBadge level={point.level} />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        #{point.number}
      </span>
      <span className="text-xl font-semibold">{point.name}</span>
      <span className="text-gray-700 dark:text-gray-300">{point.nameEn}</span>
      <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
        PDF p. {point.page}
      </span>
    </div>
    <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <GrammarPattern pattern={point.pattern} />
      {point.pos.length > 0 && (
        <span className="inline-flex gap-2 text-sm">
          {point.pos.map((code) => (
            <POSDisplay key={code} posKey={code} />
          ))}
        </span>
      )}
    </div>
    <p className="mt-1 text-gray-700 dark:text-gray-300">{point.explanation}</p>
    <ul className="mt-2 space-y-1">
      {point.examples.map((example, i) => (
        <GrammarExampleItem key={i} example={example} />
      ))}
    </ul>
    {point.studied && <GrammarStudiedList studied={point.studied} />}
    {point.missing && <GrammarMissingList missing={point.missing} />}
  </div>
);

const GrammarStudiedList: React.FC<{ studied: GrammarStudiedNote[] }> = ({
  studied,
}) => (
  <div className="mt-3 rounded bg-green-50 dark:bg-green-950/40 p-2">
    <div className="text-sm font-semibold text-green-800 dark:text-green-300">
      Studied ({studied.length})
    </div>
    <ul className="mt-1 space-y-1">
      {studied.map((note) => (
        <li
          key={note.noteId}
          className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3"
        >
          <span className="flex items-baseline gap-2">
            <Link
              to={`/phrase/${note.traditional}`}
              className="text-lg hover:underline"
            >
              <HanziText value={note.traditional} />
            </Link>
            <button
              type="button"
              className="rounded-xl bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`nid:${note.noteId}`);
              }}
            >
              anki
            </button>
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {note.justification}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

const GrammarMissingList: React.FC<{ missing: string[] }> = ({ missing }) => (
  <div className="mt-2 rounded bg-amber-50 dark:bg-amber-950/40 p-2">
    <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">
      Not yet covered
    </div>
    <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
      {missing.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
);

export const GrammarPointList: React.FC<{ points: GrammarPoint[] }> = ({
  points,
}) => (
  <div className="space-y-3">
    {points.map((point) => (
      <GrammarPointCard key={point.id} point={point} />
    ))}
  </div>
);
