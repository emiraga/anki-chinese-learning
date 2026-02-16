import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { PinyinText } from "~/components/PinyinText";
import { CharLink } from "~/components/CharCard";
import Section from "~/toolbar/section";
import type { CharacterType } from "~/data/characters";
import type { PinyinType } from "~/utils/pinyin";
import { Collapsible } from "@base-ui-components/react/collapsible";
import styles from "../components/index.module.css";
import { useSettings } from "~/settings/SettingsContext";

type CharWithPronunciations = CharacterType & {
  countSylables: number;
  phrasesPinyin: {
    [k: string]: PinyinType;
  };
  phrasesIgnoredPinyin: {
    [k: string]: PinyinType;
  };
};

function CharacterTable({
  characters,
  showZhuyin,
}: {
  characters: CharWithPronunciations[];
  showZhuyin?: boolean;
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
                <span className="mx-3 inline-block" key={pinyin.pinyinAccented}>
                  <PinyinText v={pinyin} showZhuyin={showZhuyin} />{" "}
                  <span className="text-gray-500">({pinyin.count} times)</span>
                </span>
              ))}
            </td>
            <td className="p-2">
              {Object.values(char.phrasesIgnoredPinyin).map((pinyin) => (
                <span className="mx-3 inline-block" key={pinyin.pinyinAccented}>
                  <PinyinText v={pinyin} showZhuyin={showZhuyin} />{" "}
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
  const {
    settings: { features },
  } = useSettings();

  const characters2: CharWithPronunciations[] = Object.values(characters).map(
    (char) => {
      var phrasesPinyin = charPhrasesPinyin[char.traditional] || {};
      return {
        ...char,
        countSylables: new Set(
          Object.entries(phrasesPinyin).map((kv) => kv[1].sylable),
        ).size,
        phrasesPinyin: Object.fromEntries(
          Object.entries(phrasesPinyin).filter((kv) => !kv[1].ignoredFifthTone),
        ),
        phrasesIgnoredPinyin: Object.fromEntries(
          Object.entries(phrasesPinyin).filter((kv) => kv[1].ignoredFifthTone),
        ),
      };
    },
  );
  const multiple = characters2.filter(
    (char) =>
      Object.keys(char.phrasesPinyin).length !== 1 &&
      char.withSound &&
      char.countSylables > 1,
  );
  const sameSylable = characters2.filter(
    (char) =>
      Object.keys(char.phrasesPinyin).length > 1 &&
      char.withSound &&
      char.countSylables <= 1,
  );
  const ignored = characters2.filter(
    (char) =>
      Object.keys(char.phrasesPinyin).length === 1 &&
      char.withSound &&
      Object.keys(char.phrasesIgnoredPinyin).length > 0,
  );

  return (
    <MainFrame>
      <Section className="m-3" display={multiple.length > 0}>
        <h3 className="font-serif text-2xl mb-4">
          Multiple pronounciations ({multiple.length}):
        </h3>
        <CharacterTable
          characters={multiple}
          showZhuyin={features?.showZhuyin}
        />
      </Section>

      <Section className="m-3" display={sameSylable.length > 0}>
        <h3 className="font-serif text-2xl mb-4">
          Same sylable but different tones ({sameSylable.length}):
        </h3>
        <CharacterTable
          characters={sameSylable}
          showZhuyin={features?.showZhuyin}
        />
      </Section>

      <Section className="mx-3 mt-3" display={ignored.length > 0}>
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-2xl">
              With ignored fifth tone pronounciations... ({ignored.length} -
              expandable):
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            <CharacterTable
              characters={ignored}
              showZhuyin={features?.showZhuyin}
            />
          </Collapsible.Panel>
        </Collapsible.Root>
      </Section>
    </MainFrame>
  );
}
