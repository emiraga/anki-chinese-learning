import { type CharactersType, type CharacterType } from "~/data/characters";
import { CharCard, CharCardDetails } from "./CharCard";
import { PinyinText } from "./PinyinText";
import type { KnownPropsType } from "~/data/props";
import { TagList } from "./TagList";
import type { CharsToPhrasesPinyin } from "~/data/phrases";
import { get_all_pinyin_from_lib } from "~/data/pinyin_function";
import { STYLE_TONE } from "pinyin";
import { comparePinyin } from "~/data/utils";

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
  characters: CharactersType,
  charPhrasesPinyin: CharsToPhrasesPinyin
): CharacterType[] {
  return Object.values(characters).filter((v) => {
    for (const tag of v.tags) {
      if (tag.startsWith("prop::")) {
        if (knownProps[tag] === undefined) {
          return true;
        }
      }
    }
    if (v.tags.includes("multiple-pronounciation-character")) {
      // TODO: handle this better
      return false;
    }

    if (
      !v.pinyin_1.includes(">" + v.pinyin_1 + "<") &&
      v.pinyin_1 !== v.pinyin_1
    ) {
      return true;
    }

    if (v.withSound) {
      if (!charPhrasesPinyin[v.traditional]) {
        return true;
      }
      if (!charPhrasesPinyin[v.traditional][v.pinyin_1]) {
        return true;
      }
    }
    if (charPhrasesPinyin[v.traditional]) {
      const best = Object.values(charPhrasesPinyin[v.traditional]).sort(
        comparePinyin
      )[0];
      if (best.pinyin_1 !== v.pinyin_1) {
        return true;
      }
    }
  });
}

export const CharListConflicts: React.FC<{
  knownProps: KnownPropsType;
  characters: CharactersType;
  charPhrasesPinyin: CharsToPhrasesPinyin;
}> = ({ knownProps, characters, charPhrasesPinyin }) => {
  let chars = getConflictingChars(knownProps, characters, charPhrasesPinyin);
  if (chars.length === 0) {
    return <div className="m-5">No Character Conflicts</div>;
  }

  return (
    <>
      <h3 className="font-serif text-3xl m-4">
        Character conflicts ({chars.length}):
      </h3>
      <div className="block">
        {chars.map((v, i) => {
          const missingProps = v.tags.filter(
            (t) => t.startsWith("prop::") && knownProps[t] === undefined
          );
          return (
            <div className="w-full" key={i}>
              <CharCardDetails char={v} />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 m-2">
                {v.pinyin_1.length ? (
                  <>
                    Anki1:
                    <div
                      className="ml-10"
                      dangerouslySetInnerHTML={{ __html: v.pinyin_1 }}
                    ></div>
                  </>
                ) : undefined}
                {v.pinyin_2 && v.pinyin_2.length ? (
                  <>
                    Anki2:
                    <div
                      className="ml-10"
                      dangerouslySetInnerHTML={{ __html: v.pinyin_2 }}
                    ></div>
                  </>
                ) : undefined}
                {missingProps.length ? (
                  <div>
                    Missing props list:
                    <TagList tags={missingProps} />
                  </div>
                ) : undefined}
                {charPhrasesPinyin[v.traditional] ? (
                  <p>
                    From phrases:
                    {Object.values(charPhrasesPinyin[v.traditional])
                      .sort(comparePinyin)
                      .map((pinyin) => (
                        <div key={pinyin.pinyin_1} className="ml-10">
                          <PinyinText v={pinyin} /> - {pinyin.count}
                        </div>
                      ))}
                  </p>
                ) : undefined}
                <p>
                  From library:
                  {get_all_pinyin_from_lib(v.traditional, STYLE_TONE).map(
                    (p, i) => (
                      <p key={i}>{p}</p>
                    )
                  )}
                </p>
              </div>
              <hr />
            </div>
          );
        })}
      </div>
    </>
  );
};
