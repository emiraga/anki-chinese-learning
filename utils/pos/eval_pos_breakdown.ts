/**
 * Evaluates the AI part of speech breakdown (app/apis/pos_breakdown.ts) on the
 * hand-annotated POS_SENTENCES, leaving each sentence out of the prompt's
 * examples while it is being tested.
 *
 * Also runs the example sentences of pos_details.json, which have no gold
 * breakdown: there it counts how many words got a code that the TOCFL list
 * gives that word.
 *
 * Usage: node_modules/.bin/vite-node utils/pos/eval_pos_breakdown.ts [model ...]
 * The API key is read from utils/tts/gcloud_api_key.txt or GEMINI_API_KEY.
 */
import { readFileSync, existsSync } from "node:fs";
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from "@google/generative-ai";
import {
  POS_BREAKDOWN_MODELS,
  InvalidPosBreakdownError,
  breakdownPos,
  loadTocflLexicon,
} from "~/apis/pos_breakdown";
import {
  POS_SENTENCES,
  type PosSentence,
  type PosToken,
} from "~/data/pos_sentences";
import { POS_DETAILS } from "~/data/pos_details";

const KEY_PATH = "utils/tts/gcloud_api_key.txt";

function apiKey(): string {
  if (existsSync(KEY_PATH)) {
    return readFileSync(KEY_PATH, "utf8").trim();
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(`No API key: create ${KEY_PATH} or set GEMINI_API_KEY`);
  }
  return key;
}

const show = (tokens: PosToken[]) =>
  tokens.map((t) => (t.pos ? `${t.zh}/${t.pos}` : t.zh)).join(" ");

type Score = {
  words: number;
  split: number;
  tagged: number;
  invalid: number;
  ms: number;
};

/**
 * Runs the breakdown, returning the error instead of throwing it: an invalid
 * reply is one of the outcomes being measured.
 */
async function tryBreakdown(
  model: GenerativeModel,
  text: string,
  examples: PosSentence[],
): Promise<PosSentence[] | Error> {
  try {
    return await breakdownPos(model, text, examples);
  } catch (e) {
    if (e instanceof InvalidPosBreakdownError) {
      return e;
    }
    throw e;
  }
}

async function evaluate(modelName: string): Promise<Score> {
  const model = new GoogleGenerativeAI(apiKey()).getGenerativeModel({
    model: modelName,
  });
  const score: Score = { words: 0, split: 0, tagged: 0, invalid: 0, ms: 0 };
  for (const gold of POS_SENTENCES) {
    const text = gold.tokens.map((t) => t.zh).join("");
    const examples = POS_SENTENCES.filter((s) => s !== gold);
    const start = Date.now();
    const sentences = await tryBreakdown(model, text, examples);
    score.ms += Date.now() - start;
    score.words += gold.tokens.filter((t) => t.pos).length;
    if (sentences instanceof Error) {
      score.invalid++;
      console.log(`  ${text}\n    INVALID: ${sentences.message}`);
      continue;
    }
    const tokens = sentences.flatMap((s) => s.tokens);

    // Match words by their character offset in the text
    const offsets = new Map<number, PosToken>();
    let offset = 0;
    for (const token of tokens) {
      offsets.set(offset, token);
      offset += token.zh.length;
    }
    offset = 0;
    const errors: string[] = [];
    for (const expected of gold.tokens) {
      const actual = offsets.get(offset);
      offset += expected.zh.length;
      if (!expected.pos) {
        continue;
      }
      if (actual?.zh !== expected.zh) {
        errors.push(`${expected.zh}: split differently`);
        continue;
      }
      score.split++;
      if (actual.pos === expected.pos) {
        score.tagged++;
      } else {
        errors.push(`${expected.zh}: ${actual.pos} instead of ${expected.pos}`);
      }
    }
    console.log(`  ${text}`);
    if (errors.length > 0) {
      console.log(`    expected: ${show(gold.tokens)}`);
      console.log(`    got:      ${show(tokens)}`);
      console.log(`    ${errors.join("; ")}`);
    }
    console.log(`    en: ${sentences.map((s) => s.en).join(" ")}`);
  }
  return score;
}

/**
 * The gold sentences were annotated with AI help too: report where they
 * disagree with the official TOCFL list, as those are worth checking first.
 */
async function checkGold(): Promise<void> {
  const lexicon = await loadTocflLexicon();
  for (const sentence of POS_SENTENCES) {
    for (const token of sentence.tokens) {
      const codes = lexicon[token.zh];
      if (token.pos && codes && !codes.includes(token.pos)) {
        console.log(
          `gold: ${token.zh} is ${token.pos}, TOCFL lists ${codes.join(", ")} (${sentence.en})`,
        );
      }
    }
  }
}

await checkGold();
/** Correct example sentences of pos_details.json, one per POS code. */
const DETAIL_SENTENCES = Object.values(POS_DETAILS).flatMap((detail) =>
  detail.examples
    .filter((e) => !e.wrong)
    .slice(0, 1)
    .map((e) => e.zh),
);

type TocflScore = {
  listed: number;
  agree: number;
  invalid: number;
  ms: number;
};

async function evaluateDetails(modelName: string): Promise<TocflScore> {
  const model = new GoogleGenerativeAI(apiKey()).getGenerativeModel({
    model: modelName,
  });
  const lexicon = await loadTocflLexicon();
  const score: TocflScore = { listed: 0, agree: 0, invalid: 0, ms: 0 };
  // Run in parallel: these are independent
  const results = await Promise.all(
    DETAIL_SENTENCES.map(async (text) => {
      const start = Date.now();
      const sentences = await tryBreakdown(model, text, POS_SENTENCES);
      return { text, sentences, ms: Date.now() - start };
    }),
  );
  for (const { text, sentences, ms } of results) {
    score.ms = Math.max(score.ms, ms);
    if (sentences instanceof Error) {
      score.invalid++;
      console.log(`  ${text}\n    INVALID: ${sentences.message}`);
      continue;
    }
    const tokens = sentences.flatMap((s) => s.tokens);
    const disagreements: string[] = [];
    for (const token of tokens) {
      const codes = lexicon[token.zh];
      if (!token.pos || !codes) {
        continue;
      }
      score.listed++;
      if (codes.includes(token.pos)) {
        score.agree++;
      } else {
        disagreements.push(
          `${token.zh}: ${token.pos}, TOCFL ${codes.join(", ")} (${token.note ?? "no note"})`,
        );
      }
    }
    console.log(`  ${show(tokens)}`);
    for (const d of disagreements) {
      console.log(`    ${d}`);
    }
  }
  return score;
}

const models =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : POS_BREAKDOWN_MODELS.map((m) => m.name);
const results: [string, Score][] = [];
const detailResults: [string, TocflScore][] = [];
for (const modelName of models) {
  console.log(`\n=== ${modelName}`);
  results.push([modelName, await evaluate(modelName)]);
  console.log(`\n=== ${modelName}, pos_details.json examples`);
  detailResults.push([modelName, await evaluateDetails(modelName)]);
}
console.log(
  "\nmodel: words split like the gold / tagged like the gold / invalid replies / time",
);
for (const [modelName, s] of results) {
  console.log(
    `${modelName}: ${s.split}/${s.words} / ${s.tagged}/${s.words} / ${s.invalid}/${POS_SENTENCES.length} / ${(s.ms / 1000).toFixed(0)}s`,
  );
}
console.log(
  "\nmodel: words with a TOCFL code / invalid replies / slowest sentence",
);
for (const [modelName, s] of detailResults) {
  console.log(
    `${modelName}: ${s.agree}/${s.listed} / ${s.invalid}/${DETAIL_SENTENCES.length} / ${(s.ms / 1000).toFixed(0)}s`,
  );
}
