import MainToolbar from "~/toolbar/toolbar";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { PinyinText } from "~/components/PinyinText";
import { CharLink } from "~/components/CharCard";
import Section from "~/toolbar/section";
import type { CharacterType } from "~/data/characters";
import type { PinyinType } from "~/data/pinyin_function";
import { Collapsible } from "@base-ui-components/react/collapsible";
import styles from "../components/index.module.css";

type CharWithPronunciations = CharacterType & {
  phrasesPinyin: {
    [k: string]: PinyinType;
  };
  phrasesIgnoredPinyin: {
    [k: string]: PinyinType;
  };
};

function CharacterTable({
  characters,
}: {
  characters: CharWithPronunciations[];
}) {
  return (
    <table className="border-collapse">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2 min-w-10">Character</th>
          <th className="text-left p-2 min-w-60">Pronunciations</th>
          <th className="text-left p-2 min-w-60">Ignored</th>
        </tr>
      </thead>
      <tbody>
        {characters.map((char) => (
          <tr key={char.ankiId} className="border-b hover:bg-gray-50">
            <td className="p-2">
              <CharLink traditional={char.traditional} className="text-4xl" />
            </td>
            <td className="p-2">
              {Object.values(char.phrasesPinyin).map((pinyin) => (
                <span className="mx-3 inline-block" key={pinyin.pinyin_1}>
                  <PinyinText v={pinyin} />{" "}
                  <span className="text-gray-500">({pinyin.count} times)</span>
                </span>
              ))}
            </td>
            <td className="p-2">
              {Object.values(char.phrasesIgnoredPinyin).map((pinyin) => (
                <span className="mx-3 inline-block" key={pinyin.pinyin_1}>
                  <PinyinText v={pinyin} />{" "}
                  <span className="text-gray-500">({pinyin.count} times)</span>
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoCharsMultiplePronunciation() {
  const { characters, charPhrasesPinyin } = useOutletContext<OutletContext>();

  const characters2: CharWithPronunciations[] = Object.values(characters).map(
    (char) => {
      var phrasesPinyin = charPhrasesPinyin[char.traditional] || {};
      return {
        ...char,
        phrasesPinyin: Object.fromEntries(
          Object.entries(phrasesPinyin).filter((kv) => !kv[1].ignoredFifthTone)
        ),
        phrasesIgnoredPinyin: Object.fromEntries(
          Object.entries(phrasesPinyin).filter((kv) => kv[1].ignoredFifthTone)
        ),
      };
    }
  );
  const multiple = characters2.filter(
    (char) => Object.keys(char.phrasesPinyin).length !== 1 && char.withSound
  );
  const ignored = characters2.filter(
    (char) =>
      Object.keys(char.phrasesPinyin).length === 1 &&
      char.withSound &&
      Object.keys(char.phrasesIgnoredPinyin).length > 0
  );

  return (
    <main>
      <MainToolbar />
      <Section className="m-3" display={multiple.length > 0}>
        <h3 className="font-serif text-2xl mb-4">Multiple pronounciations:</h3>
        <CharacterTable characters={multiple} />
      </Section>

      <Section className="m-3" display={ignored.length > 0}>
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-2xl">
              With ignored pronounciations... (expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <CharacterTable characters={ignored} />
          </Collapsible.Panel>
        </Collapsible.Root>
      </Section>
    </main>
  );
}
