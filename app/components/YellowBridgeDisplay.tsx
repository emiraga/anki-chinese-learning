import React from "react";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";

interface YellowBridgeDisplayProps {
  character: YellowBridgeCharacter;
}

function stripScriptTags(html: string | undefined): string | undefined {
  if (!html) return html;
  // Remove script tags and their content
  return html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
}

export function YellowBridgeDisplay({ character }: YellowBridgeDisplayProps) {
  // Extract the decomp and formation content and strip script tags
  const decompContent = stripScriptTags(character.decomp);
  const formationContent = stripScriptTags(character.formation);

  if (!decompContent && !formationContent) {
    return (
      <div className="text-xl text-gray-600 dark:text-gray-400">
        No YellowBridge data available
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        {formationContent && (
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Character Formation
            </h3>
            <div
              className="yellowbridge-formation"
              dangerouslySetInnerHTML={{ __html: formationContent }}
            />
          </div>
        )}
        {decompContent && (
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Character Decomposition
            </h3>
            <div
              className="yellowbridge-decomp"
              dangerouslySetInnerHTML={{ __html: decompContent }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
