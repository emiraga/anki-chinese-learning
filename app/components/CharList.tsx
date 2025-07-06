import { type CharactersType, type CharacterType } from "~/data/characters";
import { CharCard } from "./CharCard";
import { PinyinText } from "./PinyinText";
import type { KnownPropsType } from "~/data/props";
import { TagList } from "./TagList";

export const CharList: React.FC<{ characters: CharacterType[] }> = ({
  characters,
}) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 m-2">
      {characters.map((v, i) => (
        <div key={i}>
          <CharCard v={v} />
        </div>
      ))}
    </div>
  );
};

export function getConflictingChars(
  knownProps: KnownPropsType,
  characters: CharactersType
): CharacterType[] {
  return Object.values(characters).filter((v) => {
    for (const tag of v.tags) {
      if (tag.startsWith("prop::")) {
        if (knownProps[tag] === undefined) {
          return true;
        }
      }
    }
    if (v.pinyin_anki_1.includes(">" + v.pinyin + "<")) {
      return false;
    }
    if (v.pinyin_anki_1 === v.pinyin) {
      return false;
    }
    return true;
  });
}

export const CharListConflicts: React.FC<{
  knownProps: KnownPropsType;
  characters: CharactersType;
}> = ({ knownProps, characters }) => {
  let chars = getConflictingChars(knownProps, characters);
  if (chars.length === 0) {
    return <div className="m-5">No Character Conflicts</div>;
  }

  return (
    <div className="block">
      {chars.map((v, i) => {
        return (
          <div className="flex w-full mx-2" key={i}>
            <div className="w-12 text-4xl">{v.traditional}</div>
            <div className="flex-1">
              <PinyinText v={v} />
              <div>
                <span
                  dangerouslySetInnerHTML={{ __html: v.pinyin_anki_1 }}
                ></span>
                <span
                  className="ml-10"
                  dangerouslySetInnerHTML={{ __html: v.pinyin_anki_2 }}
                ></span>
                <div>
                  <TagList
                    tags={v.tags.filter(
                      (t) =>
                        t.startsWith("prop::") && knownProps[t] === undefined
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
