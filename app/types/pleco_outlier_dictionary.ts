// Type definitions for the Pleco Outlier (traditional) dictionary entries in
// public/data/pleco/tc_dictionary_entries_json, written by convert_to_json.py
// of pleco-reverse-engineering2.

/** A node of rich text. */
export type RichNode =
  | { type: "text"; text: string }
  | { type: "pinyin"; text: string }
  /** Image public/data/pleco/tc_pngs/<id>.png */
  | { type: "glyph"; id: number }
  /** Page public/data/pleco/tc_pages_html/<page>.html */
  | { type: "link"; page: number; text: string }
  /** A character in another dictionary */
  | {
      type: "xref";
      character: string | null;
      characterGlyph: number | null;
      pinyin: string | null;
      dictionary: string | null;
      entryId: string | null;
      /** Entry of this dictionary for the same character, if any */
      entry: number | null;
      display: RichText;
    }
  /** An ancient form shown in the text, e.g. a diagram */
  | { type: "ancientForm"; content: RichText }
  | { type: "lineBreak" }
  | { type: "paragraphBreak" };

export type RichText = RichNode[];

export interface PlecoAncientForm {
  label: string;
  content: RichText;
}

export interface PlecoForm {
  ancientForms: PlecoAncientForm[];
  text: RichText;
}

export interface PlecoComponent {
  character: string | null;
  /** Image of a component without a Unicode character */
  glyph: number | null;
  name: RichText;
  systemPage: number | null;
  text: RichText;
}

export type PlecoMeaningMarker = "→" | "⇒" | "⇛" | "⭆" | "○";

/**
 * A meaning with depth d derives from the closest meaning before it (also in
 * an earlier reading of the block) with a smaller depth; "○" starts a new,
 * unrelated meaning.
 */
export interface PlecoMeaning {
  number: string | null;
  marker: PlecoMeaningMarker | null;
  depth: number;
  /** Labels such as "orig." (without parentheses) */
  tags: RichText;
  text: RichText;
}

export interface PlecoNoteItem {
  number: string | null;
  text: RichText;
}

export interface PlecoNote {
  text: RichText;
  items: PlecoNoteItem[];
}

export interface PlecoReading {
  pronunciation: RichText;
  pinyin: string[];
  meanings: PlecoMeaning[];
  notes: PlecoNote[];
}

/** A meaning block such as "Character meanings" or "Component meanings". */
export interface PlecoMeaningBlock {
  label: RichNode[] | null;
  readings: PlecoReading[];
}

export interface PlecoStrokes {
  count: number;
  /**
   * Glyph ids; a row usually starts with an image of a component and its
   * stroke count such as "氵 (3)", followed by one image per stroke.
   */
  rows: number[][];
}

export interface PlecoOutlierEntry {
  id: number;
  headword: string | null;
  form: PlecoForm | null;
  components: PlecoComponent[];
  componentsHelpPage: number | null;
  meanings: PlecoMeaningBlock[];
  meaningsHelpPage: number | null;
  strokes: PlecoStrokes | null;
  expertPage: number | null;
  componentPage: number | null;
  sponsor: RichText | null;
}

/** Summary of an entry in index.json */
export interface PlecoOutlierIndexEntry {
  id: number;
  headword: string | null;
  pinyin: string[];
  gloss: string | null;
}

export interface PlecoOutlierIndex {
  entries: PlecoOutlierIndexEntry[];
}
