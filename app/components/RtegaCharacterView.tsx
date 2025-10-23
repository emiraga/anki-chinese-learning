import React from "react";
import type { RtegaCharacter } from "~/types/rtega_character";
import { CharLink } from "./CharCard";

interface RtegaCharacterViewProps {
  character: RtegaCharacter;
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
  character: RtegaCharacter;
}

function CharacterHeader({ character }: CharacterHeaderProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start gap-8">
        {/* Main Character Display */}
        <div className="text-9xl font-serif leading-none dark:text-gray-100">
          {character.character}
        </div>

        {/* Character Metadata */}
        <div className="space-y-2">
          {/* Meaning */}
          <div className="text-2xl font-medium text-gray-800 dark:text-gray-200">
            {character.meaning}
          </div>

          {/* Variants */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {character.traditional && (
              <div>
                <span className="font-semibold">Traditional: </span>
                <span className="text-lg font-serif">
                  {character.traditional}
                </span>
              </div>
            )}
            {character.simplified && (
              <div>
                <span className="font-semibold">Simplified: </span>
                <span className="text-lg font-serif">
                  {character.simplified}
                </span>
              </div>
            )}
            {character.japanese && (
              <div>
                <span className="font-semibold">Japanese: </span>
                <span className="text-lg font-serif">{character.japanese}</span>
              </div>
            )}
          </div>

          {/* UID */}
          <div className="text-xs text-gray-500 dark:text-gray-500">
            Unicode: {character.uid}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mnemonic component - displays mnemonic with all items
interface MnemonicSectionProps {
  character: RtegaCharacter;
}

function MnemonicSection({ character }: MnemonicSectionProps) {
  return (
    <Section title="Mnemonic">
      <div className="space-y-4">
        {/* Main mnemonic HTML with inlined SVGs */}
        <div
          className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: character.mnemonic.html }}
        />

        {/* Individual mnemonic items */}
        {character.mnemonic.items && character.mnemonic.items.length > 0 && (
          <div className="space-y-3 border-t dark:border-gray-700 pt-4">
            {character.mnemonic.items.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
              >
                <div
                  className="text-sm text-gray-600 dark:text-gray-400 mb-2 prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.html }}
                />
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  — {item.author}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

// Referenced Characters section
interface ReferencedCharactersSectionProps {
  characters: string[];
}

function ReferencedCharactersSection({
  characters,
}: ReferencedCharactersSectionProps) {
  if (characters.length === 0) return null;

  // Remove duplicates
  const uniqueCharacters = Array.from(new Set(characters));

  return (
    <Section title="Referenced Characters">
      <div className="flex flex-wrap gap-4">
        {uniqueCharacters.map((char, index) => (
          <CharLink
            key={index}
            traditional={char}
            className="text-5xl font-serif hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors"
          />
        ))}
      </div>
    </Section>
  );
}

// Related Characters section
interface RelatedCharactersSectionProps {
  characters: string[];
}

function RelatedCharactersSection({
  characters,
}: RelatedCharactersSectionProps) {
  if (characters.length === 0) return null;

  return (
    <Section title="Related Characters">
      <div className="flex flex-wrap gap-4">
        {characters.map((char, index) => (
          <CharLink
            key={index}
            traditional={char}
            className="text-5xl font-serif hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors"
          />
        ))}
      </div>
    </Section>
  );
}

/**
 * Main component for displaying Rtega character data
 */
export function RtegaCharacterView({ character }: RtegaCharacterViewProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <CharacterHeader character={character} />

      {/* Mnemonic Section */}
      <MnemonicSection character={character} />

      {/* Referenced Characters */}
      <ReferencedCharactersSection
        characters={character.referenced_characters}
      />

      {/* Related Characters */}
      <RelatedCharactersSection characters={character.related_characters} />
    </div>
  );
}
