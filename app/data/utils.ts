import React, { useState, useEffect } from "react";
import type { PinyinType } from "./pinyin_function";

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

export function comparePinyin(a: PinyinType, b: PinyinType) {
  if (a.sylable === b.sylable) {
    if (a.tone === 5) {
      return +1;
    }
    if (b.tone === 5) {
      return -1;
    }
  }
  return b.count - a.count;
}

export function cleanPinyinAnkiField(pinyin: string) {
  return pinyin
    .replace(/\<span style="color: rgb\([0-9, ]+\);"\>/g, "")
    .replace(/\<\/span\>/g, "");
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
      const storedValue = window.localStorage.getItem(key);
      // If a value is found in localStorage, parse it. Otherwise, use the initialValue.
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch (error) {
      // If there's an error (e.g., in a server-side rendering environment
      // where localStorage is not available), return the initial value.
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // 2. We use useEffect to update localStorage whenever the state `value` changes.
  // This effect will run every time `key` or `value` is updated.
  useEffect(() => {
    try {
      // Save the state to localStorage, converting it to a JSON string.
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Handle potential errors, e.g., if localStorage is full.
      console.error(`Error writing to localStorage key “${key}”:`, error);
    }
  }, [key, value]);

  // 3. Return the state value and the setter function, just like useState.
  return [value, setValue];
}
