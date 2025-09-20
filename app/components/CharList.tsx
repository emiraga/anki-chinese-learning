import { type CharacterType } from "~/data/characters";
import { CharCard, CharCardDetails } from "./CharCard";
import { PinyinText } from "./PinyinText";
import type { KnownPropsType } from "~/data/props";
import { TagList } from "./TagList";
import { type CharsToPhrasesPinyin } from "~/data/phrases";
import { getAllPinyinUnreliable, comparePinyin } from "~/utils/pinyin";
import pinyin from "pinyin";

export const CharList: React.FC<{
  characters: CharacterType[];
  showZhuyin?: boolean;
}> = ({ characters, showZhuyin }) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 m-2">
      {characters.map((v, i) => (
        <div key={i}>
          <CharCard v={v} showZhuyin={showZhuyin} />
        </div>
      ))}
    </div>
  );
};

export const CharListConflicts: React.FC<{
  knownProps: KnownPropsType;
  conflicting: CharacterType[];
  charPhrasesPinyin: CharsToPhrasesPinyin;
}> = ({ knownProps, conflicting, charPhrasesPinyin }) => {
  if (conflicting.length === 0) {
    return <div className="m-5">No Character Conflicts</div>;
  }

  return (
    <>
      <h3 className="font-serif text-3xl m-4">
        Character conflicts ({conflicting.length}):
      </h3>
      <div className="block">
        {conflicting.map((v, i) => {
          const missingProps = v.tags.filter(
            (t) => t.startsWith("prop::") && knownProps[t] === undefined
          );
          return (
            <div className="w-full" key={i}>
              <CharCardDetails char={v} />
              <div className="">
                {missingProps.length ? (
                  <div>
                    Missing props list:
                    <TagList tags={missingProps} />
                  </div>
                ) : undefined}

                <div>
                  Anki:
                  {v.pinyin.map((p) => (
                    <span
                      key={p.pinyinAccented}
                      className="ml-10"
                      dangerouslySetInnerHTML={{ __html: p.pinyinAccented }}
                    ></span>
                  ))}
                </div>
                <div>
                  From phrases:
                  {charPhrasesPinyin[v.traditional]
                    ? Object.values(charPhrasesPinyin[v.traditional])
                        .sort(comparePinyin)
                        .map((pinyin) => (
                          <span key={pinyin.pinyinAccented} className="ml-10">
                            <PinyinText v={pinyin} /> - {pinyin.count}
                          </span>
                        ))
                    : undefined}
                </div>
                <p>
                  From library:
                  {getAllPinyinUnreliable(v.traditional, pinyin.STYLE_TONE).map(
                    (p, i) => (
                      <span className="ml-10" key={i}>
                        {p}
                      </span>
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
