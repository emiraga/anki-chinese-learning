import React from "react";
import { useDongCharacter } from "~/hooks/useDongCharacter";
import { DongCharacterDisplay } from "./DongCharacterDisplay";

interface DongCharacterLoaderProps {
  char: string;
}

/**
 * Wrapper component that loads and displays a Dong Chinese character
 * @param char - The traditional Chinese character to load and display
 */
export function DongCharacterLoader({ char }: DongCharacterLoaderProps) {
  const { character, loading, error } = useDongCharacter(char);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600 dark:text-gray-400">
          Loading character data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600 dark:text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600 dark:text-gray-400">
          No character data found
        </div>
      </div>
    );
  }

  return <DongCharacterDisplay character={character} />;
}
