import React from "react";
import type {
  HanziYuanCharacter,
  EtymologySection,
  Component,
} from "~/types/hanziyuan_character";
import { useDarkMode } from "~/components/DarkModeToggle";

interface HanziYuanDisplayProps {
  character: HanziYuanCharacter;
}

function EtymologySectionDisplay({
  title,
  section,
}: {
  title: string;
  section: EtymologySection;
}) {
  const { isDarkMode } = useDarkMode();

  if (section.count === 0 || section.items.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <h4 className="text-lg font-semibold mb-2">
        {title} {section.chinese} ({section.count})
      </h4>
      <div className="flex flex-wrap gap-4">
        {section.items.map((item) => (
          <div key={item.id} className="flex flex-col items-center">
            {item.image ? (
              <img
                src={`/${item.image}`}
                alt={`Etymology ${item.id}`}
                className="w-32 h-32 object-contain"
                style={
                  isDarkMode
                    ? { filter: "invert(1) hue-rotate(180deg)" }
                    : undefined
                }
              />
            ) : (
              <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500">
                No image
              </div>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {item.id}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentDisplay({ component }: { component: Component }) {
  // Check if this is a marker-only component (no actual component, just markers)
  const isMarkerOnly = !component.component && !component.characters && component.markers;

  return (
    <div className="border-l-2 border-blue-500 pl-3 mb-2">
      {!isMarkerOnly && (
        <div className="flex items-baseline gap-2">
          {component.quantity && (
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {component.quantity}
            </span>
          )}
          {component.component && (
            <span className="text-lg font-semibold">{component.component}</span>
          )}
          {component.characters && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {component.characters}
            </span>
          )}
          {component.pronunciation && (
            <span className="text-sm text-gray-500 dark:text-gray-500">
              {component.pronunciation}
            </span>
          )}
          {component.role && (
            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">
              {component.role}
            </span>
          )}
        </div>
      )}
      {component.description && (
        <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          {component.description}
        </div>
      )}
      {component.markers && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5">
          {component.markers.removed && (
            <div>
              Removed:{" "}
              {typeof component.markers.removed === "string"
                ? component.markers.removed
                : `${component.markers.removed.character} ${component.markers.removed.pronunciation}`}
            </div>
          )}
          {component.markers.added && (
            <div>
              Added:{" "}
              {typeof component.markers.added === "string"
                ? component.markers.added
                : `${component.markers.added.character} ${component.markers.added.pronunciation}`}
            </div>
          )}
          {component.markers.not && (
            <div>
              Not:{" "}
              {typeof component.markers.not === "string"
                ? component.markers.not
                : `${component.markers.not.character} ${component.markers.not.pronunciation}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HanziYuanDisplay({ character }: HanziYuanDisplayProps) {
  const { characterInfo, etymologyCharacters, characterDecomposition, decompositionNotes } =
    character;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6">
      {/* Character Info Section */}
      <section>
        <h3 className="text-2xl font-bold mb-4 border-b pb-2">
          Character Information
        </h3>
        <div className="space-y-2">
          {Object.entries(characterInfo)
            .filter(([key, value]) => {
              // Filter out empty values, "Not exist", "Not exists", "Not applicable"
              if (!value) return false;
              const lowerValue = value.toLowerCase();
              if (
                lowerValue === "not exist" ||
                lowerValue === "not exists" ||
                lowerValue === "not exists." ||
                lowerValue === "not applicable" ||
                lowerValue === "not applicable."
              ) {
                return false;
              }
              // Skip the raw "Character decomposition" field since we show it parsed
              if (key === "Character decomposition 字形分解") return false;
              // Skip "Decomposition notes" since we show it in the decomposition section
              if (key === "Decomposition notes 字形分解说明") return false;
              return true;
            })
            .map(([key, value]) => {
              // Special rendering for certain fields
              const isCharacterField =
                key.includes("Traditional in your browser") ||
                key.includes("Simplified in your browser") ||
                key.includes("Older traditional");
              const isCodeField = key.startsWith("_unlabeled_");

              // Remove Chinese characters from the end of the key
              const englishOnlyKey = key.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]+/g, "").replace(/\s+/g, " ").trim();
              const displayLabel = isCodeField ? "Reference code" : englishOnlyKey;

              return (
                <div key={key} className="grid grid-cols-[minmax(200px,auto)_1fr] gap-2">
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                    {displayLabel}:
                  </span>
                  <span
                    className={
                      isCharacterField
                        ? "text-xl"
                        : isCodeField
                          ? "font-mono text-sm"
                          : ""
                    }
                  >
                    {value}
                  </span>
                </div>
              );
            })}
        </div>
      </section>

      {/* Character Decomposition Section */}
      {characterDecomposition &&
        (characterDecomposition.type || characterDecomposition.raw) && (
          <section>
            <h3 className="text-2xl font-bold mb-4 border-b pb-2">
              Character Decomposition
            </h3>

            {characterDecomposition.raw ? (
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {characterDecomposition.raw}
              </div>
            ) : (
              <div className="space-y-4">
                {characterDecomposition.type && (
                  <div>
                    <span className="font-semibold">Type: </span>
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                      {characterDecomposition.type}
                    </span>
                    {characterDecomposition.character && (
                      <span className="ml-2 text-xl">
                        {characterDecomposition.character}
                      </span>
                    )}
                  </div>
                )}

                {characterDecomposition.olderForms &&
                  characterDecomposition.olderForms.length > 0 && (
                    <div>
                      <span className="font-semibold">Older forms: </span>
                      <span className="text-lg">
                        {characterDecomposition.olderForms.join(", ")}
                      </span>
                    </div>
                  )}

                {characterDecomposition.mutants &&
                  characterDecomposition.mutants.length > 0 && (
                    <div>
                      <span className="font-semibold">Mutants: </span>
                      <span className="text-lg">
                        {characterDecomposition.mutants.join(", ")}
                      </span>
                    </div>
                  )}

                {characterDecomposition.variantOf && (
                  <div>
                    <span className="font-semibold">Variant of: </span>
                    <span className="text-lg">
                      {characterDecomposition.variantOf}
                    </span>
                  </div>
                )}

                {characterDecomposition.names &&
                  characterDecomposition.names.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Names:</h4>
                      <div className="space-y-1">
                        {characterDecomposition.names.map((name, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{name.name}</span>:{" "}
                            <span className="text-lg">{name.character}</span>{" "}
                            <span className="text-gray-600 dark:text-gray-400">
                              ({name.pronunciation})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {characterDecomposition.components &&
                  characterDecomposition.components.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Components:</h4>
                      <div className="space-y-2">
                        {characterDecomposition.components.map(
                          (component, idx) => (
                            <ComponentDisplay key={idx} component={component} />
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* Show parsed decomposition notes */}
                {decompositionNotes && Object.keys(decompositionNotes).length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded space-y-3">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                      Decomposition Notes
                    </h4>

                    {/* Explanatory notes */}
                    {decompositionNotes.explanations && decompositionNotes.explanations.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Explanations:
                        </span>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {decompositionNotes.explanations.map((note, idx) => (
                            <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Plain text notes */}
                    {decompositionNotes.notes && decompositionNotes.notes.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Notes:
                        </span>
                        <div className="mt-1 space-y-1">
                          {decompositionNotes.notes.map((note, idx) => (
                            <p key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special markers */}
                    {decompositionNotes.specialMarkers && decompositionNotes.specialMarkers.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Special Notes:
                        </span>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {decompositionNotes.specialMarkers.map((marker, idx) => (
                            <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 italic">
                              {marker}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cross references */}
                    {decompositionNotes.crossReferences && decompositionNotes.crossReferences.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          See also:{" "}
                        </span>
                        <span className="text-lg">
                          {decompositionNotes.crossReferences.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* Related characters */}
                    {decompositionNotes.relatedCharacters && decompositionNotes.relatedCharacters.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Related characters:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {decompositionNotes.relatedCharacters.map((char, idx) => (
                            <span key={idx} className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-sm">
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rule references */}
                    {decompositionNotes.ruleReferences && decompositionNotes.ruleReferences.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Rule References:
                        </span>
                        <div className="mt-1 space-y-1">
                          {decompositionNotes.ruleReferences.map((rule, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                                {rule.code}
                              </span>
                              <span className="ml-2 text-lg">{rule.characters}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {characterDecomposition.simplificationRules &&
                  characterDecomposition.simplificationRules.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">
                        Simplification Rules:
                      </h4>
                      <div className="space-y-1">
                        {characterDecomposition.simplificationRules.map(
                          (rule, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                {rule.rule}
                              </span>
                              {rule.simplified && (
                                <span className="ml-2">
                                  Simplified: {rule.simplified}
                                </span>
                              )}
                              {rule.newChar && (
                                <span className="ml-2">
                                  New char: {rule.newChar}
                                </span>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {(characterDecomposition.simplifiedForm ||
                  characterDecomposition.newCharForm) && (
                  <div className="space-y-1">
                    {characterDecomposition.simplifiedForm && (
                      <div>
                        <span className="font-semibold">Simplified form: </span>
                        <span className="text-lg">
                          {characterDecomposition.simplifiedForm}
                        </span>
                      </div>
                    )}
                    {characterDecomposition.newCharForm && (
                      <div>
                        <span className="font-semibold">New char form: </span>
                        <span className="text-lg">
                          {characterDecomposition.newCharForm}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {characterDecomposition.crossReferences &&
                  characterDecomposition.crossReferences.length > 0 && (
                    <div>
                      <span className="font-semibold">See also: </span>
                      <span className="text-lg">
                        {characterDecomposition.crossReferences.join(", ")}
                      </span>
                    </div>
                  )}

                {characterDecomposition.notes && (
                  <div>
                    <span className="font-semibold">Notes: </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {characterDecomposition.notes}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      {/* Etymology Characters Section */}
      {etymologyCharacters &&
        (etymologyCharacters.oracle.count > 0 ||
          etymologyCharacters.bronze.count > 0 ||
          etymologyCharacters.seal.count > 0 ||
          etymologyCharacters.liushutong.count > 0) && (
          <section>
            <h3 className="text-2xl font-bold mb-4 border-b pb-2">
              Etymology Characters
            </h3>
            <div className="space-y-4">
              <EtymologySectionDisplay
                title="Oracle"
                section={etymologyCharacters.oracle}
              />
              <EtymologySectionDisplay
                title="Bronze"
                section={etymologyCharacters.bronze}
              />
              <EtymologySectionDisplay
                title="Seal"
                section={etymologyCharacters.seal}
              />
              <EtymologySectionDisplay
                title="Liushutong"
                section={etymologyCharacters.liushutong}
              />
            </div>
          </section>
        )}
    </div>
  );
}
