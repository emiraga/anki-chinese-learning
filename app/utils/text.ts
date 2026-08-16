export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export type SegmentedWord = {
  text: string;
  isWord: boolean;
  startIndex: number;
  endIndex: number;
};

export type SegmentationAlgorithm = "intl-ch" | "intl-tw" | "character";

export function segmentChineseText(
  text: string,
  algorithm?: SegmentationAlgorithm
): SegmentedWord[] {
  if (!text) return [];

  switch (algorithm) {
    case "intl-ch":
      return segmentWithIntl(text, "zh-CN");
    case "intl-tw":
      return segmentWithIntl(text, "zh-TW");
    case "character":
      return segmentByCharacter(text);
    default:
      return segmentWithIntl(text, "zh-TW");
  }
}

function segmentWithIntl(text: string, locale: string): SegmentedWord[] {
  const segments: SegmentedWord[] = [];

  if (typeof Intl.Segmenter === "undefined") {
    console.warn(
      "Intl.Segmenter not available, falling back to character segmentation"
    );
    return segmentByCharacter(text);
  }

  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const segmentedText = segmenter.segment(text);

  for (const segment of segmentedText) {
    const isWord = (segment.isWordLike ?? false) && segment.segment.length > 1;
    segments.push({
      text: segment.segment,
      isWord,
      startIndex: segment.index,
      endIndex: segment.index + segment.segment.length,
    });
  }

  return segments;
}

function segmentByCharacter(text: string): SegmentedWord[] {
  const segments: SegmentedWord[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    segments.push({
      text: char,
      isWord: false,
      startIndex: i,
      endIndex: i + 1,
    });
  }

  return segments;
}