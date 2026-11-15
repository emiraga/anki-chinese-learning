import type { PosCode } from "./pos";
import posSentencesJSON from "./pos_sentences.json";

/**
 * Example sentences split into words, each word tagged with its TOCFL part of
 * speech code. The codes were checked against the TOCFL 8000 word list
 * (`data/tocfl/`).
 *
 * The sentences live in `pos_sentences.json` so that the Python scripts (e.g.
 * `utils/hanzi/connect_dots_notes.py`) can read them too.
 */

export type PosToken = {
  zh: string;
  /** Absent for punctuation. */
  pos?: PosCode;
  /** Short English meaning of the word in this sentence. */
  gloss?: string;
  /** What this word does in the sentence, shown in the tooltip. */
  note?: string;
};

/**
 * A POS that a student might wrongly pick for a word of the sentence. Its code
 * never occurs in the sentence, so it can be offered as a decoy answer.
 */
export type PosConfusion = {
  /** The word (one of the sentence's tokens) the wrong POS is tempting for. */
  zh: string;
  /** The tempting but wrong POS code. */
  pos: PosCode;
  /** Why it looks right, and why it is wrong. */
  note: string;
};

export type PosSentence = {
  tokens: PosToken[];
  en: string;
  /** What the sentence shows about parts of speech. */
  note: string;
  /** A short list of misleading POS codes; absent for generated sentences. */
  confusions?: PosConfusion[];
};

export const POS_SENTENCES = posSentencesJSON as PosSentence[];
