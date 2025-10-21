import { useEffect, useState } from "react";
import type { DongCharacter } from "~/types/dong_character";

interface UseDongCharacterResult {
  character: DongCharacter | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to load a Dong Chinese character data from JSON file
 * @param char - The Chinese character to load (e.g., "成", "城")
 * @returns Object with character data, loading state, and error state
 */
export function useDongCharacter(char: string): UseDongCharacterResult {
  const [character, setCharacter] = useState<DongCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!char) {
      setError("No character provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setCharacter(null);

    fetch(`/data/dong/${char}.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load character "${char}": ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: DongCharacter) => {
        setCharacter(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [char]);

  return { character, loading, error };
}
