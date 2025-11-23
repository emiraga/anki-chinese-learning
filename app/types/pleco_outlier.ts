// Type definitions for Pleco Outlier dictionary data
/* eslint-disable @typescript-eslint/naming-convention */

/**
 * A reference to another character
 */
export interface Reference {
  char: string;
  href: string;
}

/**
 * A character entry in a series
 */
export interface Character {
  traditional: string;
  simplified?: string;
  pinyin?: string[];
  meaning?: string;
  explanation?: string;
}

/**
 * A sound or semantic series
 */
export interface Series {
  explanation?: string;
  characters?: Character[];
}

/**
 * Empty component data
 */
export interface EmptyComponentData {
  explanation?: string;
  characters?: Character[];
}

/**
 * Radical data
 */
export interface RadicalData {
  explanation?: string;
  characters?: Character[];
}

/**
 * Complete Outlier dictionary entry structure
 */
export interface PlecoOutlier {
  traditional: string;
  simplified?: string;
  pinyin?: string[];
  note?: string;
  references?: Reference[];
  sound_series?: Series;
  semantic_series?: Series;
  empty_component?: EmptyComponentData;
  radical?: RadicalData;
  raw_html?: string;
}
