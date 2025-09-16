import React, { useState, useEffect } from "react";

export function removeDuplicateChars(
  str: string,
  ignore: Set<string> | null = null
): string {
  if (ignore === null) {
    return [...new Set(str)].join("");
  }
  return [...new Set(str)].filter((c) => !ignore.has(c)).join("");
}

export function pickRandomElements<T>(arr: T[], numElements: number): T[] {
  const result: T[] = [];
  const len = arr.length;
  const taken = new Array(len);

  if (numElements >= len) {
    return arr;
  }

  while (result.length < numElements) {
    const x = Math.floor(Math.random() * len);
    if (!taken[x]) {
      result.push(arr[x]);
      taken[x] = true;
    }
  }
  return result;
}

// --- Custom Hook: useLocalStorageState ---
// A drop-in replacement for useState that persists state to localStorage.

export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. We use useState, but we get the initial value from localStorage or the provided default.
  // The function passed to useState runs only once on the initial render,
  // preventing repeated localStorage access.
  const [value, setValue] = useState<T>(() => {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedValue = window.localStorage.getItem(key);
        // If a value is found in localStorage, parse it. Otherwise, use the initialValue.
        return storedValue ? JSON.parse(storedValue) : initialValue;
      }
      return initialValue;
    } catch (error) {
      // If there's an error (e.g., in a server-side rendering environment
      // where localStorage is not available), return the initial value.
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // 2. We use useEffect to update localStorage whenever the state `value` changes.
  // This effect will run every time `key` or `value` is updated.
  useEffect(() => {
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        // Save the state to localStorage, converting it to a JSON string.
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      // Handle potential errors, e.g., if localStorage is full.
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, value]);

  // 3. Return the state value and the setter function, just like useState.
  return [value, setValue];
}

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

  // Check if Intl.Segmenter is available
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
