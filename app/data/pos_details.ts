import type { PosCode } from "./pos";
import posDetailsJSON from "./pos_details.json";
import posVerbKindsJSON from "./pos_verb_kinds.json";

/**
 * English explanations of the TOCFL part of speech codes (`pos.json`).
 *
 * The codes follow the classification of 鄧守信 (Teng Shou-hsin), used by the
 * TOCFL 8000 word list and "A Course in Contemporary Chinese". Verbs are split
 * by what kind of event they describe:
 * - action (V, Vi, V-sep): something someone does, can be in progress (在)
 * - state (Vs, Vst, ...): a lasting quality or feeling, takes degree (很)
 * - process (Vp, Vpt, Vp-sep): an instant change from one state to another
 *
 * The data lives in `pos_details.json` and `pos_verb_kinds.json`, so that the
 * Python scripts (`utils/hanzi/fill_props_field.py`) can give it to the AI
 * that assigns parts of speech.
 */

export type PosExample = {
  /** Traditional Chinese sentence or phrase. */
  zh: string;
  en: string;
  /** Marks an ungrammatical example: a typical learner mistake. */
  wrong?: PosMistake;
  /** Where the example comes from, e.g. "Teng 2009, p. 177". */
  source?: string;
};

export type PosMistake = {
  /** Which rule of this part of speech the sentence breaks. */
  why: string;
  /** Grammatical version of the intended sentence. */
  correct: string;
};

export type PosTest = {
  text: string;
  /** Where the test comes from, e.g. "Teng 2009, p. 110". */
  source?: string;
};

export type PosContrast = {
  pos: PosCode;
  note: string;
  /** Where the note comes from, e.g. "Teng 2009, p. 109". */
  source?: string;
};

export type PosDetail = {
  /** One sentence, shown in the tooltip. */
  summary: string;
  description: string;
  /** Grammatical behaviour that identifies the category. */
  tests: PosTest[];
  examples: PosExample[];
  /** How to tell this category apart from easily confused ones. */
  contrasts: PosContrast[];
};

/** How one kind of verb (action, state, process) behaves grammatically. */
export type VerbKind = {
  name: string;
  meaning: string;
  hen: string;
  le: string;
  zai: string;
  /** Durative 著. */
  zhe: string;
  reduplication: string;
  negation: string;
  transitive: PosCode;
  intransitive: PosCode[];
  separable: PosCode;
};

export const POS_DETAILS = posDetailsJSON as Record<PosCode, PosDetail>;

export const VERB_KINDS = posVerbKindsJSON as VerbKind[];
