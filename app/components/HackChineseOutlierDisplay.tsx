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
 */
function getComponentTypeBadge(componentType: string): { label: string; bgColor: string; textColor: string } {
  const type = componentType.toUpperCase();

  if (type === "SOUND") {
    return { label: "SOUND", bgColor: "bg-blue-100 dark:bg-blue-900", textColor: "text-blue-700 dark:text-blue-300" };
  }
  if (type === "MEANING") {
    return { label: "MEANING", bgColor: "bg-cyan-100 dark:bg-cyan-900", textColor: "text-cyan-700 dark:text-cyan-300" };
  }
  if (type === "FORM") {
    return { label: "FORM", bgColor: "bg-purple-100 dark:bg-purple-900", textColor: "text-purple-700 dark:text-purple-300" };
  }
  if (type === "EMPTY") {
    return { label: "EMPTY", bgColor: "bg-gray-100 dark:bg-gray-700", textColor: "text-gray-700 dark:text-gray-300" };
  }
  if (type.includes("MEANING") && type.includes("SOUND")) {
    return { label: "MEANING + SOUND", bgColor: "bg-teal-100 dark:bg-teal-900", textColor: "text-teal-700 dark:text-teal-300" };
  }

  return { label: type, bgColor: "bg-gray-100 dark:bg-gray-700", textColor: "text-gray-700 dark:text-gray-300" };
}

export function HackChineseOutlierDisplay({ character }: HackChineseOutlierDisplayProps) {
  const meaningTreeItems = parseMeaningTree(character.meaning_tree_as_character_simp);

  // Get unique components (simp charset only to avoid duplicates)
  const components = character.component_analyses
    .filter((c) => c.charset === "simp")
    .sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      {/* Form Description */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
        <h3 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-300">Form Description</h3>
        <p className="text-sm text-gray-800 dark:text-gray-200">{character.form_explanation_simp}</p>
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
          <ol className="space-y-2">
            {meaningTreeItems.map((item, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="flex w-6 flex-shrink-0 items-center justify-center font-semibold text-blue-600 dark:text-blue-400">
                  {index + 1}
                </span>
                <span className="flex-1 text-gray-800 dark:text-gray-200">
                  {item.arrow && <span className="mr-2 text-gray-600 dark:text-gray-400">{item.arrow}</span>}
                  {item.text}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
