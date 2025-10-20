import React, { useState } from "react";
import type { DongCharacter } from "~/types/dong_character";

interface DongCharacterDisplayProps {
  character: DongCharacter;
}

export function DongCharacterDisplay({ character }: DongCharacterDisplayProps) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  // Get the primary pinyin
  const primaryPinyin =
    character.pinyinFrequencies.length > 0
      ? character.pinyinFrequencies[0].pinyin
      : "";

  // Get HSK level badge
  const getHskBadge = () => {
    const level = character.statistics.hskLevel;
    if (level > 9) return null;
    return (
      <span className="bg-black text-white px-3 py-1 rounded text-sm font-medium">
        HSK {level}
      </span>
    );
  };

  // Get component color based on type
  const getComponentColor = (type: string[]) => {
    if (type.includes("sound")) return "text-blue-600";
    if (type.includes("iconic")) return "text-green-600";
    return "text-gray-600";
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-8">
            {/* Main Character Display */}
            <div className="relative w-48 h-48">
              {character.data || character.images.find((img) => img.data) ? (
                <svg
                  viewBox="0 0 1024 1024"
                  className="w-full h-full"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g transform="scale(1, -1) translate(0, -1024)">
                    {(character.data?.strokes ||
                      character.images.find((img) => img.data)?.data?.strokes ||
                      []
                    ).map((stroke, index) => (
                      <path key={index} d={stroke} fill="black" stroke="none" />
                    ))}
                  </g>
                </svg>
              ) : (
                <div className="text-9xl font-serif leading-none">
                  {character.char}
                </div>
              )}
              {/* Show components overlay when hovering */}
              {activeComponent && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* This would show the highlighted component */}
                </div>
              )}
            </div>

            {/* Character Metadata */}
            <div className="space-y-2">
              {/* Audio Button */}
              <button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                onClick={() => {
                  // Audio playback would go here
                  console.log("Play audio for:", character.char);
                }}
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

              {/* Pinyin */}
              <div className="text-2xl font-medium text-gray-700">
                {primaryPinyin}
              </div>

              {/* Translation */}
              <div className="text-lg text-gray-600">{character.gloss}</div>
            </div>
          </div>

          {/* HSK Badge */}
          <div>{getHskBadge()}</div>
        </div>

        {/* Etymology/Hint */}
        <div className="mt-6 text-gray-700 leading-relaxed">
          {character.hint}
        </div>
      </div>

      {/* Components Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
          Components
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {character.components.map((component, index) => {
            const componentChar = character.chars?.find(
              (c) => c.char === component.character
            );
            const mainCharData =
              character.data || character.images.find((img) => img.data)?.data;
            const componentData =
              componentChar?.data ||
              componentChar?.images.find((img) => img.data)?.data;

            // Get fill color based on component type
            const getFillColor = () => {
              if (component.type.includes("sound")) return "#2563eb"; // blue-600
              if (component.type.includes("iconic")) return "#16a34a"; // green-600
              return "#4b5563"; // gray-600
            };

            return (
              <div
                key={index}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onMouseEnter={() => setActiveComponent(component.character)}
                onMouseLeave={() => setActiveComponent(null)}
              >
                {/* Component character with colored overlay */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  {mainCharData && componentData ? (
                    <svg
                      viewBox="0 0 1024 1024"
                      className="w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Background: full character in light gray */}
                      <g transform="scale(1, -1) translate(0, -1024)">
                        {mainCharData.strokes.map((stroke, strokeIndex) => (
                          <path
                            key={`bg-${strokeIndex}`}
                            d={stroke}
                            fill="#e5e7eb"
                            stroke="none"
                          />
                        ))}
                      </g>
                      {/* Foreground: component in color */}
                      <g transform="scale(1, -1) translate(0, -1024)">
                        {componentData.strokes.map((stroke, strokeIndex) => (
                          <path
                            key={`fg-${strokeIndex}`}
                            d={stroke}
                            fill={getFillColor()}
                            stroke="none"
                          />
                        ))}
                      </g>
                    </svg>
                  ) : (
                    <>
                      <div className="text-6xl font-serif leading-none opacity-20 absolute inset-0 flex items-center justify-center">
                        {character.char}
                      </div>
                      <div
                        className={`absolute inset-0 text-6xl font-serif leading-none ${getComponentColor(
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
                      className={`text-sm font-medium ${getComponentColor(
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
          <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-2">
            Evolution
          </h2>
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
                    <svg
                      viewBox="0 0 1024 1024"
                      className="w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g transform="scale(1, -1) translate(0, -1024)">
                        {img.data.strokes.map((stroke, strokeIndex) => (
                          <path
                            key={strokeIndex}
                            d={stroke}
                            fill="black"
                            stroke="none"
                          />
                        ))}
                      </g>
                    </svg>
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
          <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
            Common Words
          </h2>
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
          <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
            Pronunciations
          </h2>
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
