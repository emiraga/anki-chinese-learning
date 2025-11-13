import React from "react";
import type {
  YellowBridgeCharacter,
  ComponentInfo,
} from "~/types/yellowbridge_character";

interface YellowBridgeDisplayProps {
  character: YellowBridgeCharacter;
}

function ComponentBadge({ comp }: { comp: ComponentInfo }) {
  return (
    <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {comp.character}
      </span>
      {comp.isAltered && (
        <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-1.5 py-0.5 rounded">
          altered
        </span>
      )}
      {comp.pinyin.length > 0 && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          [{comp.pinyin.join(', ')}]
        </span>
      )}
      {comp.description && (
        <span className="text-sm text-gray-500 dark:text-gray-500">
          - {comp.description}
        </span>
      )}
    </div>
  );
}

export function YellowBridgeDisplay({ character }: YellowBridgeDisplayProps) {
  const hasPhonetic = character.functionalComponents.phonetic.length > 0;
  const hasSemantic = character.functionalComponents.semantic.length > 0;
  const hasPrimitive = character.functionalComponents.primitive.length > 0;
  const hasFormation = character.formationMethods.length > 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6">
        {/* Character Info */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {character.character}
          </h2>
          {character.pinyin.length > 0 && (
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              Pinyin: {character.pinyin.join(', ')}
            </p>
          )}
          {character.definition && (
            <p className="text-base text-gray-700 dark:text-gray-300">
              {character.definition}
            </p>
          )}
          {character.kangxiRadical && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Kangxi Radical #{character.kangxiRadical}
            </p>
          )}
        </div>

        {/* Functional Components */}
        {(hasPhonetic || hasSemantic) && (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Functional Components
            </h3>

            {hasPhonetic && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Phonetic (Sound)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {character.functionalComponents.phonetic.map((comp, idx) => (
                    <ComponentBadge key={idx} comp={comp} />
                  ))}
                </div>
              </div>
            )}

            {hasSemantic && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Semantic (Meaning)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {character.functionalComponents.semantic.map((comp, idx) => (
                    <ComponentBadge key={idx} comp={comp} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Formation Methods */}
        {hasFormation && (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Character Formation
            </h3>
            <div className="space-y-3">
              {character.formationMethods.map((method, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                >
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {method.typeEnglish}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      ({method.typeChinese})
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {method.description}
                  </p>
                  {method.referencedCharacters.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {method.referencedCharacters.map((char, charIdx) => (
                        <span
                          key={charIdx}
                          className="inline-block px-2 py-1 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm font-medium"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primitive Components */}
        {hasPrimitive && (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Primitive Components
            </h3>
            <div className="flex flex-wrap gap-2">
              {character.functionalComponents.primitive.map((comp, idx) => (
                <ComponentBadge key={idx} comp={comp} />
              ))}
            </div>
          </div>
        )}

        {/* Simplification Info */}
        {character.simplification && (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Simplification
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <span className="font-medium">Simplified form:</span>{" "}
                <span className="text-2xl font-bold ml-2">
                  {character.simplification.simplifiedForm}
                </span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {character.simplification.method}
              </p>
              {character.simplification.methodType && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Method: {character.simplification.methodType}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Radical Info */}
        {character.radical && (
          <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Key Radical
            </h3>
            <ComponentBadge comp={character.radical} />
            {character.radical.kangxiRadicalNumber && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Kangxi Radical #{character.radical.kangxiRadicalNumber}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
