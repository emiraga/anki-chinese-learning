import React from "react";
import type {
  YellowBridgeCharacter,
  ComponentInfo,
  CharacterUsage,
} from "~/types/yellowbridge_character";
import { useYellowBridgeIndexes } from "~/hooks/useYellowBridgeIndexes";
import { CharLink } from "./CharCard";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";

interface YellowBridgeDisplayProps {
  character: YellowBridgeCharacter;
}

// Component type configuration with colors matching DongCharacterDisplay
const COMPONENT_TYPE_CONFIG = {
  phonetic: {
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-700",
    textColor: "text-blue-600 dark:text-blue-400",
    label: "Phonetic (Sound)",
  },
  semantic: {
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-700",
    textColor: "text-green-600 dark:text-green-400",
    label: "Semantic (Meaning)",
  },
  primitive: {
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-700",
    textColor: "text-purple-600 dark:text-purple-400",
    label: "Primitive",
  },
  radical: {
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    borderColor: "border-cyan-200 dark:border-cyan-700",
    textColor: "text-cyan-600 dark:text-cyan-400",
    label: "Radical",
  },
} as const;

function ComponentBadge({
  comp,
  componentType
}: {
  comp: ComponentInfo;
  componentType?: keyof typeof COMPONENT_TYPE_CONFIG;
}) {
  const typeConfig = componentType ? COMPONENT_TYPE_CONFIG[componentType] : null;
  const bgColor = typeConfig?.bgColor || "bg-gray-100 dark:bg-gray-700";
  const borderColor = typeConfig?.borderColor || "border-gray-200 dark:border-gray-600";

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${bgColor} ${borderColor} transition-colors hover:shadow-md`}>
      <CharLink
        traditional={comp.character}
        className="text-3xl font-serif dark:text-gray-100 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          {comp.pinyin.length > 0 && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {comp.pinyin.join(', ')}
            </span>
          )}
          {comp.isAltered && (
            <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-1.5 py-0.5 rounded">
              altered
            </span>
          )}
        </div>
        {comp.description && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {comp.description}
          </p>
        )}
      </div>
    </div>
  );
}

function CharacterUsageBadge({ usage, isKnown = true }: { usage: CharacterUsage; isKnown?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-3 py-2 rounded-lg hover:shadow-md transition-all ${!isKnown ? 'opacity-30' : ''}`}
      title={!isKnown ? `${usage.character} (Unknown)` : undefined}
    >
      <CharLink
        traditional={usage.character}
        className="text-2xl font-serif text-gray-900 dark:text-gray-100"
      />
      {usage.isAltered && (
        <span className="text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-1.5 py-0.5 rounded">
          altered
        </span>
      )}
      {usage.pinyin.length > 0 && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {usage.pinyin.join(', ')}
        </span>
      )}
    </div>
  );
}

// Section header component matching DongCharacterDisplay
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">
      {children}
    </h2>
  );
}

// Section wrapper component matching DongCharacterDisplay
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <SectionHeader>{title}</SectionHeader>
      {children}
    </div>
  );
}

export function YellowBridgeDisplay({ character }: YellowBridgeDisplayProps) {
  const { indexes, loading: indexesLoading } = useYellowBridgeIndexes();
  const { characters } = useOutletContext<OutletContext>();

  const hasPhonetic = character.functionalComponents.phonetic.length > 0;
  const hasSemantic = character.functionalComponents.semantic.length > 0;
  const hasPrimitive = character.functionalComponents.primitive.length > 0;
  const hasFormation = character.formationMethods.length > 0;

  // Check if this character is used as a phonetic component in other characters
  const soundComponentEntry = indexes?.soundsComponentIn[character.character];
  const isPhoneticComponent = soundComponentEntry && soundComponentEntry.appearsIn.length > 0;

  // Separate known and unknown characters in the appearsIn list
  const knownCharacters: CharacterUsage[] = [];
  const unknownCharacters: CharacterUsage[] = [];

  if (soundComponentEntry) {
    soundComponentEntry.appearsIn.forEach((usage) => {
      if (characters[usage.character]) {
        knownCharacters.push(usage);
      } else {
        unknownCharacters.push(usage);
      }
    });
  }

  const totalCount = knownCharacters.length + unknownCharacters.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Character Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-5xl font-serif text-gray-900 dark:text-gray-100 mb-3">
              {character.character}
            </h2>
            {character.pinyin.length > 0 && (
              <p className="text-2xl font-medium text-gray-600 dark:text-gray-400 mb-2">
                {character.pinyin.join(', ')}
              </p>
            )}
            {character.definition && (
              <p className="text-lg text-gray-700 dark:text-gray-300">
                {character.definition}
              </p>
            )}
          </div>
          {character.kangxiRadical && (
            <span className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1 rounded text-sm font-medium">
              Radical #{character.kangxiRadical}
            </span>
          )}
        </div>
      </div>

      {/* Phonetic Components */}
      {hasPhonetic && (
        <Section title="Phonetic Components (Sound)">
          <div className="space-y-3">
            {character.functionalComponents.phonetic.map((comp, idx) => (
              <ComponentBadge key={idx} comp={comp} componentType="phonetic" />
            ))}
          </div>
        </Section>
      )}

      {/* Semantic Components */}
      {hasSemantic && (
        <Section title="Semantic Components (Meaning)">
          <div className="space-y-3">
            {character.functionalComponents.semantic.map((comp, idx) => (
              <ComponentBadge key={idx} comp={comp} componentType="semantic" />
            ))}
          </div>
        </Section>
      )}

      {/* Formation Methods */}
      {hasFormation && (
        <Section title="Character Formation">
          <div className="space-y-4">
            {character.formationMethods.map((method, idx) => (
              <div
                key={idx}
                className="border-l-4 border-amber-500 dark:border-amber-400 pl-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-r"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {method.typeEnglish}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({method.typeChinese})
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  {method.description}
                </p>
                {method.referencedCharacters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {method.referencedCharacters.map((char, charIdx) => (
                      <CharLink
                        key={charIdx}
                        traditional={char}
                        className="text-2xl font-serif bg-white dark:bg-gray-700 px-2 py-1 rounded shadow-sm"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Primitive Components */}
      {hasPrimitive && (
        <Section title="Primitive Components">
          <div className="space-y-3">
            {character.functionalComponents.primitive.map((comp, idx) => (
              <ComponentBadge key={idx} comp={comp} componentType="primitive" />
            ))}
          </div>
        </Section>
      )}

      {/* Radical Info */}
      {character.radical && (
        <Section title="Key Radical">
          <ComponentBadge comp={character.radical} componentType="radical" />
          {character.radical.kangxiRadicalNumber && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              Kangxi Radical #{character.radical.kangxiRadicalNumber}
            </p>
          )}
        </Section>
      )}

      {/* Simplification Info */}
      {character.simplification && (
        <Section title="Simplification">
          <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 p-4 rounded-lg">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Simplified form:
              </span>
              <CharLink
                traditional={character.simplification.simplifiedForm}
                className="text-3xl font-serif"
              />
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              {character.simplification.method}
            </p>
            {character.simplification.methodType && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Method: {character.simplification.methodType}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* Used as Phonetic Component */}
      {!indexesLoading && isPhoneticComponent && totalCount > 0 && (
        <Section title={`Used as Phonetic Component in ${knownCharacters.length} known${unknownCharacters.length > 0 ? ` + ${unknownCharacters.length} unknown` : ""} ${totalCount === 1 ? "character" : "characters"}`}>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This character appears as a phonetic (sound) component in the following characters:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Known characters first */}
            {knownCharacters.map((usage, idx) => (
              <CharacterUsageBadge key={`known-${idx}`} usage={usage} isKnown={true} />
            ))}
            {/* Unknown characters second */}
            {unknownCharacters.map((usage, idx) => (
              <CharacterUsageBadge key={`unknown-${idx}`} usage={usage} isKnown={false} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
