import React from "react";
import { getNewCharacter, type CharactersType } from "~/data/characters";
import type { PhraseExample, PhraseType } from "~/data/phrases";
import { CharLink } from "./CharCard";
import { PinyinText } from "./PinyinText";

const HAN_CHAR = /\p{Script=Han}/u;

type UnknownCharFrequency = {
  char: string;
  count: number;
  examples: PhraseExample[];
};

export function getUnknownExampleCharsByFrequency(
  phrases: PhraseType[],
  characters: CharactersType,
): UnknownCharFrequency[] {
  const freq = new Map<string, UnknownCharFrequency>();
  for (const phrase of phrases) {
    for (const examples of Object.values(phrase.examples ?? {})) {
      for (const example of examples) {
        for (const char of example.traditional) {
          if (!HAN_CHAR.test(char) || characters[char] !== undefined) {
            continue;
          }
          let entry = freq.get(char);
          if (entry === undefined) {
            entry = { char, count: 0, examples: [] };
            freq.set(char, entry);
          }
          entry.count++;
          if (entry.examples.at(-1) !== example) {
            entry.examples.push(example);
          }
        }
      }
    }
  }
  return [...freq.values()].sort(
    (a, b) => b.count - a.count || a.char.localeCompare(b.char),
  );
}

export const CharactersMore: React.FC<{
  phrases: PhraseType[];
  characters: CharactersType;
  showZhuyin?: boolean;
}> = ({ phrases, characters, showZhuyin }) => {
  const unknownChars = getUnknownExampleCharsByFrequency(phrases, characters);

  return (
    <>
      <h3 className="font-serif text-3xl m-4">
        Unknown characters in phrase examples ({unknownChars.length})
      </h3>
      <table className="border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Character</th>
            <th className="text-left p-2">Pinyin</th>
            <th className="text-left p-2">Count</th>
            <th className="text-left p-2">Examples</th>
          </tr>
        </thead>
        <tbody>
          {unknownChars.map(({ char, count, examples }) => {
            const pinyin = getNewCharacter(char)?.pinyin[0];
            return (
              <tr
                key={char}
                className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="p-2">
                  <CharLink traditional={char} className="text-4xl" />
                </td>
                <td className="p-2">
                  {pinyin ? (
                    <PinyinText v={pinyin} showZhuyin={showZhuyin} />
                  ) : undefined}
                </td>
                <td className="p-2">{count}</td>
                <td className="p-2">
                  {examples.map((example, i) => (
                    <div key={i}>
                      {example.traditional}{" "}
                      <span className="text-gray-500">{example.english}</span>
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};
