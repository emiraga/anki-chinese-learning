import type { HackChineseOutlierCharacter } from "~/types/hackchinese_outlier";

interface HackChineseOutlierDisplayProps {
  character: HackChineseOutlierCharacter;
}

// Section wrapper component
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-200">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Parses the meaning tree string and splits it into individual meaning items
 * Format: "(orig.) text%%→ text%% ⇒ text"
 */
function parseMeaningTree(
  meaningTree: string | null,
): Array<{ arrow: string; text: string }> {
  if (!meaningTree) {
    return [];
  }

  // Split by %% to get individual items
  const items = meaningTree.split("%%");

  return items.map((item) => {
    item = item.trim();

    // Check for different arrow types
    if (item.startsWith("→")) {
      return { arrow: "→", text: item.slice(1).trim() };
    }
    if (item.startsWith("⇒")) {
      return { arrow: "⇒", text: item.slice(1).trim() };
    }
    if (item.startsWith("⇛")) {
      return { arrow: "⇛", text: item.slice(1).trim() };
    }

    // First item (orig.)
    return { arrow: "", text: item };
  });
}

/**
 * Parses component strings that may contain special notation:
 * - [X-Y] means "character X minus component Y"
 * - [X-Y-Z] means "character X minus components Y and Z"
 * - [X+Y] means "components X and Y combined"
 * - [X-over-Y] means "component X stacked over component Y"
 * - Regular characters are returned as-is
 */
function parseComponentNotation(component: string): {
  type: "subtraction" | "addition" | "overlay" | "regular";
  parts: string[];
  displayText: string;
} {
  const trimmed = component.trim();

  // Check if it's bracketed notation
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);

    // Check for overlay: [X-over-Y] or [X-over-Y-Z]
    if (inner.includes("-over-")) {
      const parts = inner.split("-over-");
      return {
        type: "overlay",
        parts,
        displayText: parts.join(" over "),
      };
    }

    // Check for addition: [X+Y]
    if (inner.includes("+")) {
      const parts = inner.split("+");
      return {
        type: "addition",
        parts,
        displayText: parts.join(" + "),
      };
    }

    // Check for subtraction: [X-Y] or [X-Y-Z-...]
    // This handles both single and multiple subtractions
    if (inner.includes("-")) {
      const parts = inner.split("-");
      if (parts.length >= 2) {
        return {
          type: "subtraction",
          parts,
          displayText:
            parts.length === 2
              ? `${parts[0]} − ${parts[1]}`
              : `${parts[0]} − ${parts.slice(1).join(" − ")}`,
        };
      }
    }
  }

  // Regular component
  return {
    type: "regular",
    parts: [trimmed],
    displayText: trimmed,
  };
}

/**
 * Gets the badge style based on component type
 * Colors match DongCharacterDisplay for consistency
 */
function getComponentTypeBadge(componentType: string): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  const type = componentType.toUpperCase();

  // SOUND - Blue (matches Dong's sound component)
  if (type === "SOUND") {
    return {
      label: "SOUND",
      bgColor: "bg-blue-100 dark:bg-blue-900",
      textColor: "text-blue-600 dark:text-blue-400",
    };
  }

  // MEANING - Red (matches Dong's meaning component)
  if (type === "MEANING") {
    return {
      label: "MEANING",
      bgColor: "bg-red-100 dark:bg-red-900",
      textColor: "text-red-600 dark:text-red-400",
    };
  }

  // FORM - Green (matches Dong's iconic component - visual representation)
  if (type === "FORM") {
    return {
      label: "FORM",
      bgColor: "bg-green-100 dark:bg-green-900",
      textColor: "text-green-600 dark:text-green-400",
    };
  }

  // EMPTY - Gray (matches Dong's deleted/unknown)
  if (type === "EMPTY") {
    return {
      label: "EMPTY",
      bgColor: "bg-gray-100 dark:bg-gray-700",
      textColor: "text-gray-600 dark:text-gray-400",
    };
  }

  // Default - Gray
  return {
    label: type,
    bgColor: "bg-gray-100 dark:bg-gray-700",
    textColor: "text-gray-600 dark:text-gray-400",
  };
}

/**
 * Parses stroke order diagrams from the string containing multiple SVGs
 * SVGs are separated by multiple newlines
 */
function parseStrokeOrderDiagrams(diagramString: string | null): string[] {
  if (!diagramString) {
    return [];
  }

  // Split by triple newlines and filter out empty strings
  return diagramString
    .split(/\n\n\n+/)
    .map((svg) => svg.trim())
    .filter((svg) => svg.length > 0);
}

export function HackChineseOutlierDisplay({
  character,
}: HackChineseOutlierDisplayProps) {
  // Prefer traditional data, fallback to simplified
  const meaningTreeItems = parseMeaningTree(
    character.meaning_tree_as_character_trad ||
      character.meaning_tree_as_character_simp,
  );
  const meaningTreeAsComponentItems = parseMeaningTree(
    character.meaning_tree_as_component_trad ||
      character.meaning_tree_as_component_simp,
  );

  // Get unique components (prefer trad charset, fallback to simp)
  const components = character.component_analyses
    .filter((c) => c.charset === "trad")
    .sort((a, b) => a.position - b.position);

  // If no traditional components, use simplified as fallback
  const displayComponents =
    components.length > 0
      ? components
      : character.component_analyses
          .filter((c) => c.charset === "simp")
          .sort((a, b) => a.position - b.position);

  // Parse stroke order diagrams (prefer traditional, fallback to simplified)
  const strokeOrderDiagrams = parseStrokeOrderDiagrams(
    character.so_diagram_trad || character.so_diagram_simp,
  );

  // Check if we're using simplified fallback data
  const usingSimplifiedMeaningTree =
    !character.meaning_tree_as_character_trad &&
    character.meaning_tree_as_character_simp;
  const usingSimplifiedMeaningTreeComponent =
    !character.meaning_tree_as_component_trad &&
    character.meaning_tree_as_component_simp;
  const usingSimplifiedComponents =
    components.length === 0 && displayComponents.length > 0;
  const usingSimplifiedStrokeOrder =
    !character.so_diagram_trad && character.so_diagram_simp;
  const usingSimplifiedFormExplanation =
    !character.form_explanation_trad && character.form_explanation_simp;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Top Section: Ancient Form and Form Description side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Ancient Form */}
        {character.ancient_form_image && (
          <Section title="Ancient Form">
            <div className="flex items-center justify-center rounded bg-gray-50 p-8 dark:bg-gray-700">
              <div
                className="flex h-48 w-48 items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-auto dark:invert"
                dangerouslySetInnerHTML={{
                  __html: character.ancient_form_image,
                }}
              />
            </div>
          </Section>
        )}

        {/* Form Description */}
        <Section title="Form Description">
          {usingSimplifiedFormExplanation && (
            <div className="mb-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note: Displaying simplified character information (
              {character.simplified})
            </div>
          )}
          <div className="space-y-4">
            {(
              character.form_explanation_trad || character.form_explanation_simp
            )
              .split("%%")
              .map((paragraph, index) => (
                <div
                  key={index}
                  className="text-base leading-relaxed text-gray-800 dark:text-gray-200"
                >
                  {paragraph.trim()}
                </div>
              ))}
          </div>
        </Section>
      </div>

      {/* Components */}
      {displayComponents.length > 0 && (
        <Section title="Components">
          {usingSimplifiedComponents && (
            <div className="mb-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note: Displaying simplified character information (
              {character.simplified})
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayComponents.map((component) => {
              // Split component type by " + " to handle combined types
              const types = component.component_type
                .split(" + ")
                .map((t) => t.trim());
              const badges = types.map((type) => getComponentTypeBadge(type));

              // Parse the component notation
              const notation = parseComponentNotation(component.component);

              return (
                <div
                  key={component.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-700"
                >
                  <div className="mb-3 flex items-start gap-3">
                    {/* Component display with special notation handling */}
                    <div className="shrink-0">
                      {notation.type === "regular" ? (
                        <div className="text-4xl dark:text-gray-100">
                          {notation.displayText}
                        </div>
                      ) : notation.type === "overlay" ? (
                        // Overlay notation: [X-over-Y]
                        <div className="flex flex-col items-center gap-1 border-l-2 border-r-2 px-1 border-gray-200 dark:border-gray-800">
                          <div className="flex flex-col items-center gap-1">
                            {notation.parts.map((part, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col items-center"
                              >
                                <span className="text-2xl dark:text-gray-100">
                                  {part}
                                </span>
                                {idx < notation.parts.length - 1 && (
                                  <span className="text-xs font-bold text-purple-500 dark:text-purple-400">
                                    ↓ over
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        // Addition or subtraction notation
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2 flex-wrap justify-center">
                            <span className="text-gray-500 text-3xl">[</span>
                            {notation.parts.map((part, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <span className="text-3xl dark:text-gray-100">
                                  {part}
                                </span>
                                {idx < notation.parts.length - 1 && (
                                  <span
                                    className={`text-xl font-bold ${
                                      notation.type === "subtraction"
                                        ? "text-red-500 dark:text-red-400"
                                        : "text-green-500 dark:text-green-400"
                                    }`}
                                  >
                                    {notation.type === "subtraction"
                                      ? "−"
                                      : "+"}
                                  </span>
                                )}
                              </div>
                            ))}
                            <span className="text-gray-500 text-3xl">]</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                            {notation.type === "subtraction"
                              ? notation.parts.length > 2
                                ? `minus ${notation.parts.length - 1} components`
                                : "minus"
                              : "combined"}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex gap-2">
                      {badges.map((badge, index) => (
                        <div
                          key={index}
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${badge.bgColor} ${badge.textColor}`}
                        >
                          {badge.label}
                        </div>
                      ))}
                      {component.component_type_desc}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {component.description.trim()}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Meaning Tree as a Character */}
      {meaningTreeItems.length > 0 && (
        <Section title="Meaning Tree as a character">
          {usingSimplifiedMeaningTree && (
            <div className="mb-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note: Displaying simplified character information (
              {character.simplified})
            </div>
          )}
          <ol className="space-y-3">
            {meaningTreeItems.map((item, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-100 font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  {index + 1}
                </span>
                <span className="flex-1 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                  {item.arrow && (
                    <span className="mr-2 font-semibold text-blue-600 dark:text-blue-400">
                      {item.arrow}
                    </span>
                  )}
                  {item.text}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Meaning Tree as a Component */}
      {meaningTreeAsComponentItems.length > 0 && (
        <Section title="Meaning Tree as a component">
          {usingSimplifiedMeaningTreeComponent && (
            <div className="mb-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note: Displaying simplified character information (
              {character.simplified})
            </div>
          )}
          <p className="mb-4 text-sm italic text-gray-600 dark:text-gray-400">
            How this character&apos;s meaning evolved when used as a component
            in other characters:
          </p>
          <ol className="space-y-3">
            {meaningTreeAsComponentItems.map((item, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-green-100 font-semibold text-green-600 dark:bg-green-900 dark:text-green-300">
                  {index + 1}
                </span>
                <span className="flex-1 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                  {item.arrow && (
                    <span className="mr-2 font-semibold text-green-600 dark:text-green-400">
                      {item.arrow}
                    </span>
                  )}
                  {item.text}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Stroke Order Diagrams */}
      {strokeOrderDiagrams.length > 0 && (
        <Section title="Stroke Order">
          {usingSimplifiedStrokeOrder && (
            <div className="mb-3 text-xs italic text-gray-500 dark:text-gray-400">
              Note: Displaying simplified character information (
              {character.simplified})
            </div>
          )}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {strokeOrderDiagrams.map((svg, index) => (
              <div
                key={index}
                className="flex h-32 w-32 items-center justify-center rounded bg-gray-50 p-2 dark:bg-gray-700"
              >
                <div
                  className="h-full w-full dark:invert"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
