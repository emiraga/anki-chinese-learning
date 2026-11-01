import { POS, type PosCode } from "./pos";
import {
  POS_DETAILS,
  VERB_KINDS,
  VERB_KIND_TRAITS,
  type PosDetail,
  type VerbKindTrait,
} from "./pos_details";

/**
 * Explanation of the TOCFL part of speech system given to an AI, built from
 * the same data the /pos pages show.
 *
 * Keep in sync with `build_pos_guide` in `utils/hanzi/fill_props_field.py`,
 * which gives the same guide to the Python scripts.
 */

const TRAIT_MARK: Record<NonNullable<VerbKindTrait["allowed"]>, string> = {
  yes: "✓",
  no: "✗",
  some: "",
};

function formatVerbKindTrait(trait: VerbKindTrait): string {
  const mark = trait.allowed ? TRAIT_MARK[trait.allowed] : "";
  return [mark, trait.label].filter(Boolean).join(" ");
}

function formatVerbKindsTable(): string {
  const header = [
    "Kind",
    ...VERB_KIND_TRAITS.map(({ title }) => title),
    "Transitive",
    "Intransitive",
    "Separable",
  ];
  const rows = VERB_KINDS.map((kind) => [
    `${kind.name} (${kind.meaning})`,
    ...VERB_KIND_TRAITS.map(({ key }) => formatVerbKindTrait(kind.traits[key])),
    kind.transitive,
    kind.intransitive.join(", "),
    kind.separable,
  ]);
  return [header, header.map(() => "---"), ...rows]
    .map((cells) => `| ${cells.join(" | ")} |`)
    .join("\n");
}

function formatPosCodeDetails(code: PosCode, detail: PosDetail): string {
  const [englishName, chineseName, typicalWords] = POS[code];
  const lines = [
    `### ${code}: ${englishName} ${chineseName}`.trimEnd(),
    detail.summary,
    detail.description,
  ];
  if (typicalWords) {
    lines.push(`Typical words: ${typicalWords}`);
  }
  lines.push("How to recognize it:");
  lines.push(...detail.tests.map((test) => `- ${test.text}`));
  lines.push("Examples:");
  for (const example of detail.examples) {
    lines.push(
      example.wrong
        ? `- INCORRECT: *${example.zh} ${example.en}. Why: ${example.wrong.why} Correct: ${example.wrong.correct}`
        : `- ${example.zh} (${example.en})`,
    );
  }
  lines.push("Don't confuse with:");
  lines.push(
    ...detail.contrasts.map(
      (contrast) => `- ${contrast.pos}: ${contrast.note}`,
    ),
  );
  return lines.join("\n");
}

/** Markdown guide to all POS codes. */
export function buildPosGuide(): string {
  const codes = Object.keys(POS) as PosCode[];
  const codeSections = codes
    .map((code) => {
      const detail = POS_DETAILS[code];
      if (!detail) {
        throw new Error(`POS code ${code} has no entry in pos_details.json`);
      }
      return formatPosCodeDetails(code, detail);
    })
    .join("\n\n");

  return `## The TOCFL part of speech system

The codes come from the TOCFL 8000 word list (華語八千詞表), which follows the classification of
鄧守信 (Teng Shou-hsin) used in "A Course in Contemporary Chinese". It differs from English grammar:
- There is NO adjective category. What English calls adjectives are state verbs (Vs and its variants).
- Numbers, pronouns, time words (昨天) and the question word 幾 are nouns (N).
- 把, aspect markers (了, 過, 著), resultative complements (完, 掉) and interjections are particles (Ptc).

Verbs are split by the kind of event they describe, and each kind by whether it takes an object:

${formatVerbKindsTable()}

A code without extra marking stands for the most common case:
- V is an action verb, and transitive.
- Vs and Vp are intransitive; a trailing "t" (Vst, Vpt) marks the transitive ones.
- Vs can both modify a noun and be the predicate. Vs-attr can only stand before a noun (主要道路, but
  not *這條路很主要), and Vs-pred can only be the predicate (時間夠, but not *夠時間).
- "-sep" verbs are intransitive verb+object compounds. They split to let in the target, frequency,
  duration or completion of the event: 生他的氣, 結過三次婚.

## All codes

${codeSections}`;
}
