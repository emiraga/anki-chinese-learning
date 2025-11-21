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
function parseMeaningTree(meaningTree: string | null): Array<{ arrow: string; text: string }> {
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
 * Gets the badge style based on component type
 * Colors match DongCharacterDisplay for consistency
 */
function getComponentTypeBadge(componentType: string): { label: string; bgColor: string; textColor: string } {
  const type = componentType.toUpperCase();

  // SOUND - Blue (matches Dong's sound component)
  if (type === "SOUND") {
    return { label: "SOUND", bgColor: "bg-blue-100 dark:bg-blue-900", textColor: "text-blue-600 dark:text-blue-400" };
  }

  // MEANING - Red (matches Dong's meaning component)
  if (type === "MEANING") {
    return { label: "MEANING", bgColor: "bg-red-100 dark:bg-red-900", textColor: "text-red-600 dark:text-red-400" };
  }

  // FORM - Green (matches Dong's iconic component - visual representation)
  if (type === "FORM") {
    return { label: "FORM", bgColor: "bg-green-100 dark:bg-green-900", textColor: "text-green-600 dark:text-green-400" };
  }

  // EMPTY - Gray (matches Dong's deleted/unknown)
  if (type === "EMPTY") {
    return { label: "EMPTY", bgColor: "bg-gray-100 dark:bg-gray-700", textColor: "text-gray-600 dark:text-gray-400" };
  }

  // MEANING + SOUND - Purple (distinctive combination, using Dong's remnant color)
  if (type.includes("MEANING") && type.includes("SOUND")) {
    return { label: "MEANING + SOUND", bgColor: "bg-purple-100 dark:bg-purple-900", textColor: "text-purple-600 dark:text-purple-400" };
  }

  // Default - Gray
  return { label: type, bgColor: "bg-gray-100 dark:bg-gray-700", textColor: "text-gray-600 dark:text-gray-400" };
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

export function HackChineseOutlierDisplay({ character }: HackChineseOutlierDisplayProps) {
  const meaningTreeItems = parseMeaningTree(character.meaning_tree_as_character_simp);

  // Get unique components (simp charset only to avoid duplicates)
  const components = character.component_analyses
    .filter((c) => c.charset === "simp")
    .sort((a, b) => a.position - b.position);

  // Parse stroke order diagrams (prefer traditional if available, fallback to simplified)
  const strokeOrderDiagrams = parseStrokeOrderDiagrams(
    character.so_diagram_trad || character.so_diagram_simp
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Top Section: Ancient Form and Form Description side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Ancient Form */}
        {character.ancient_form_image && (
          <Section title="Ancient Form">
            <div className="flex items-center justify-center rounded bg-gray-50 p-8 dark:bg-gray-700">
              <div
                className="h-48 w-48"
                dangerouslySetInnerHTML={{ __html: character.ancient_form_image }}
              />
            </div>
          </Section>
        )}

        {/* Form Description */}
        <Section title="Form Description">
          <div className="space-y-4">
            {character.form_explanation_simp.split("%%").map((paragraph, index) => (
              <div key={index} className="text-base leading-relaxed text-gray-800 dark:text-gray-200">
                {paragraph.trim()}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Components */}
      {components.length > 0 && (
        <Section title="Components">
          <div className="space-y-4">
            {components.map((component) => {
              const badge = getComponentTypeBadge(component.component_type);
              return (
                <div
                  key={component.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-700"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex-shrink-0 text-4xl dark:text-gray-100">{component.component.trim()}</div>
                    <div className="flex-1">
                      <div className={`inline-block rounded px-2 py-1 text-xs font-semibold ${badge.bgColor} ${badge.textColor}`}>
                        {badge.label}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{component.description.trim()}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Meaning Tree */}
      {meaningTreeItems.length > 0 && (
        <Section title="Meaning Tree as a character">
          <ol className="space-y-3">
            {meaningTreeItems.map((item, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-100 font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  {index + 1}
                </span>
                <span className="flex-1 text-base leading-relaxed text-gray-800 dark:text-gray-200">
                  {item.arrow && <span className="mr-2 font-semibold text-blue-600 dark:text-blue-400">{item.arrow}</span>}
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
          <div className="flex flex-wrap items-center justify-center gap-4">
            {strokeOrderDiagrams.map((svg, index) => (
              <div
                key={index}
                className="flex h-32 w-32 items-center justify-center rounded bg-gray-50 p-2 dark:bg-gray-700"
              >
                <div
                  className="h-full w-full"
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
