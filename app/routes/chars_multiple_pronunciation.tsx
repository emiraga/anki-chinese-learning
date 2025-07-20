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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chars" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function TodoCharsMultiplePronunciation() {
  const { characters, charPhrasesPinyin } = useOutletContext<OutletContext>();

  const characters2 = Object.values(characters).map((char) => {
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
  });
  const multiple = characters2.filter(
    (char) => Object.keys(char.phrasesPinyin).length !== 1 && char.withSound
  );
  const ignored = characters2.filter(
    (char) =>
      Object.keys(char.phrasesPinyin).length === 1 &&
      char.withSound &&
      Object.keys(char.phrasesIgnoredPinyin).length > 0
  );

  const Row = ({
    char,
  }: {
    char: CharacterType & {
      phrasesPinyin: {
        [k: string]: PinyinType;
      };
      phrasesIgnoredPinyin: {
        [k: string]: PinyinType;
      };
    };
  }) => (
    <div key={char.ankiId} className="flex">
      <CharLink traditional={char.traditional} className="text-2xl flex-1" />
      <div className="flex-1">
        {Object.values(char.phrasesPinyin).map((pinyin) => (
          <span className="mx-3" key={pinyin.pinyin_1}>
            <PinyinText v={pinyin} />:{pinyin.count}
          </span>
        ))}
      </div>
      <div className="flex-1">
        {Object.values(char.phrasesIgnoredPinyin).map((pinyin) => (
          <span className="mx-3" key={pinyin.pinyin_1}>
            <PinyinText v={pinyin} />:{pinyin.count}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <main>
      <MainToolbar />
      <Section className="m-3" display={multiple.length > 0}>
        <h3 className="font-serif text-2xl">Multiple pronounciations:</h3>
        {multiple.map((char) => (
          <Row key={char.ankiId} char={char} />
        ))}
      </Section>

      <Section className="m-3" display={ignored.length > 0}>
        <Collapsible.Root className={styles.Collapsible}>
          <Collapsible.Trigger className={styles.Trigger}>
            <h3 className="font-serif text-2xl">
              With ignored pronounciations... (expandable)
            </h3>
          </Collapsible.Trigger>
          <Collapsible.Panel className={styles.Panel}>
            {ignored.map((char) => (
              <Row key={char.ankiId} char={char} />
            ))}
          </Collapsible.Panel>
        </Collapsible.Root>
      </Section>
    </main>
  );
}
