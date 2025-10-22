import React from "react";
import type { DongCharacter } from "~/types/dong_character";
import { useDarkMode } from "./DarkModeToggle";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { CharLink } from "./CharCard";
import { HanziText } from "./HanziText";
import { PhraseLink } from "./Phrase";

interface DongCharacterDisplayProps {
  character: DongCharacter;
  filterKnownChars?: boolean;
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
            fill={strokeColors?.[index] || "currentColor"}
            stroke="none"
            className={
              strokeColors?.[index] ? "" : "text-gray-900 dark:text-gray-100"
            }
          />
        ))}
      </g>
    </svg>
  );
}

// Animated version that progressively reveals strokes using masks
interface AnimatedCharacterSVGProps {
  strokes: string[];
  medians: number[][][];
  className?: string;
}

function AnimatedCharacterSVG({
  strokes,
  medians,
  className = "w-full h-full",
}: AnimatedCharacterSVGProps) {
  const { isDarkMode } = useDarkMode();
  const fillColor = isDarkMode ? "#f3f4f6" : "#111827"; // gray-100 / gray-900
  const strokeDuration = 0.5; // seconds per stroke
  const strokeDelay = 0.15; // delay between strokes
  const pauseBeforeLoop = 1.5; // pause at end before restarting (seconds)

  // Calculate total animation duration
  const totalAnimationTime =
    strokes.length * (strokeDuration + strokeDelay) + pauseBeforeLoop;

  // Convert median points to SVG path string
  const medianToPath = (median: number[][]) => {
    if (!median || median.length === 0) return "";
    const start = median[0];
    let path = `M ${start[0]} ${start[1]}`;
    for (let i = 1; i < median.length; i++) {
      path += ` L ${median[i][0]} ${median[i][1]}`;
    }
    return path;
  };

  // Calculate approximate path length for each median
  const getPathLength = (median: number[][]) => {
    let length = 0;
    for (let i = 1; i < median.length; i++) {
      const dx = median[i][0] - median[i - 1][0];
      const dy = median[i][1] - median[i - 1][1];
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  return (
    <svg
      viewBox="-64 -64 1152 1152"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Create a mask for each stroke */}
        {strokes.map((_, index) => {
          const pathLength = medians[index]
            ? getPathLength(medians[index])
            : 1000;
          return (
            <mask key={`mask-${index}`} id={`stroke-mask-${index}`}>
              <path
                d={medianToPath(medians[index])}
                stroke="white"
                strokeWidth="120"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength}
                className={`mask-path${index}`}
              />
            </mask>
          );
        })}
        <style>
          {strokes
            .map((_, index) => {
              const startTime = index * (strokeDuration + strokeDelay);
              const endTime = startTime + strokeDuration;
              const pathLength = medians[index]
                ? getPathLength(medians[index])
                : 1000;

              // Convert times to percentages of total animation
              const startPercent = (startTime / totalAnimationTime) * 100;
              const endPercent = (endTime / totalAnimationTime) * 100;

              return `
              @keyframes revealStroke${index} {
                0%, ${startPercent > 0 ? startPercent - 0.01 : 0}% {
                  stroke-dashoffset: ${pathLength};
                }
                ${startPercent}% {
                  stroke-dashoffset: ${pathLength};
                }
                ${endPercent}% {
                  stroke-dashoffset: 0;
                }
                98% {
                  stroke-dashoffset: 0;
                }
                100% {
                  stroke-dashoffset: ${pathLength};
                }
              }
              @keyframes showStroke${index} {
                0%, ${startPercent > 0 ? startPercent - 0.01 : 0}% {
                  opacity: 0;
                }
                ${startPercent}%, 98% {
                  opacity: 1;
                }
                100% {
                  opacity: 0;
                }
              }
              .mask-path${index} {
                animation: revealStroke${index} ${totalAnimationTime}s linear infinite;
              }
              .stroke-shape${index} {
                animation: showStroke${index} ${totalAnimationTime}s linear infinite;
              }
            `;
            })
            .join("\n")}
        </style>
      </defs>
      <g transform="scale(1, -1) translate(0, -1024)">
        {/* Actual stroke shapes revealed through masks */}
        {strokes.map((stroke, index) => (
          <path
            key={`stroke-${index}`}
            d={stroke}
            fill={fillColor}
            stroke="none"
            mask={`url(#stroke-mask-${index})`}
            className={`stroke-shape${index}`}
          />
        ))}
      </g>
    </svg>
  );
}

// Component type configuration
const COMPONENT_TYPE_CONFIG = {
  deleted: {
    color: "#9ca3af",
    textClass: "text-gray-400",
    label: "Deleted",
  },
  sound: {
    color: "#2563eb",
    textClass: "text-blue-600 dark:text-blue-400",
    label: "Sound",
  },
  iconic: {
    color: "#16a34a",
    textClass: "text-green-600 dark:text-green-400",
    label: "Iconic",
  },
  meaning: {
    color: "#dc2626",
    textClass: "text-red-600 dark:text-red-400",
    label: "Meaning",
  },
  remnant: {
    color: "#9333ea",
    textClass: "text-purple-600 dark:text-purple-400",
    label: "Remnant",
  },
  distinguishing: {
    color: "#0891b2",
    textClass: "text-cyan-600 dark:text-cyan-400",
    label: "Distinguishing",
  },
  simplified: {
    color: "#db2777",
    textClass: "text-pink-600 dark:text-pink-400",
    label: "Simplified",
  },
  unknown: {
    color: "#4b5563",
    textClass: "text-gray-600 dark:text-gray-400",
    label: "Unknown",
  },
} as const;

const DEFAULT_TYPE_CONFIG = {
  color: "#4b5563",
  textClass: "text-gray-600",
  label: "Unknown",
};

// Helper to adjust color brightness
function adjustColorBrightness(hexColor: string, amount: number): string {
  // Convert hex to RGB
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust brightness
  const adjust = (val: number) => Math.max(0, Math.min(255, val + amount));
  const newR = adjust(r);
  const newG = adjust(g);
  const newB = adjust(b);

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

// Helper to get component fill color with variation for duplicates
function getComponentFillColor(
  type: string[],
  variationIndex: number = 0,
): string {
  // Find the first matching type
  const matchingType = Object.keys(COMPONENT_TYPE_CONFIG).find((key) =>
    type.includes(key),
  ) as keyof typeof COMPONENT_TYPE_CONFIG | undefined;

  const baseColor = matchingType
    ? COMPONENT_TYPE_CONFIG[matchingType].color
    : DEFAULT_TYPE_CONFIG.color;

  // Apply variation if needed (each variation gets progressively lighter)
  if (variationIndex > 0) {
    const brightnessAdjust = variationIndex * 35;
    return adjustColorBrightness(baseColor, brightnessAdjust);
  }

  return baseColor;
}

// Helper to get component text color class for a single type
function getSingleTypeTextColor(typeLabel: string): string {
  const matchingType = Object.entries(COMPONENT_TYPE_CONFIG).find(
    ([, config]) => config.label === typeLabel,
  );

  return matchingType
    ? matchingType[1].textClass
    : DEFAULT_TYPE_CONFIG.textClass;
}

// Helper to get component type labels (can be multiple)
function getComponentTypeLabels(type: string[]): string[] {
  return Object.entries(COMPONENT_TYPE_CONFIG)
    .filter(([key]) => type.includes(key))
    .map(([, config]) => config.label);
}

// Helper to create stroke color map
function createStrokeColorMap(
  strokeCount: number,
  color: string,
): { [key: number]: string } {
  return Object.fromEntries(
    Array.from({ length: strokeCount }, (_, i) => [i, color]),
  );
}

// Helper to create stroke color map from indices
function createStrokeColorMapFromIndices(
  indices: number[],
  color: string,
): { [key: number]: string } {
  return Object.fromEntries(indices.map((_, i) => [i, color]));
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
  // Use centralized dark mode state
  const { isDarkMode } = useDarkMode();

  // Use a color that adapts to dark mode
  const backgroundColor = isDarkMode
    ? "#374151" // gray-700 for dark mode
    : "#e5e7eb"; // gray-200 for light mode

  const backgroundColors = createStrokeColorMap(
    strokeData.strokes.length,
    backgroundColor,
  );
  const foregroundColors = createStrokeColorMapFromIndices(
    fragmentIndices,
    fillColor,
  );

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
          strokeColors={foregroundColors}
        />
      </div>
    </div>
  );
}

// HSK Badge component
function HskBadge({ level }: { level: number }) {
  if (level > 9) return null;
  return (
    <span className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1 rounded text-sm font-medium">
      HSK {level}
    </span>
  );
}

// Section header component
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">
      {children}
    </h2>
  );
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <SectionHeader>{title}</SectionHeader>
      {children}
    </div>
  );
}

// CharacterHeader component - displays main character with metadata
interface CharacterHeaderProps {
  character: DongCharacter;
  strokeData?: { strokes: string[]; medians: number[][][] };
  strokeColors: { [key: number]: string };
  bothPinyins: string[];
  onlyModernPinyins: string[];
  onlyOldPinyins: string[];
}

function CharacterHeader({
  character,
  strokeData,
  strokeColors,
  bothPinyins,
  onlyModernPinyins,
  onlyOldPinyins,
}: CharacterHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-8">
          {/* Main Character Display - Colored and Black versions */}
          <div className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            {/* Colored version showing components */}
            <div className="relative w-48 h-48">
              <CharacterDisplay
                strokeData={strokeData}
                fallbackChar={character.char}
                strokeColors={strokeColors}
              />
            </div>

            {/* Black version - Animated */}
            <div className="relative w-48 h-48">
              {strokeData ? (
                <AnimatedCharacterSVG
                  strokes={strokeData.strokes}
                  medians={strokeData.medians}
                />
              ) : (
                <div className="text-9xl font-serif leading-none dark:text-gray-100">
                  {character.char}
                </div>
              )}
            </div>
          </div>

          {/* Character Metadata */}
          <div className="space-y-2">
            {/* Pinyin - show all pronunciations with color coding */}
            <div className="text-2xl font-medium flex flex-wrap gap-2">
              <PinyinList
                pinyins={bothPinyins}
                className="text-gray-800 dark:text-gray-200"
                hasMore={
                  onlyModernPinyins.length > 0 || onlyOldPinyins.length > 0
                }
              />
              <PinyinList
                pinyins={onlyModernPinyins}
                className="text-green-600 dark:text-green-400"
                hasMore={onlyOldPinyins.length > 0}
              />
              <PinyinList
                pinyins={onlyOldPinyins}
                className="text-amber-600 dark:text-amber-400"
                hasMore={false}
              />
            </div>

            {/* Translation */}
            <div className="text-lg text-gray-600 dark:text-gray-400">
              {character.gloss}
            </div>
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
          <span className="text-gray-500 dark:text-gray-400">
            Original meaning:{" "}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {character.originalMeaning}
          </span>
        </div>
      )}

      {/* Etymology/Hint */}
      {character.hint && (
        <div className="mt-4 text-gray-700 dark:text-gray-300 leading-relaxed">
          <HanziText value={character.hint} />
        </div>
      )}
    </div>
  );
}

// ComponentCard component - displays a single component with its info
interface ComponentCardProps {
  component: DongCharacter["components"][number];
  componentChar?: DongCharacter;
  character: DongCharacter;
  strokeData?: { strokes: string[]; medians: number[][][] };
  fragmentIndices: number[];
  fillColor: string;
}

function ComponentCard({
  component,
  componentChar,
  character,
  strokeData,
  fragmentIndices,
  fillColor,
}: ComponentCardProps) {
  // Try to get pinyin from multiple sources
  const pinyin =
    componentChar?.pinyinFrequencies?.[0]?.pinyin ||
    componentChar?.oldPronunciations?.[0]?.pinyin ||
    character.words?.find(
      (w) => w.simp === component.character || w.trad === component.character,
    )?.items?.[0]?.pinyin;

  // Extract descriptive part from hint
  let hintDescription = "";
  if (component.hint) {
    const match = component.hint.match(/Depicts (?:an? )?(.*?)\.?$/);
    if (match) {
      hintDescription = match[1];
    }
  }

  // Combine hint and gloss
  let displayText = componentChar?.gloss || "";
  if (hintDescription && displayText) {
    displayText = `(${hintDescription}), ${displayText}`;
  } else if (hintDescription) {
    displayText = `(${hintDescription})`;
  }

  return (
    <div className="flex items-start gap-4 p-4 transition-colors">
      {/* Component character with colored overlay */}
      <div className="relative w-24 h-24 flex-shrink-0">
        {strokeData && fragmentIndices.length > 0 ? (
          <LayeredCharacter
            strokeData={strokeData}
            fragmentIndices={fragmentIndices}
            fillColor={fillColor}
          />
        ) : (
          <div className="text-6xl font-serif leading-none opacity-20 absolute inset-0 flex items-center justify-center">
            {character.char}
          </div>
        )}
      </div>

      {/* Component info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <CharLink
            traditional={component.character}
            className="text-3xl font-serif dark:text-gray-100"
          />
          <span className="text-sm font-medium dark:text-gray-300">
            {getComponentTypeLabels(component.type).map((label, idx) => (
              <span key={idx} className={getSingleTypeTextColor(label)}>
                {label}{" "}
              </span>
            ))}
            {component.type.includes("deleted") ? "" : "component"}
          </span>
        </div>
        <div className="text-gray-600 dark:text-gray-400 mb-2">
          {pinyin && <span className="mr-2 font-medium">{pinyin}</span>}
          <span>{displayText}</span>
        </div>
        {component.hint && (
          <div className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            <HanziText value={component.hint} />
          </div>
        )}
        {component.isOldPronunciation && (
          <div className="mb-2">
            <InfoBox type="warning">
              <div className="mb-1">
                {character.char} and {component.character} don&apos;t sound
                similar in modern Mandarin due to historical phonetic changes.
                They were more similar in older Chinese.
              </div>
              {character.oldPronunciations &&
                character.oldPronunciations.length > 0 && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                    <div>
                      {character.char}{" "}
                      {character.oldPronunciations
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        .map((op: { OC: string }) => op.OC)
                        .join(", ")}
                    </div>
                    {componentChar?.oldPronunciations &&
                      componentChar.oldPronunciations.length > 0 && (
                        <div>
                          {component.character}{" "}
                          {componentChar.oldPronunciations
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            .map((op: { OC: string }) => op.OC)
                            .join(", ")}
                        </div>
                      )}
                  </div>
                )}
            </InfoBox>
          </div>
        )}
        {component.isGlyphChanged && (
          <InfoBox type="info">
            Due to historical stylistic changes, this component is less similar
            to {component.character} than it was in ancient scripts.
          </InfoBox>
        )}
        {component.isFromOriginalMeaning && character.originalMeaning && (
          <InfoBox type="info">
            {component.character} hints at the original meaning of{" "}
            {character.char}, &quot;{character.originalMeaning}&quot;, which is
            no longer the most common meaning of {character.char} in modern
            Mandarin.
          </InfoBox>
        )}
      </div>
    </div>
  );
}

// CommonWordsSection component - displays common words containing the character
interface CommonWordsSectionProps {
  topWords?: DongCharacter["statistics"]["topWords"];
}

function CommonWordsSection({ topWords }: CommonWordsSectionProps) {
  if (!topWords) return null;

  return (
    <Section title="Common Words">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {topWords.slice(0, 12).map((word, index) => (
          <div
            key={index}
            className="flex items-baseline gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <span className="font-medium text-lg whitespace-nowrap dark:text-gray-100">
              <PhraseLink value={word.trad} />
            </span>
            <span className="text-gray-600 dark:text-gray-400 text-sm">
              {word.gloss}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto whitespace-nowrap">
              {(word.share * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// HistoricalPronunciationsSection component - displays old pronunciations
interface HistoricalPronunciationsSectionProps {
  oldPronunciations?: DongCharacter["oldPronunciations"];
}

function HistoricalPronunciationsSection({
  oldPronunciations,
}: HistoricalPronunciationsSectionProps) {
  if (!oldPronunciations || oldPronunciations.length === 0) return null;

  return (
    <Section title="Historical Pronunciations">
      <div className="space-y-4">
        {oldPronunciations.map((op, index) => (
          <div
            key={index}
            className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-medium text-blue-700 dark:text-blue-400">
                {op.pinyin}
              </span>
              {op.gloss && (
                <span className="text-gray-600 dark:text-gray-400">
                  &quot;{op.gloss}&quot;
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {op.MC && (
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Middle Chinese:{" "}
                  </span>
                  <span className="font-mono text-gray-600 dark:text-gray-400">
                    {op.MC}
                  </span>
                </div>
              )}
              {op.OC && (
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Old Chinese:{" "}
                  </span>
                  <span className="font-mono text-gray-600 dark:text-gray-400">
                    {op.OC}
                  </span>
                </div>
              )}
            </div>
            {op.source && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Source: {op.source}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// InfoBox component for warnings and information messages
interface InfoBoxProps {
  type?: "info" | "warning";
  children: React.ReactNode;
}

function InfoBox({ type = "info", children }: InfoBoxProps) {
  const bgColor =
    type === "warning"
      ? "bg-orange-50 dark:bg-orange-950"
      : "bg-blue-50 dark:bg-blue-950";
  const borderColor =
    type === "warning"
      ? "border-orange-200 dark:border-orange-800"
      : "border-blue-200 dark:border-blue-800";
  const iconColor =
    type === "warning"
      ? "text-orange-600 dark:text-orange-400"
      : "text-blue-600 dark:text-blue-400";
  const icon = type === "warning" ? "⚠" : "ⓘ";

  return (
    <div
      className={`${bgColor} border ${borderColor} rounded p-2 text-sm text-gray-700 dark:text-gray-300`}
    >
      <div className="flex gap-2">
        <span className={`${iconColor} flex-shrink-0`}>{icon}</span>
        <div>{children}</div>
      </div>
    </div>
  );
}

// Helper component for rendering pinyin lists with color coding
interface PinyinListProps {
  pinyins: string[];
  className: string;
  hasMore: boolean;
}

function PinyinList({ pinyins, className, hasMore }: PinyinListProps) {
  return (
    <>
      {pinyins.map((p, i) => (
        <span key={i} className={className}>
          {p}
          {i < pinyins.length - 1 || hasMore ? "," : ""}
        </span>
      ))}
    </>
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
  const grouped = words.reduce(
    (acc, word) => {
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
    },
    {} as Record<
      string,
      { char: string; pinyin: string; definitions: string[] }
    >,
  );

  // Filter out groups with no definitions
  const groupsWithDefinitions = Object.values(grouped).filter(
    (group) => group.definitions.length > 0,
  );

  // Don't render the section if there are no groups with definitions
  if (groupsWithDefinitions.length === 0) return null;

  return (
    <Section title={title}>
      <div className="space-y-4">
        {groupsWithDefinitions.map((group, index) => (
          <div key={index}>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-4xl font-serif text-blue-700 dark:text-blue-400">
                {group.char}
              </span>
              <span className="text-xl text-gray-600 dark:text-gray-400">
                {group.pinyin}
              </span>
            </div>
            <div className="text-gray-700 dark:text-gray-300 ml-2">
              {group.definitions.join("; ")}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// Component Details section - displays detailed information about character components
interface ComponentDetailsSectionProps {
  chars?: DongCharacter["chars"];
}

function ComponentDetailsSection({ chars }: ComponentDetailsSectionProps) {
  if (!chars || chars.length === 0) {
    return null;
  }

  const hasDetails = chars.some(
    (c) =>
      c.shuowen ||
      (c.variants && c.variants.length > 0) ||
      (c.comments && c.comments.length > 0),
  );

  if (!hasDetails) return null;

  return (
    <Section title="Component Details">
      <div className="space-y-6">
        {chars.map((componentChar, index) => {
          const hasShuowen = componentChar.shuowen;
          const hasVariants =
            componentChar.variants && componentChar.variants.length > 0;
          const hasComments =
            componentChar.comments && componentChar.comments.length > 0;

          if (!hasShuowen && !hasVariants && !hasComments) return null;

          return (
            <div
              key={index}
              className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl font-serif dark:text-gray-100">
                  {componentChar.char}
                </span>
                <div>
                  <div className="font-medium text-lg dark:text-gray-200">
                    {componentChar.gloss}
                  </div>
                  {componentChar.pinyinFrequencies &&
                    componentChar.pinyinFrequencies[0] && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {componentChar.pinyinFrequencies[0].pinyin}
                      </div>
                    )}
                </div>
              </div>

              {hasShuowen && (
                <div className="mb-3">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    說文解字 (Shuowen Jiezi):
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border-l-2 border-amber-500">
                    {componentChar.shuowen}
                  </div>
                </div>
              )}

              {hasVariants && (
                <div className="mb-3">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Variants:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(componentChar.variants || []).map((variant, vIdx) => (
                      <div
                        key={vIdx}
                        className="bg-white dark:bg-gray-800 px-3 py-1 rounded border dark:border-gray-600 text-sm"
                      >
                        <span className="font-serif text-lg mr-2 dark:text-gray-100">
                          {variant.char}
                        </span>
                        {variant.parts && (
                          <span className="text-gray-600 dark:text-gray-400">
                            ({variant.parts})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasComments && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Scholarly Notes:
                  </div>
                  <div className="space-y-2">
                    {(componentChar.comments || []).map((comment, cIdx) => (
                      <div
                        key={cIdx}
                        className="text-sm bg-white dark:bg-gray-800 p-2 rounded border-l-2 border-green-500"
                      >
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {comment.source}
                        </div>
                        <div className="text-gray-800 dark:text-gray-200">
                          {comment.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// Component In section - displays characters that use this character as a component
interface ComponentInSectionProps {
  character: DongCharacter;
  filterKnownChars: boolean;
  characters: Record<string, unknown>;
}

function ComponentInSection({
  character,
  filterKnownChars,
  characters,
}: ComponentInSectionProps) {
  if (!character.componentIn || character.componentIn.length === 0) {
    return null;
  }

  // Helper to filter components by type
  const getComponentsByType = (typeToFind: string) =>
    (character.componentIn || []).filter((item) =>
      item.components
        .find((c) => c.character === character.char)
        ?.type.includes(typeToFind),
    );

  // Group componentIn by type
  const meaningComponents = getComponentsByType("meaning");
  const soundComponents = getComponentsByType("sound");
  const iconicComponents = getComponentsByType("iconic");
  const unknownComponents = getComponentsByType("unknown");
  const remnantComponents = getComponentsByType("remnant");
  const simplifiedComponents = getComponentsByType("simplified");
  const deletedComponents = getComponentsByType("deleted");
  const distinguishingComponents = getComponentsByType("distinguishing");

  const renderComponentSection = (
    items: typeof character.componentIn,
    title: string,
  ) => {
    if (!items || items.length === 0) return null;

    // Separate known and unknown characters
    const knownItems = items.filter((item) => characters[item.char]);
    const unknownItems = items.filter((item) => !characters[item.char]);

    // If filtering is enabled and there are no known items, don't show the section
    if (filterKnownChars && knownItems.length === 0) return null;

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
      <Section
        title={`${title} ${knownItems.length} known${unknownItems.length > 0 ? ` + ${unknownItems.length} unknown` : ""} (${verifiedCount} verified)`}
      >
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
          {sortedItems.map((item, index) => {
            const isKnown = characters[item.char];
            return (
              <CharLink
                key={index}
                traditional={item.char}
                className={`flex flex-col items-center p-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!isKnown ? "opacity-30" : ""}`}
                title={`${item.char}${!isKnown ? " (Unknown)" : ""}`}
              >
                <div className="text-5xl font-serif mb-2 dark:text-gray-100">
                  {item.char}
                </div>
                {item.statistics?.bookCharCount && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {item.statistics.bookCharCount.toLocaleString()} uses
                  </div>
                )}
                {item.isVerified && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Verified
                  </div>
                )}
              </CharLink>
            );
          })}
        </div>
      </Section>
    );
  };

  return (
    <>
      {renderComponentSection(meaningComponents, "Meaning component in")}
      {renderComponentSection(soundComponents, "Sound component in")}
      {renderComponentSection(iconicComponents, "Iconic component in")}
      {renderComponentSection(unknownComponents, "Unknown component in")}
      {renderComponentSection(remnantComponents, "Remnant component in")}
      {renderComponentSection(simplifiedComponents, "Simplified component in")}
      {renderComponentSection(deletedComponents, "Deleted component in")}
      {renderComponentSection(
        distinguishingComponents,
        "Distinguishing component in",
      )}
    </>
  );
}

export function DongCharacterDisplay({
  character,
  filterKnownChars = false,
}: DongCharacterDisplayProps) {
  console.log(character);

  // Get known characters from context
  const { characters } = useOutletContext<OutletContext>();

  // Create variation indices for components of the same type
  const componentVariationIndices: number[] = [];
  const typeCounters = new Map<string, number>();

  character.components.forEach((component) => {
    // Create a type key (sorted to ensure consistency)
    const typeKey = [...component.type].sort().join(",");
    const currentIndex = typeCounters.get(typeKey) || 0;
    componentVariationIndices.push(currentIndex);
    typeCounters.set(typeKey, currentIndex + 1);
  });

  // Get all pronunciations with categorization
  const modernPinyins = new Set(
    character.pinyinFrequencies?.map((freq) => freq.pinyin) || [],
  );
  const oldPinyins = new Set(
    character.oldPronunciations?.map((op) => op.pinyin) || [],
  );

  // Categorize pronunciations
  const bothPinyins: string[] = [];
  const onlyModernPinyins: string[] = [];
  const onlyOldPinyins: string[] = [];

  modernPinyins.forEach((p) => {
    if (oldPinyins.has(p)) {
      bothPinyins.push(p);
    } else {
      onlyModernPinyins.push(p);
    }
  });

  oldPinyins.forEach((p) => {
    if (!modernPinyins.has(p)) {
      onlyOldPinyins.push(p);
    }
  });

  // Prepare stroke colors for header
  const strokeData = getStrokeData(character);
  const mainCharImage = character.images.find((img) => img.data);
  const fragments = mainCharImage?.fragments || [];

  // Create a map of stroke index to color for colored version
  const strokeColors: { [key: number]: string } = {};
  fragments.forEach((fragmentIndices, componentIndex) => {
    const component = character.components[componentIndex];
    if (component) {
      const variationIndex = componentVariationIndices[componentIndex];
      const color = getComponentFillColor(component.type, variationIndex);
      fragmentIndices.forEach((strokeIndex) => {
        strokeColors[strokeIndex] = color;
      });
    }
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <CharacterHeader
        character={character}
        strokeData={strokeData}
        strokeColors={strokeColors}
        bothPinyins={bothPinyins}
        onlyModernPinyins={onlyModernPinyins}
        onlyOldPinyins={onlyOldPinyins}
      />

      {/* Components Section */}
      {character.components && character.components.length > 0 && (
        <Section title="Components">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {character.components.map((component, index) => {
              const componentChar = character.chars?.find(
                (c) => c.char === component.character,
              );
              const fragmentIndices = mainCharImage?.fragments?.[index] || [];
              const variationIndex = componentVariationIndices[index];
              const fillColor = getComponentFillColor(
                component.type,
                variationIndex,
              );

              return (
                <ComponentCard
                  key={index}
                  component={component}
                  componentChar={componentChar}
                  character={character}
                  strokeData={strokeData}
                  fragmentIndices={fragmentIndices}
                  fillColor={fillColor}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Component In - Characters that use this character as a component */}
      <ComponentInSection
        character={character}
        filterKnownChars={filterKnownChars}
        characters={characters}
      />

      {/* Evolution Section */}
      {character.images.length > 0 &&
        (() => {
          // Don't show evolution if there's only one modern image
          if (character.images.length === 1) {
            const singleImage = character.images[0];
            if (
              singleImage.type === "Regular" &&
              singleImage.era === "Modern"
            ) {
              return null;
            }
          }

          return (
            <Section title="Evolution">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {character.images.map((img, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center text-center"
                  >
                    {/* Historical character image or SVG */}
                    <div className="w-32 h-32 flex items-center justify-center mb-2 bg-gray-50 dark:bg-gray-700 rounded p-2">
                      {img.url ? (
                        <img
                          src={img.url}
                          alt={`${img.type} script`}
                          className="max-w-full max-h-full object-contain dark:invert"
                        />
                      ) : img.data ? (
                        <CharacterSVG strokes={img.data.strokes} />
                      ) : (
                        <div className="text-4xl font-serif dark:text-gray-100">
                          {character.char}
                        </div>
                      )}
                    </div>

                    {/* Script type */}
                    <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                      {img.type}
                    </div>

                    {/* Era */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {img.era}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          );
        })()}

      {/* Additional Information */}
      <CommonWordsSection topWords={character.statistics.topWords} />

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

      {/* Component Details Section */}
      <ComponentDetailsSection chars={character.chars} />

      {/* Pronunciation variants */}
      {character.pinyinFrequencies &&
        character.pinyinFrequencies.length > 1 && (
          <Section title="Pronunciations">
            <div className="space-y-2">
              {character.pinyinFrequencies.map((freq, index) => (
                <div key={index} className="flex items-baseline gap-3">
                  <span className="font-medium text-lg dark:text-gray-100">
                    {freq.pinyin}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    ({freq.count} occurrences)
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

      {/* Old Pronunciations Section */}
      <HistoricalPronunciationsSection
        oldPronunciations={character.oldPronunciations}
      />
    </div>
  );
}
