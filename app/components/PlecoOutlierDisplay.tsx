import React from "react";
import type { PlecoOutlier, Character, Series, Reference } from "~/types/pleco_outlier";
import { CharLink } from "./CharCard";
import { HanziText } from "./HanziText";

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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-8">
          {/* Main Character Display */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <div className="text-9xl font-serif leading-none dark:text-gray-100">
              {character.traditional}
            </div>
          </div>

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
        </div>
      </div>

      {/* Top-level note */}
      {character.note && (
        <div className="mt-6 text-gray-700 dark:text-gray-300 leading-relaxed">
          <HanziText value={character.note} />
        </div>
      )}
    </div>
  );
}

// References section component
interface ReferencesSectionProps {
  references?: Reference[];
}

function ReferencesSection({ references }: ReferencesSectionProps) {
  if (!references || references.length === 0) return null;

  return (
    <Section title="References">
      <div className="flex flex-wrap gap-3">
        {references.map((ref, index) => (
          <CharLink
            key={index}
            traditional={ref.char}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            title={ref.href}
          >
            <span className="text-3xl font-serif dark:text-gray-100">{ref.char}</span>
          </CharLink>
        ))}
      </div>
    </Section>
  );
}

// Character list item component - grid card style
interface CharacterItemProps {
  char: Character;
}

function CharacterItem({ char }: CharacterItemProps) {
  const pinyinDisplay = char.pinyin && char.pinyin.length > 0
    ? char.pinyin.join(", ")
    : "";

  // Build title for tooltip
  const titleParts = [];
  if (pinyinDisplay) titleParts.push(pinyinDisplay);
  if (char.explanation) titleParts.push(char.explanation);
  if (char.meaning) titleParts.push(char.meaning);
  const title = titleParts.join(" - ");

  return (
    <CharLink
      traditional={char.traditional}
      className="flex flex-col items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded"
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
}

function SeriesSection({ title, series }: SeriesSectionProps) {
  if (!series) return null;

  return (
    <Section title={title}>
      {series.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 dark:border-blue-400 rounded">
          <HanziText value={series.explanation} />
        </div>
      )}
      {series.characters && series.characters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {series.characters.map((char, index) => (
            <CharacterItem key={index} char={char} />
          ))}
        </div>
      )}
    </Section>
  );
}

// Empty component section
interface EmptyComponentSectionProps {
  emptyComponent?: PlecoOutlier["empty_component"];
}

function EmptyComponentSection({ emptyComponent }: EmptyComponentSectionProps) {
  if (!emptyComponent) return null;

  return (
    <Section title="Empty Component">
      {emptyComponent.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-purple-50 dark:bg-purple-950 border-l-4 border-purple-500 dark:border-purple-400 rounded">
          <HanziText value={emptyComponent.explanation} />
        </div>
      )}
      {emptyComponent.characters && emptyComponent.characters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {emptyComponent.characters.map((char, index) => (
            <CharacterItem key={index} char={char} />
          ))}
        </div>
      )}
    </Section>
  );
}

// Radical section component
interface RadicalSectionProps {
  radical?: PlecoOutlier["radical"];
}

function RadicalSection({ radical }: RadicalSectionProps) {
  if (!radical) return null;

  return (
    <Section title="Radical">
      {radical.explanation && (
        <div className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed p-4 bg-green-50 dark:bg-green-950 border-l-4 border-green-500 dark:border-green-400 rounded">
          <HanziText value={radical.explanation} />
        </div>
      )}
      {radical.characters && radical.characters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {radical.characters.map((char, index) => (
            <CharacterItem key={index} char={char} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function PlecoOutlierDisplay({ character }: PlecoOutlierDisplayProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <CharacterHeader character={character} />

      {/* References Section */}
      <ReferencesSection references={character.references} />

      {/* Sound Series Section */}
      <SeriesSection title="Sound Series" series={character.sound_series} />

      {/* Semantic Series Section */}
      <SeriesSection title="Semantic Series" series={character.semantic_series} />

      {/* Empty Component Section */}
      <EmptyComponentSection emptyComponent={character.empty_component} />

      {/* Radical Section */}
      <RadicalSection radical={character.radical} />
    </div>
  );
}
