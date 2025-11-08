import React from "react";
import type { HanziYuanCharacter } from "~/types/hanziyuan_character";

interface HanziYuanDisplayProps {
  character: HanziYuanCharacter;
}

export function HanziYuanDisplay({ character }: HanziYuanDisplayProps) {
  // Extract the etymology-nav content
  const etymologyNavContent = character["etymology-nav"];

  if (!etymologyNavContent) {
    return (
      <div className="text-xl text-gray-600 dark:text-gray-400">
        No HanziYuan data available
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="space-y-4">
        <div className="prose dark:prose-invert max-w-none">
          <div
            className="hanziyuan-content"
            dangerouslySetInnerHTML={{ __html: etymologyNavContent }}
          />
        </div>
      </div>
    </div>
  );
}
