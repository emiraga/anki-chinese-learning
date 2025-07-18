import type { CharacterType } from "~/data/characters";
import { PinyinText } from "./PinyinText";
import type React from "react";
import anki, { anki_open_browse } from "~/apis/anki";
import { Link } from "react-router";
import { TagList } from "./TagList";
import { useSettings } from "~/settings/SettingsContext";
import AnkiContentRenderer from "./AnkiContentRenderer";

export const CharLink: React.FC<{
  traditional: string;
  className?: string;
}> = ({ traditional, className }) => {
  return (
    <Link to={`/char/${traditional}`} className={className}>
      {traditional}
    </Link>
  );
};

export const CharCard: React.FC<{ v: CharacterType }> = ({ v }) => {
  return (
    <div>
      <div className="flex w-full">
        <div className="w-12 text-4xl">
          <CharLink traditional={v.traditional} />
        </div>
        <div className="flex-1">
          {v.withSound ? <PinyinText v={v} /> : <></>}
          <div>{v.meaning2}</div>
        </div>
      </div>
      <AnkiContentRenderer
        htmlContent={v.mnemonic}
        className="text-xs w-52 max-h-32 overflow-scroll bg-gray-100 dark:bg-gray-800 dark:text-gray-100"
      />
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
      name: "MoE revised",
      link:
        "https://dict.revised.moe.edu.tw/search.jsp?md=1&word=" +
        encodeURIComponent(char.traditional) +
        "&qMd=0&qCol=1",
    },
    {
      name: "dong-ch",
      link:
        "https://www.dong-chinese.com/dictionary/search/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "hanzihero",
      link:
        "https://hanzihero.com/traditional/characters/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "kanji koohii",
      link:
        "https://kanji.koohii.com/study/kanji/" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "yellowbridge",
      link:
        "https://www.yellowbridge.com/chinese/character-dictionary.php?zi=" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "hanziyuan",
      link: "https://hanziyuan.net/#" + encodeURIComponent(char.traditional),
    },
    {
      name: "claude",
      link:
        "https://claude.ai/new?q=teach+me+" +
        encodeURIComponent(char.traditional),
    },
    {
      name: "wiktionary",
      link:
        "https://en.wiktionary.org/wiki/" +
        encodeURIComponent(char.traditional) +
        "#Chinese",
    },
    {
      name: "hanzicraft",
      link:
        "https://hanzicraft.com/character/" +
        encodeURIComponent(char.traditional),
    },
  ];

  return (
    <div key={char.traditional} className="mx-6 mb-2">
      <div className={isDefined ? "flex w-full" : "flex w-full bg-blue-100 dark:bg-blue-900"}>
        <div className="w-26 text-8xl">
          <CharLink traditional={char.traditional} />
        </div>
        <div className="w-48">
          {char.withSound ? <PinyinText v={char} /> : <></>}
          <div>{char.meaning2}</div>
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
              {char.traditional} {name} 🔗
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
                anki_open_browse("note:Hanzi Traditional:" + char.traditional);
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
                if (!notes[0].tags.includes("some-props-missing")) {
                  await anki.note.addTags({
                    notes: notesId,
                    tags: "some-props-missing",
                  });
                }
                if (notes[0].tags.includes("not-learning-sound-yet")) {
                  await anki.note.removeTags({
                    notes: notesId,
                    tags: "not-learning-sound-yet",
                  });
                }
                alert("All done, enabled!");
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
