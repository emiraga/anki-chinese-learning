import type { CharacterType } from "~/data/characters";
import { PinyinList } from "./PinyinText";
import type React from "react";
import anki, { ankiOpenBrowse } from "~/apis/anki";
import { Link } from "react-router";
import { TagList } from "./TagList";
import { useSettings } from "~/settings/SettingsContext";
import AnkiContentRenderer from "./AnkiContentRenderer";
import {
  getCharacterMnemonicTags,
  shouldHaveMnemonicTags,
} from "~/data/character_tags";

export const CharLink: React.FC<{
  traditional: string;
  className?: string;
  children?: React.ReactNode;
  title?: string;
}> = ({ traditional, className, children, title }) => {
  return (
    <Link to={`/char/${traditional}`} className={className} title={title}>
      {children || traditional}
    </Link>
  );
};

const CharPinyinSoundMeaning: React.FC<{
  char: CharacterType;
  showZhuyin?: boolean;
}> = ({ char, showZhuyin }) => {
  if (!char.withSound) {
    return <div>{char.meaning2}</div>;
  }

  return (
    <>
      <PinyinList pinyin={char.pinyin} showZhuyin={showZhuyin} />{" "}
      {char.soundComponentCharacter && (
        <span>
          (📢
          <CharLink
            className="text-2xl"
            traditional={char.soundComponentCharacter}
          />
          )
        </span>
      )}
      <div>{char.meaning2}</div>
    </>
  );
};

export const CharCard: React.FC<{
  v: CharacterType;
  showZhuyin?: boolean;
  hideMnemonic?: boolean;
}> = ({ v, showZhuyin, hideMnemonic = false }) => {
  return (
    <div>
      <div className="flex w-full">
        <div className="w-12 text-4xl">
          <CharLink traditional={v.traditional} />
        </div>
        <div className="flex-1">
          <CharPinyinSoundMeaning char={v} showZhuyin={showZhuyin} />
        </div>
      </div>
      {!hideMnemonic && (
        <AnkiContentRenderer
          htmlContent={v.mnemonic}
          className="text-xs w-52 max-h-32 overflow-scroll bg-gray-100 dark:bg-gray-800 dark:text-gray-100"
        />
      )}
    </div>
  );
};

export const CharCardDetails: React.FC<{ char: CharacterType }> = ({
  char,
}) => {
  var isDefined = char.meaning.length > 0 || char.meaning2.length > 0;
  const { settings } = useSettings();

  const sources = [
    {
      name: "wiki",
      link:
        "https://en.wiktionary.org/wiki/" +
        encodeURIComponent(char.traditional) +
        "#Chinese",
    },
    {
      name: "dong",
      link:
        "https://www.dong-chinese.com/dictionary/search/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "zi",
      link: "https://zi.tools/zi/" + encodeURIComponent(char.traditional),
    },
    {
      name: "multi",
      link:
        "https://humanum.arts.cuhk.edu.hk/Lexis/lexi-mf/search.php?word=" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "yellowb",
      link:
        "https://www.yellowbridge.com/chinese/character-dictionary.php?zi=" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "hyuan",
      link: "https://hanziyuan.net/#" + encodeURIComponent(char.traditional),
    },
    {
      name: "MoE",
      link:
        "https://dict.revised.moe.edu.tw/search.jsp?md=1&word=" +
        encodeURIComponent(char.traditional) +
        "&qMd=0&qCol=1",
    },
    {
      name: "rtega",
      link: "http://rtega.be/chmn/?c=" + encodeURIComponent(char.traditional),
    },
    {
      name: "hero",
      link:
        "https://hanzihero.com/traditional/characters/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "kanji",
      link:
        "https://kanji.koohii.com/study/kanji/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "craft",
      link:
        "https://hanzicraft.com/character/" +
        encodeURIComponent(char.traditional),
    },
  ];

  return (
    <div key={char.traditional} className="mx-6 mb-2">
      <div
        className={
          isDefined ? "flex w-full" : "flex w-full bg-blue-100 dark:bg-blue-900"
        }
      >
        <div className="w-26 text-8xl">
          <CharLink traditional={char.traditional} />
        </div>
        <div className="w-48">
          <CharPinyinSoundMeaning
            char={char}
            showZhuyin={settings.features?.showZhuyin}
          />
        </div>
        <div className="w-32 text-sm">
          {sources.map(({ name, link }) => (
            <a
              key={name}
              href={link}
              rel="noreferrer"
              target="_blank"
              className="inline-block"
            >
              {name} 🔗 &nbsp;
            </a>
          ))}
        </div>
        <div className="w-14">
          <button
            className="rounded-2xl bg-gray-300 dark:bg-gray-600 dark:text-gray-100 p-1 m-1 w-12"
            onClick={() => {
              sources.forEach((source) => {
                window.open(source.link, "_blank");
              });
            }}
          >
            links
          </button>
          {settings.characterNote?.noteType ? (
            <button
              className="rounded-2xl bg-blue-300 dark:bg-blue-600 dark:text-blue-100 p-1 m-1 w-12"
              onClick={async () => {
                ankiOpenBrowse("note:Hanzi Traditional:" + char.traditional);
              }}
            >
              anki
            </button>
          ) : undefined}
        </div>
        <div className="flex-1 text-sm">
          {!char.ankiId && settings.characterNote?.noteType ? (
            <button
              className="rounded-2xl bg-red-300 dark:bg-red-600 dark:text-red-100 p-2 m-1"
              onClick={async () => {
                const notesId = await anki.note.findNotes({
                  query: "note:Hanzi Traditional:" + char.traditional,
                });
                if (notesId.length === 0) {
                  alert("Did not find any notes");
                  return 0;
                }
                if (notesId.length > 1) {
                  alert("Too many notes, this is strange!");
                  return 0;
                }
                const notes = await anki.note.notesInfo({ notes: notesId });
                await anki.card.unsuspend({ cards: notes[0].cards });
                if (notes[0].fields["Meaning 2"].value.length === 0) {
                  await anki.note.updateNoteFields({
                    note: {
                      id: notesId[0],
                      fields: { "Meaning 2": notes[0].fields["Meaning"].value },
                    },
                  });
                }
                if (!notes[0].tags.includes("chinese::some-props-missing")) {
                  await anki.note.addTags({
                    notes: notesId,
                    tags: "chinese::some-props-missing",
                  });
                }
                if (notes[0].tags.includes("chinese::not-learning-sound-yet")) {
                  await anki.note.removeTags({
                    notes: notesId,
                    tags: "chinese::not-learning-sound-yet",
                  });
                }

                // Add mnemonic tags (actor, place, tone) if applicable
                let mnemonicMessage = "";
                if (shouldHaveMnemonicTags(char)) {
                  try {
                    const { allTags } = getCharacterMnemonicTags(char);
                    const currentTags = notes[0].tags;
                    const missingTags = allTags.filter(
                      (tag) => !currentTags.includes(tag),
                    );

                    if (missingTags.length > 0) {
                      await anki.note.addTags({
                        notes: notesId,
                        tags: missingTags.join(" "),
                      });
                      mnemonicMessage = `\nAdded tags: ${missingTags.join(", ")}`;
                    } else {
                      mnemonicMessage = "\nAll mnemonic tags already present.";
                    }
                  } catch (error) {
                    console.error("Failed to add mnemonic tags:", error);
                    mnemonicMessage = `\nMnemonic tags error: ${error}`;
                  }
                } else {
                  mnemonicMessage = `\nSkipped mnemonic tags: withSound=${char.withSound}, pinyinAnki=${char.pinyinAnki}`;
                }

                alert(`All done, enabled!${mnemonicMessage}`);
              }}
            >
              Enable in anki
            </button>
          ) : undefined}

          <TagList tags={char.tags} />
          <AnkiContentRenderer
            htmlContent={char.mnemonic}
            className="text-xs w-80 max-h-96 overflow-scroll m-4 bg-gray-200 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
    </div>
  );
};
