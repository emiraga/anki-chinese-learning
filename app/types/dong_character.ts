// Type definitions for Dong Chinese character data
/* eslint-disable @typescript-eslint/naming-convention */

export interface DongCharacter {
  _id: { _str: string };
  char: string;
  codepoint: string;
  strokeCount: number;
  pinyinFrequencies: Array<{
    pinyin: string;
    count: number;
  }>;
  sources: string[];
  components: Array<{
    character: string;
    type: string[];
    hint?: string | null;
    isGlyphChanged?: boolean;
    isFromOriginalMeaning?: boolean;
  }>;
  images: Array<{
    url?: string;
    source: string;
    description: string;
    type: string;
    era: string;
    data?: {
      strokes: string[];
      medians: number[][][];
    };
    fragments?: number[][];
  }>;
  hint: string;
  shuowen?: string;
  comments?: Array<{
    source: string;
    text: string;
  }>;
  variants?: Array<{
    char: string;
    parts: string;
    source: string;
  }>;
  gloss: string;
  oldPronunciations?: Array<{
    pinyin: string;
    MC: string;
    OC: string;
    gloss: string;
    source: string;
  }> | null;
  statistics: {
    hskLevel: number;
    movieWordCount?: number;
    movieWordCountPercent?: number;
    movieWordRank?: number;
    movieWordContexts?: number;
    movieWordContextsPercent?: number;
    bookWordCount?: number;
    bookWordCountPercent?: number;
    bookWordRank?: number;
    movieCharCount?: number;
    movieCharCountPercent?: number;
    movieCharRank?: number;
    movieCharContexts?: number;
    movieCharContextsPercent?: number;
    bookCharCount?: number;
    bookCharCountPercent?: number;
    bookCharRank?: number;
    topWords?: Array<{
      word: string;
      share: number;
      trad: string;
      gloss: string;
    }>;
    pinyinFrequency?: number;
  };
  customSources?: string[];
  isVerified?: boolean;
  chars?: DongCharacter[];
  words?: Array<{
    _id: { _str: string };
    simp: string;
    trad: string;
    items: Array<{
      source: string;
      pinyin: string;
      simpTrad?: string;
      definitions?: string[];
      tang?: string[];
    }>;
    gloss: string;
    statistics: {
      hskLevel: number;
      movieWordCount?: number;
      movieWordCountPercent?: number;
      movieWordRank?: number;
      movieWordContexts?: number;
      movieWordContextsPercent?: number;
      bookWordCount?: number;
      bookWordCountPercent?: number;
      bookWordRank?: number;
      movieCharCount?: number;
      movieCharCountPercent?: number;
      movieCharRank?: number;
      movieCharContexts?: number;
      movieCharContextsPercent?: number;
      bookCharCount?: number;
      bookCharCountPercent?: number;
      bookCharRank?: number;
      topWords?: Array<{
        word: string;
        share: number;
        trad: string;
        gloss: string;
      }>;
      pinyinFrequency?: number;
    };
    pinyinSearchString: string;
  }>;
  originalMeaning?: string;
  fragments?: number[][];
  data?: {
    strokes: string[];
    medians: number[][][];
  };
  componentIn?: Array<{
    char: string;
    components: Array<{
      character: string;
      type: string[];
    }>;
    statistics?: {
      bookCharCount?: number;
    };
    isVerified?: boolean;
  }>;
}
