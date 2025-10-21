import React, { useState } from "react";
import type { DongCharacter } from "~/types/dong_character";

interface DongCharacterDisplayProps {
  character: DongCharacter;
}

// Helper component for rendering SVG character
interface CharacterSVGProps {
  strokes: string[];
  strokeColors?: { [key: number]: string };
  className?: string;
}

function CharacterSVG({
  strokes,
  strokeColors,
  className = "w-full h-full",
}: CharacterSVGProps) {
  return (
    <svg
      viewBox="-64 -64 1152 1152"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="scale(1, -1) translate(0, -1024)">
        {strokes.map((stroke, index) => (
          <path
            key={index}
            d={stroke}
            fill={strokeColors?.[index] || "black"}
            stroke="none"
          />
        ))}
      </g>
    </svg>
  );
}

// Helper to get component fill color
function getComponentFillColor(type: string[]): string {
  if (type.includes("deleted")) return "#9ca3af"; // gray-400 (lighter for deleted)
  if (type.includes("sound")) return "#2563eb"; // blue-600
  if (type.includes("iconic")) return "#16a34a"; // green-600
  if (type.includes("meaning")) return "#dc2626"; // red-600
  if (type.includes("remnant")) return "#9333ea"; // purple-600
  return "#4b5563"; // gray-600
}

// Helper to get component text color class for a single type
function getSingleTypeTextColor(typeLabel: string): string {
  if (typeLabel === "Deleted") return "text-gray-400";
  if (typeLabel === "Sound") return "text-blue-600";
  if (typeLabel === "Iconic") return "text-green-600";
  if (typeLabel === "Meaning") return "text-red-600";
  if (typeLabel === "Remnant") return "text-purple-600";
  return "text-gray-600";
}

// Helper to get component text color class
function getComponentTextColor(type: string[]): string {
  if (type.includes("deleted")) return "text-gray-400";
  if (type.includes("sound")) return "text-blue-600";
  if (type.includes("iconic")) return "text-green-600";
  if (type.includes("meaning")) return "text-red-600";
  if (type.includes("remnant")) return "text-purple-600";
  return "text-gray-600";
}

// Helper to get component type labels (can be multiple)
function getComponentTypeLabels(type: string[]): string[] {
  const labels: string[] = [];
  if (type.includes("deleted")) labels.push("Deleted");
  if (type.includes("sound")) labels.push("Sound");
  if (type.includes("iconic")) labels.push("Iconic");
  if (type.includes("meaning")) labels.push("Meaning");
  if (type.includes("remnant")) labels.push("Remnant");
  return labels;
}

// Helper to get stroke data from character
function getStrokeData(
  character: DongCharacter,
): { strokes: string[]; medians: number[][][] } | undefined {
  return character.data || character.images.find((img) => img.data)?.data;
}

// Component for rendering character (SVG or fallback text)
interface CharacterDisplayProps {
  strokeData?: { strokes: string[]; medians: number[][][] };
  fallbackChar: string;
  strokeColors?: { [key: number]: string };
  className?: string;
  fallbackClassName?: string;
}

function CharacterDisplay({
  strokeData,
  fallbackChar,
  strokeColors,
  className = "w-full h-full",
  fallbackClassName = "text-9xl font-serif leading-none",
}: CharacterDisplayProps) {
  return strokeData ? (
    <CharacterSVG
      strokes={strokeData.strokes}
      strokeColors={strokeColors}
      className={className}
    />
  ) : (
    <div className={fallbackClassName}>{fallbackChar}</div>
  );
}

// Component for layered character display (background + highlighted strokes)
interface LayeredCharacterProps {
  strokeData: { strokes: string[]; medians: number[][][] };
  fragmentIndices: number[];
  fillColor: string;
}

function LayeredCharacter({
  strokeData,
  fragmentIndices,
  fillColor,
}: LayeredCharacterProps) {
  const backgroundColors: { [key: number]: string } = {};
  strokeData.strokes.forEach((_, strokeIndex) => {
    backgroundColors[strokeIndex] = "#e5e7eb";
  });

  return (
    <div className="relative w-full h-full">
      {/* Background layer */}
      <CharacterSVG
        strokes={strokeData.strokes}
        strokeColors={backgroundColors}
      />
      {/* Foreground layer - highlighted component */}
      <div className="absolute inset-0">
        <CharacterSVG
          strokes={fragmentIndices.map((i) => strokeData.strokes[i])}
          strokeColors={Object.fromEntries(
            fragmentIndices.map((_, i) => [i, fillColor]),
          )}
        />
      </div>
    </div>
  );
}

// HSK Badge component
function HskBadge({ level }: { level: number }) {
  if (level > 9) return null;
  return (
    <span className="bg-black text-white px-3 py-1 rounded text-sm font-medium">
      HSK {level}
    </span>
  );
}

// Section header component
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
      {children}
    </h2>
  );
}

// Definitions section component
interface DefinitionsSectionProps {
  title: string;
  words: Array<{
    simp: string;
    trad: string;
    items: Array<{
      pinyin: string;
      definitions?: string[];
    }>;
  }>;
}

function DefinitionsSection({ title, words }: DefinitionsSectionProps) {
  if (words.length === 0) return null;

  // Group by character and pinyin
  const grouped = words.reduce((acc, word) => {
    word.items.forEach((item) => {
      const key = `${word.trad}|${item.pinyin}`;
      if (!acc[key]) {
        acc[key] = {
          char: word.trad,
          pinyin: item.pinyin,
          definitions: [],
        };
      }
      if (item.definitions) {
        acc[key].definitions.push(...item.definitions);
      }
    });
    return acc;
  }, {} as Record<string, { char: string; pinyin: string; definitions: string[] }>);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <SectionHeader>{title}</SectionHeader>
      <div className="space-y-4">
        {Object.values(grouped).map((group, index) => (
          <div key={index}>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-4xl font-serif text-blue-700">
                {group.char}
              </span>
              <span className="text-xl text-gray-600">{group.pinyin}</span>
            </div>
            {group.definitions.length > 0 && (
              <div className="text-gray-700 ml-2">
                {group.definitions.join("; ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DongCharacterDisplay({ character }: DongCharacterDisplayProps) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  console.log(character);

  // Get all pronunciations
  const allPinyins =
    character.pinyinFrequencies && character.pinyinFrequencies.length > 0
      ? character.pinyinFrequencies.map((freq) => freq.pinyin)
      : [];

  // Generate Dong Chinese dictionary URL
  const dongChineseUrl = `https://www.dong-chinese.com/dictionary/search/${encodeURIComponent(character.char)}`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-8">
            {/* Main Character Display - Colored and Black versions */}
            <a
              href={dongChineseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 hover:opacity-80 transition-opacity"
              title="View on Dong Chinese"
            >
              {(() => {
                const strokeData = getStrokeData(character);
                const mainCharImage = character.images.find((img) => img.data);
                const fragments = mainCharImage?.fragments || [];

                // Create a map of stroke index to color for colored version
                const strokeColors: { [key: number]: string } = {};
                fragments.forEach((fragmentIndices, componentIndex) => {
                  const component = character.components[componentIndex];
                  if (component) {
                    const color = getComponentFillColor(component.type);
                    fragmentIndices.forEach((strokeIndex) => {
                      strokeColors[strokeIndex] = color;
                    });
                  }
                });

                return (
                  <>
                    {/* Colored version showing components */}
                    <div className="relative w-48 h-48">
                      <CharacterDisplay
                        strokeData={strokeData}
                        fallbackChar={character.char}
                        strokeColors={strokeColors}
                      />
                    </div>

                    {/* Black version */}
                    <div className="relative w-48 h-48">
                      <CharacterDisplay
                        strokeData={strokeData}
                        fallbackChar={character.char}
                      />
                      {/* Show components overlay when hovering */}
                      {activeComponent && (
                        <div className="absolute inset-0 pointer-events-none">
                          {/* This would show the highlighted component */}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </a>

            {/* Character Metadata */}
            <div className="space-y-2">
              {/* Pinyin - show all pronunciations */}
              <div className="text-2xl font-medium text-gray-700">
                {allPinyins.join(", ")}
              </div>

              {/* Translation */}
              <div className="text-lg text-gray-600">{character.gloss}</div>
            </div>
          </div>

          {/* HSK Badge */}
          <div>
            <HskBadge level={character.statistics.hskLevel} />
          </div>
        </div>

        {/* Original Meaning */}
        {character.originalMeaning && (
          <div className="mt-6">
            <span className="text-gray-500">Original meaning: </span>
            <span className="text-gray-700">{character.originalMeaning}</span>
          </div>
        )}

        {/* Etymology/Hint */}
        {character.hint && (
          <div className="mt-4 text-gray-700 leading-relaxed">
            {character.hint}
          </div>
        )}
      </div>

      {/* Components Section */}
      {character.components && character.components.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <SectionHeader>Components</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.components.map((component, index) => {
              const componentChar = character.chars?.find(
                (c) => c.char === component.character,
              );
              const strokeData = getStrokeData(character);
              const mainCharImage = character.images.find((img) => img.data);
              const fragmentIndices = mainCharImage?.fragments?.[index] || [];
              const fillColor = getComponentFillColor(component.type);

              return (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onMouseEnter={() => setActiveComponent(component.character)}
                  onMouseLeave={() => setActiveComponent(null)}
                >
                  {/* Component character with colored overlay */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    {strokeData && fragmentIndices.length > 0 ? (
                      <LayeredCharacter
                        strokeData={strokeData}
                        fragmentIndices={fragmentIndices}
                        fillColor={fillColor}
                      />
                    ) : (
                      <>
                        <div className="text-6xl font-serif leading-none opacity-20 absolute inset-0 flex items-center justify-center">
                          {character.char}
                        </div>
                        {/*<div
                        className={`absolute inset-0 text-6xl font-serif leading-none ${getComponentTextColor(
                          component.type,
                        )} flex items-center justify-center`}
                      >
                        {component.character}
                      </div>*/}
                      </>
                    )}
                  </div>

                  {/* Component info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-serif">
                        {component.character}
                      </span>
                      <span className="text-sm font-medium">
                        {getComponentTypeLabels(component.type).map((label, idx) => (
                          <span
                            key={idx}
                            className={getSingleTypeTextColor(label)}
                          >
                            {label}{" "}
                          </span>
                        ))}
                        {component.type.includes("deleted") ? "" : "component"}
                      </span>
                    </div>
                    <div className="text-gray-600 mb-2">
                      {componentChar?.pinyinFrequencies?.[0]?.pinyin && (
                        <span className="mr-2">
                          {componentChar.pinyinFrequencies[0].pinyin}
                        </span>
                      )}
                      <span>{componentChar?.gloss}</span>
                    </div>
                    {component.hint && (
                      <div className="text-gray-600 text-sm mb-2">
                        {component.hint}
                      </div>
                    )}
                    {component.isOldPronunciation && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-2 text-sm text-gray-700 mb-2">
                        <div className="flex gap-2">
                          <span className="text-orange-600 flex-shrink-0">⚠</span>
                          <div>
                            <div className="mb-1">
                              {character.char} and {component.character} don't sound
                              similar in modern Mandarin due to historical phonetic
                              changes. They were more similar in older Chinese.
                            </div>
                            {character.oldPronunciations &&
                              character.oldPronunciations.length > 0 && (
                                <div className="text-xs text-gray-600 space-y-1 mt-2">
                                  <div>
                                    {character.char}{" "}
                                    {character.oldPronunciations
                                      .map((op) => op.OC)
                                      .join(", ")}
                                  </div>
                                  {componentChar?.oldPronunciations &&
                                    componentChar.oldPronunciations.length > 0 && (
                                      <div>
                                        {component.character}{" "}
                                        {componentChar.oldPronunciations
                                          .map((op) => op.OC)
                                          .join(", ")}
                                      </div>
                                    )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                    {component.isGlyphChanged && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-gray-700">
                        <div className="flex gap-2">
                          <span className="text-blue-600 flex-shrink-0">ⓘ</span>
                          <span>
                            Due to historical stylistic changes, this component is
                            less similar to {component.character} than it was in
                            ancient scripts.
                          </span>
                        </div>
                      </div>
                    )}
                    {component.isFromOriginalMeaning && character.originalMeaning && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-gray-700">
                        <div className="flex gap-2">
                          <span className="text-blue-600 flex-shrink-0">ⓘ</span>
                          <span>
                            {component.character} hints at the original meaning of{" "}
                            {character.char}, &quot;{character.originalMeaning}&quot;, which is
                            no longer the most common meaning of {character.char} in
                            modern Mandarin.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evolution Section */}
      {character.images.length > 0 && (() => {
        // Don't show evolution if there's only one modern image
        if (character.images.length === 1) {
          const singleImage = character.images[0];
          if (singleImage.type === "Regular" && singleImage.era === "Modern") {
            return null;
          }
        }

        return (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SectionHeader>Evolution</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {character.images.map((img, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center"
              >
                {/* Historical character image or SVG */}
                <div className="w-32 h-32 flex items-center justify-center mb-2 bg-gray-50 rounded p-2">
                  {img.url ? (
                    <img
                      src={img.url}
                      alt={`${img.type} script`}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : img.data ? (
                    <CharacterSVG strokes={img.data.strokes} />
                  ) : (
                    <div className="text-4xl font-serif">{character.char}</div>
                  )}
                </div>

                {/* Script type */}
                <div className="font-medium text-sm text-gray-800">
                  {img.type}
                </div>

                {/* Era */}
                <div className="text-xs text-gray-500 mt-1">{img.era}</div>
              </div>
            ))}
          </div>
          </div>
        );
      })()}

      {/* Additional Information */}
      {character.statistics.topWords && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <SectionHeader>Common Words</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {character.statistics.topWords.slice(0, 12).map((word, index) => (
              <div
                key={index}
                className="flex items-baseline gap-2 p-2 hover:bg-gray-50 rounded transition-colors"
              >
                <span className="font-medium text-lg whitespace-nowrap">{word.trad}</span>
                <span className="text-gray-600 text-sm">{word.gloss}</span>
                <span className="text-gray-400 text-xs ml-auto whitespace-nowrap">
                  {(word.share * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Definitions Section - Only for main character */}
      <DefinitionsSection
        title="Definitions"
        words={
          character.words?.filter(
            (word) =>
              word.simp === character.char || word.trad === character.char,
          ) || []
        }
      />

      {/* Component Definitions Section */}
      <DefinitionsSection
        title="Component Definitions"
        words={
          character.words?.filter(
            (word) =>
              word.simp !== character.char && word.trad !== character.char,
          ) || []
        }
      />

      {/* Pronunciation variants */}
      {character.pinyinFrequencies &&
        character.pinyinFrequencies.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SectionHeader>Pronunciations</SectionHeader>
            <div className="space-y-2">
              {character.pinyinFrequencies.map((freq, index) => (
                <div key={index} className="flex items-baseline gap-3">
                  <span className="font-medium text-lg">{freq.pinyin}</span>
                  <span className="text-gray-500 text-sm">
                    ({freq.count} occurrences)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Component In - Characters that use this character as a component */}
      {character.componentIn &&
        character.componentIn.length > 0 &&
        (() => {
          // Group componentIn by type
          const meaningComponents = character.componentIn.filter((item) =>
            item.components
              .find((c) => c.character === character.char)
              ?.type.includes("meaning"),
          );
          const soundComponents = character.componentIn.filter((item) =>
            item.components
              .find((c) => c.character === character.char)
              ?.type.includes("sound"),
          );
          const iconicComponents = character.componentIn.filter((item) =>
            item.components
              .find((c) => c.character === character.char)
              ?.type.includes("iconic"),
          );
          const unknownComponents = character.componentIn.filter((item) =>
            item.components
              .find((c) => c.character === character.char)
              ?.type.includes("unknown"),
          );
          const remnantComponents = character.componentIn.filter((item) =>
            item.components
              .find((c) => c.character === character.char)
              ?.type.includes("remnant"),
          );

          const renderComponentSection = (
            items: typeof character.componentIn,
            title: string,
          ) => {
            if (!items || items.length === 0) return null;

            const verifiedCount = items.filter(
              (item) => item.isVerified === true,
            ).length;

            // Sort by bookCharCount in descending order
            const sortedItems = [...items].sort((a, b) => {
              const aCount = a.statistics?.bookCharCount || 0;
              const bCount = b.statistics?.bookCharCount || 0;
              return bCount - aCount;
            });

            return (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <SectionHeader>
                  {title} {items.length} character
                  {items.length !== 1 ? "s" : ""} ({verifiedCount} verified)
                </SectionHeader>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
                  {sortedItems.map((item, index) => (
                    <a
                      key={index}
                      href={`https://www.dong-chinese.com/dictionary/search/${encodeURIComponent(item.char)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center p-0 hover:bg-gray-50 transition-colors"
                      title={`${item.char} - View on Dong Chinese`}
                    >
                      <div className="text-5xl font-serif mb-2">
                        {item.char}
                      </div>
                      {item.statistics?.bookCharCount && (
                        <div className="text-xs text-gray-500 text-center">
                          {item.statistics.bookCharCount.toLocaleString()} uses
                        </div>
                      )}
                      {item.isVerified && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ Verified
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          };

          return (
            <>
              {renderComponentSection(
                meaningComponents,
                "Meaning component in",
              )}
              {renderComponentSection(soundComponents, "Sound component in")}
              {renderComponentSection(iconicComponents, "Iconic component in")}
              {renderComponentSection(unknownComponents, "Unknown component in")}
              {renderComponentSection(remnantComponents, "Remnant component in")}
            </>
          );
        })()}
    </div>
  );
}
