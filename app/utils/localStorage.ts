import React, { useState, useEffect } from "react";

export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedValue = window.localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}