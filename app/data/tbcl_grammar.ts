import { isPosCode, type PosCode } from "./pos";
import grammarJSON from "./tbcl_grammar_points.json";

/**
 * Grammar points of the Taiwan Benchmarks for the Chinese Language (TBCL,
 * 臺灣華語文能力基準語法點表). The data lives in `tbcl_grammar_points.json`:
 * `name` and `examples[].zh` are the original text of the PDF, the English
 * fields were added.
 */

export type GrammarExample = {
  /** Original sentence; `**bold**` marks the grammar point, as in the PDF. */
  zh: string;
  en: string;
};

export type GrammarPoint = {
  /** `<level>-<number>`, e.g. "2*-11". */
  id: string;
  level: string;
  number: number;
  /** Original name from the PDF, e.g. "V到2／在". */
  name: string;
  nameEn: string;
  /** Structure written with POS codes and the symbols of `PATTERN_SYMBOLS`. */
  pattern: string;
  pos: PosCode[];
  explanation: string;
  examples: GrammarExample[];
  /** Page in the PDF. */
  page: number;
};

export type GrammarLevel = {
  level: string;
  name: string;
  count: number;
};

type GrammarData = {
  source: {
    title: string;
    titleEn: string;
    file: string;
    version: string;
    notes: string[];
  };
  levels: GrammarLevel[];
  patternSymbols: Record<string, string>;
  grammarPoints: GrammarPoint[];
};

const DATA = grammarJSON as GrammarData;

for (const point of DATA.grammarPoints) {
  for (const code of point.pos) {
    if (!isPosCode(code)) {
      throw new Error(`Grammar point ${point.id} has unknown POS ${code}`);
    }
  }
}

export const GRAMMAR_SOURCE = DATA.source;
export const GRAMMAR_LEVELS = DATA.levels;
export const GRAMMAR_POINTS = DATA.grammarPoints;
/** Meaning of the non-POS symbols used in patterns (S, VP, PW…). */
export const PATTERN_SYMBOLS = DATA.patternSymbols;

export function grammarPointsWithPos(code: PosCode): GrammarPoint[] {
  return GRAMMAR_POINTS.filter((point) => point.pos.includes(code));
}

export type TextSegment = { text: string; bold: boolean };

/** Splits `**bold**` markup into plain and bold segments. */
export function parseBold(value: string): TextSegment[] {
  return value
    .split("**")
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}

function searchableText(point: GrammarPoint): string {
  return [
    point.id,
    point.name,
    point.nameEn,
    point.pattern,
    point.explanation,
    ...point.examples.flatMap((example) => [example.zh, example.en]),
  ]
    .join("\n")
    .replaceAll("**", "")
    .toLowerCase();
}

const SEARCHABLE = new Map(
  GRAMMAR_POINTS.map((point) => [point.id, searchableText(point)]),
);

/** Whether all space separated words of `query` occur in the grammar point. */
export function matchesGrammarQuery(
  point: GrammarPoint,
  query: string,
): boolean {
  const text = SEARCHABLE.get(point.id) ?? "";
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
