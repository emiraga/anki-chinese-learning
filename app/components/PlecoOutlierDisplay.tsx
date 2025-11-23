import React from "react";
import type { PlecoOutlier, Character, Series } from "~/types/pleco_outlier";
import { CharLink } from "./CharCard";
import { HanziText } from "./HanziText";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";

interface PlecoOutlierDisplayProps {
  character: PlecoOutlier;
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

// Character header component
interface CharacterHeaderProps {
  character: PlecoOutlier;
}

function CharacterHeader({ character }: CharacterHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start gap-8">
        {/* Main Character Display */}
        <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
          <div className="text-9xl font-serif leading-none dark:text-gray-100">
            {character.traditional}
          </div>
        </div>

        {/* Right side content */}
        <div className="flex-1 space-y-4">
          {/* Character Metadata */}
          <div className="space-y-2">
            {/* Simplified form */}
            {character.simplified && character.simplified !== character.traditional && (
              <div className="text-2xl font-medium text-gray-600 dark:text-gray-400">
                Simplified: {character.simplified}
              </div>
            )}

            {/* Pinyin */}
            {character.pinyin && character.pinyin.length > 0 && (
              <div className="text-2xl font-medium text-gray-800 dark:text-gray-200">
                {character.pinyin.join(", ")}
              </div>
            )}
          </div>

          {/* Top-level note */}
          {character.note && (
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 dark:border-blue-400 rounded">
              <HanziText value={character.note} />
            </div>
          )}

          {/* References */}
          {character.references && character.references.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Related Characters:
              </h3>
              <div className="flex flex-wrap gap-2">
                {character.references.map((ref, index) => (
                  <CharLink
                    key={index}
                    traditional={ref.char}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title={ref.href}
                  >
                    <span className="text-2xl font-serif dark:text-gray-100">{ref.char}</span>
                  </CharLink>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Character list item component - grid card style
interface CharacterItemProps {
  char: Character;
  isKnown: boolean;
}

function CharacterItem({ char, isKnown }: CharacterItemProps) {
  const pinyinDisplay = char.pinyin && char.pinyin.length > 0
    ? char.pinyin.join(", ")
    : "";

  // Build title for tooltip
  const titleParts = [];
  if (pinyinDisplay) titleParts.push(pinyinDisplay);
  if (char.explanation) titleParts.push(char.explanation);
  if (char.meaning) titleParts.push(char.meaning);
  if (!isKnown) titleParts.push("(Unknown)");
  const title = titleParts.join(" - ");

  return (
    <CharLink
      traditional={char.traditional}
      className={`flex flex-col items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded ${!isKnown ? "opacity-60" : ""}`}
      title={title}
    >
      <div className="text-5xl font-serif mb-2 dark:text-gray-100">
        {char.traditional}
      </div>
      {char.simplified && char.simplified !== char.traditional && (
        <div className="text-2xl text-gray-500 dark:text-gray-400 mb-1">
          {char.simplified}
        </div>
      )}
      {pinyinDisplay && (
        <div className="text-sm text-gray-600 dark:text-gray-400 text-center font-medium mb-1">
          {pinyinDisplay}
        </div>
      )}
      {char.explanation && (
        <div className="text-xs text-gray-700 dark:text-gray-300 text-center font-medium mb-1 line-clamp-2">
          {char.explanation}
        </div>
      )}
      {char.meaning && (
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center line-clamp-2">
          {char.meaning}
        </div>
      )}
    </CharLink>
  );
}

// Series section component
interface SeriesSectionProps {
  title: string;
  series?: Series;
  characters: Record<string, unknown>;
}

function SeriesSection({ title, series, characters }: SeriesSectionProps) {
  if (!series || !series.characters || series.characters.length === 0) return null;

  // Separate known and unknown characters
  const knownChars = series.characters.filter((c) => characters[c.traditional]);
  const unknownChars = series.characters.filter((c) => !characters[c.traditional]);

  const sectionTitle = `${title} - ${knownChars.length} known${unknownChars.length > 0 ? ` + ${unknownChars.length} unknown` : ""}`;

  return (
    <Section title={sectionTitle}>
      {series.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 dark:border-blue-400 rounded">
          <HanziText value={series.explanation} />
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {series.characters.map((char, index) => {
          const isKnown = !!characters[char.traditional];
          return (
            <CharacterItem key={index} char={char} isKnown={isKnown} />
          );
        })}
      </div>
    </Section>
  );
}

// Empty component section
interface EmptyComponentSectionProps {
  emptyComponent?: PlecoOutlier["empty_component"];
  characters: Record<string, unknown>;
}

function EmptyComponentSection({ emptyComponent, characters }: EmptyComponentSectionProps) {
  if (!emptyComponent || !emptyComponent.characters || emptyComponent.characters.length === 0) return null;

  // Separate known and unknown characters
  const knownChars = emptyComponent.characters.filter((c) => characters[c.traditional]);
  const unknownChars = emptyComponent.characters.filter((c) => !characters[c.traditional]);

  const sectionTitle = `Empty Component - ${knownChars.length} known${unknownChars.length > 0 ? ` + ${unknownChars.length} unknown` : ""}`;

  return (
    <Section title={sectionTitle}>
      {emptyComponent.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-purple-50 dark:bg-purple-950 border-l-4 border-purple-500 dark:border-purple-400 rounded">
          <HanziText value={emptyComponent.explanation} />
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {emptyComponent.characters.map((char, index) => {
          const isKnown = !!characters[char.traditional];
          return (
            <CharacterItem key={index} char={char} isKnown={isKnown} />
          );
        })}
      </div>
    </Section>
  );
}

// Radical section component
interface RadicalSectionProps {
  radical?: PlecoOutlier["radical"];
  characters: Record<string, unknown>;
}

function RadicalSection({ radical, characters }: RadicalSectionProps) {
  if (!radical || !radical.characters || radical.characters.length === 0) return null;

  // Separate known and unknown characters
  const knownChars = radical.characters.filter((c) => characters[c.traditional]);
  const unknownChars = radical.characters.filter((c) => !characters[c.traditional]);

  const sectionTitle = `Radical - ${knownChars.length} known${unknownChars.length > 0 ? ` + ${unknownChars.length} unknown` : ""}`;

  return (
    <Section title={sectionTitle}>
      {radical.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-green-50 dark:bg-green-950 border-l-4 border-green-500 dark:border-green-400 rounded">
          <HanziText value={radical.explanation} />
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {radical.characters.map((char, index) => {
          const isKnown = !!characters[char.traditional];
          return (
            <CharacterItem key={index} char={char} isKnown={isKnown} />
          );
        })}
      </div>
    </Section>
  );
}

export function PlecoOutlierDisplay({ character }: PlecoOutlierDisplayProps) {
  // Get known characters from context
  const { characters } = useOutletContext<OutletContext>();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section (includes character, note, and references) */}
      <CharacterHeader character={character} />

      {/* Sound Series Section */}
      <SeriesSection title="Sound Series" series={character.sound_series} characters={characters} />

      {/* Semantic Series Section */}
      <SeriesSection title="Semantic Series" series={character.semantic_series} characters={characters} />

      {/* Empty Component Section */}
      <EmptyComponentSection emptyComponent={character.empty_component} characters={characters} />

      {/* Radical Section */}
      <RadicalSection radical={character.radical} characters={characters} />
    </div>
  );
}
