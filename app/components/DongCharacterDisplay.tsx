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
      viewBox="0 0 1024 1024"
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
  if (type.includes("sound")) return "#2563eb"; // blue-600
  if (type.includes("iconic")) return "#16a34a"; // green-600
  return "#4b5563"; // gray-600
}

// Helper to get component text color class
function getComponentTextColor(type: string[]): string {
  if (type.includes("sound")) return "text-blue-600";
  if (type.includes("iconic")) return "text-green-600";
  return "text-gray-600";
}

// Helper to get stroke data from character
function getStrokeData(
  character: DongCharacter
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
            fragmentIndices.map((_, i) => [i, fillColor])
          )}
        />
      </div>
    </div>
  );
}

// Audio button component
function AudioButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      onClick={onClick}
    >
      <svg
        className="w-6 h-6 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m0-7.072a5 5 0 00-1.414 1.414M12 8v8m0 0l-3-3m3 3l3-3"
        />
      </svg>
    </button>
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

export function DongCharacterDisplay({ character }: DongCharacterDisplayProps) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  // Get the primary pinyin
  const primaryPinyin =
    character.pinyinFrequencies.length > 0
      ? character.pinyinFrequencies[0].pinyin
      : "";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-8">
            {/* Main Character Display - Colored and Black versions */}
            <div className="flex items-center gap-4">
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
            </div>

            {/* Character Metadata */}
            <div className="space-y-2">
              <AudioButton
                onClick={() => {
                  // Audio playback would go here
                  console.log("Play audio for:", character.char);
                }}
              />

              {/* Pinyin */}
              <div className="text-2xl font-medium text-gray-700">
                {primaryPinyin}
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

        {/* Etymology/Hint */}
        <div className="mt-6 text-gray-700 leading-relaxed">
          {character.hint}
        </div>
      </div>

      {/* Components Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <SectionHeader>Components</SectionHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {character.components.map((component, index) => {
            const componentChar = character.chars?.find(
              (c) => c.char === component.character
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
                      <div
                        className={`absolute inset-0 text-6xl font-serif leading-none ${getComponentTextColor(
                          component.type
                        )} flex items-center justify-center`}
                      >
                        {component.character}
                      </div>
                    </>
                  )}
                </div>

                {/* Component info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-serif">
                      {component.character}
                    </span>
                    <span
                      className={`text-sm font-medium ${getComponentTextColor(
                        component.type
                      )}`}
                    >
                      {component.type.includes("sound") && "Sound "}
                      {component.type.includes("iconic") && "Iconic "}
                      component
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {componentChar?.pinyinFrequencies?.[0]?.pinyin && (
                      <span className="mr-2">
                        {componentChar.pinyinFrequencies[0].pinyin}
                      </span>
                    )}
                    <span>{componentChar?.gloss || component.hint}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evolution Section */}
      {character.images.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <SectionHeader>Evolution</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {character.images.map((img, index) => (
              <div key={index} className="flex flex-col items-center text-center">
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
      )}

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
                <span className="font-medium text-lg">{word.word}</span>
                <span className="text-gray-600 text-sm">{word.gloss}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pronunciation variants */}
      {character.pinyinFrequencies.length > 1 && (
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
    </div>
  );
}
