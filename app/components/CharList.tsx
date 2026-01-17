import { type CharacterType } from "~/data/characters";
import { CharCard, CharCardDetails } from "./CharCard";
import { PinyinText } from "./PinyinText";
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
  title: string;
  conflicts: Array<{
    character: CharacterType;
    reason:
      | { type: "missing_props"; props: string[] }
      | { type: "no_pinyin_from_phrases" }
      | { type: "pinyin_mismatch"; missingPinyin: string[] };
  }>;
  charPhrasesPinyin: CharsToPhrasesPinyin;
}> = ({ title, conflicts, charPhrasesPinyin }) => {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="font-serif text-3xl m-4">
        {title} ({conflicts.length}):
      </h3>
      <div className="block">
        {conflicts.map((c) => c.character.traditional)}
      </div>
      <div className="block">
        {conflicts.map((conflict, i) => {
          const v = conflict.character;
          const reason = conflict.reason;

          return (
            <div className="w-full" key={i}>
              <CharCardDetails char={v} />
              <div className="">
                {reason.type === "missing_props" && (
                  <div className="mb-2">
                    <span className="font-bold text-red-600">
                      Missing props:
                    </span>
                    <TagList tags={reason.props} />
                  </div>
                )}

                {reason.type === "no_pinyin_from_phrases" && (
                  <div className="mb-2">
                    <span className="font-bold text-red-600">
                      No pinyin found from phrases
                    </span>
                  </div>
                )}

                {reason.type === "pinyin_mismatch" && (
                  <div className="mb-2">
                    <span className="font-bold text-red-600">
                      Missing pinyin in Anki:
                    </span>
                    {reason.missingPinyin.map((p, idx) => (
                      <span
                        key={idx}
                        className="ml-2 text-red-500"
                        dangerouslySetInnerHTML={{ __html: p }}
                      ></span>
                    ))}
                  </div>
                )}

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
                    ),
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
