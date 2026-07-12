import { useOutletContext } from "react-router";
import { useState } from "react";
import type { OutletContext } from "~/data/types";
import { CharCardDetails } from "./CharCard";
import { PropCard } from "./PropCard";
import anki, { ankiOpenBrowse } from "~/apis/anki";
import {
  getActorPlaceToneMigrations,
  getCharacterZhuyinInconsistencies,
  getLowercasePinyinChars,
  getPropNameMigrations,
} from "~/data/integrity_checks";

/**
 * Character-based integrity checks that only depend on already-loaded state.
 * Migrated out of `~/components/Integrity` (which now only holds checks that
 * require fetching all cards/decks from Anki) into the `/conflicts` page.
 */

function IntegrityActorPlaceAnki() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = getActorPlaceToneMigrations(characters);

  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">
        Migration of actor, place and tone:{" "}
        <button
          className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            setProgress({ current: 0, total: filtered.length });

            for (let i = 0; i < filtered.length; i++) {
              const char = filtered[i];
              setProgress({ current: i + 1, total: filtered.length });

              for (const needTag of char.needTags) {
                await anki.note.addTags({
                  notes: [char.ankiId || 0],
                  tags: needTag,
                });
              }
            }

            setIsProcessing(false);
            alert("Fixed!");
          }}
        >
          {isProcessing ? "Processing..." : "Auto-fix all!"}
        </button>
        {isProcessing && (
          <div className="mt-2">
            <progress
              className="w-full h-2"
              value={progress.current}
              max={progress.total}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {progress.current} / {progress.total} characters
            </div>
          </div>
        )}
      </h3>
      {filtered.map((char, i) => {
        return (
          <div key={i}>
            <CharCardDetails char={char} />
            {char.initial} {char.final} {char.pinyin[0].tone} |{" "}
            {char.tags.join(",")} | need tags:
            {char.needTags.join(",")}
            {char.ankiId ? (
              <button
                className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors"
                onClick={async () => {
                  for (const needTag of char.needTags) {
                    await anki.note.addTags({
                      notes: [char.ankiId || 0],
                      tags: needTag,
                    });
                  }
                  alert("Fixed!");
                }}
              >
                Auto-fix!
              </button>
            ) : undefined}
            <hr />
          </div>
        );
      })}
    </>
  );
}

function IntegrityPropNames() {
  const { props } = useOutletContext<OutletContext>();

  const filtered = getPropNameMigrations(props);

  if (!filtered.length) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">Migration of prop names:</h3>
      {filtered.map((prop, i) => (
        <div key={i}>
          <PropCard prop={prop} />
          {prop.mainTagname} === {"prop::" + prop.prop}
          <hr />
        </div>
      ))}
    </>
  );
}

function LowerCasePinyinChars() {
  const { characters } = useOutletContext<OutletContext>();
  const filtered = getLowercasePinyinChars(characters);
  if (filtered.length === 0) {
    return undefined;
  }
  return (
    <>
      <h3 className="font-serif text-3xl">Lowercase pinyin:</h3>
      {filtered.map((char, i) => (
        <div key={i}>Not lowercase pinyin for char: {char.traditional}</div>
      ))}
    </>
  );
}

function IntegrityCharacterZhuyin() {
  const { characters } = useOutletContext<OutletContext>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filtered = getCharacterZhuyinInconsistencies(characters);

  if (filtered.length === 0) {
    return undefined;
  }

  return (
    <>
      <h3 className="font-serif text-3xl">
        Character Zhuyin Inconsistency Issues:{" "}
        <button
          className="rounded-2xl px-2 py-1 m-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-700 transition-colors disabled:opacity-50"
          disabled={isProcessing}
          onClick={async () => {
            setIsProcessing(true);
            setProgress({ current: 0, total: filtered.length });

            for (let i = 0; i < filtered.length; i++) {
              const char = filtered[i];
              setProgress({ current: i + 1, total: filtered.length });

              await anki.note.updateNoteFields({
                note: {
                  id: char.ankiId || 0,

                  fields: { Zhuyin: char.expectedZhuyin },
                },
              });
            }

            setIsProcessing(false);
            alert("Fixed all character zhuyin inconsistencies!");
          }}
        >
          {isProcessing ? "Processing..." : "Fix all zhuyin!"}
        </button>
        {isProcessing && (
          <div className="mt-2">
            <progress
              className="w-full h-2"
              value={progress.current}
              max={progress.total}
            />
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {progress.current} / {progress.total} characters
            </div>
          </div>
        )}
      </h3>

      <div className="mx-4">
        {filtered.map((char, i) => (
          <div key={i} className="border-b py-2">
            <CharCardDetails char={char} />
            <div className="text-sm">
              Current Zhuyin:{" "}
              <span className="text-red-500">
                {char.zhuyinAnki?.[0] || "(empty)"}
              </span>
            </div>
            <div className="text-sm">
              Expected Zhuyin:{" "}
              <span className="text-green-500">{char.expectedZhuyin}</span>
            </div>
            <button
              className="rounded-2xl px-2 py-1 mt-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 hover:bg-green-300 dark:hover:bg-green-700 transition-colors text-sm"
              onClick={async () => {
                await anki.note.updateNoteFields({
                  note: {
                    id: char.ankiId || 0,

                    fields: { Zhuyin: char.expectedZhuyin },
                  },
                });
                alert("Fixed!");
              }}
            >
              Fix zhuyin field
            </button>
            <button
              className="rounded-2xl bg-blue-100 dark:bg-blue-900 p-1 ml-2 inline text-xs text-blue-500 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={async () => {
                await ankiOpenBrowse(`Traditional:${char.traditional}`);
              }}
            >
              anki
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export const CharConflictSections: React.FC<{}> = ({}) => {
  return (
    <>
      <section className="block m-4">
        <IntegrityActorPlaceAnki />
      </section>
      <section className="block m-4">
        <IntegrityPropNames />
      </section>
      <section className="block m-4">
        <LowerCasePinyinChars />
      </section>
      <section className="block m-4">
        <IntegrityCharacterZhuyin />
      </section>
    </>
  );
};
