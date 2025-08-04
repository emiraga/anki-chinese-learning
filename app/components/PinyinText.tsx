import { Link } from "react-router";
import { Fragment } from "react/jsx-runtime";
import type { PinyinType } from "~/data/pinyin_function";
import { PINYIN_TO_ZHUYIN } from "~/data/zhuyin";

export const PinyinText: React.FC<{
  v: PinyinType | null;
  showZhuyin?: boolean;
}> = ({ v, showZhuyin }) => {
  const toneColors = [
    "", // Unknown tone
    "text-red-500", // Tone 1
    "text-green-500", // Tone 2
    "text-blue-500", // Tone 3
    "text-purple-500", // Tone 4
    "text-gray-500", // Tone 5
  ];
  if (v === null) {
    return <></>;
  }
  if (v.sylable === null) {
    return (
      <div className={`font-bold ${toneColors[v.tone]}`}>
        {v.pinyinAccented}x
      </div>
    );
  }
  return (
    <span className={`font-bold ${toneColors[v.tone]}`}>
      <Link to={"/sylable/" + v.sylable}>
        {v.pinyinAccented}
        {showZhuyin ? (
          <span className="text-xs inline-block">
            &nbsp;
            {PINYIN_TO_ZHUYIN[v.sylable]}
          </span>
        ) : undefined}
      </Link>
    </span>
  );
};

export const PinyinList: React.FC<{
  pinyin: PinyinType[];
}> = ({ pinyin }) => {
  const filtered = pinyin.filter((p) => !p.ignoredFifthTone);
  return (
    <>
      {filtered.map((p, i) => (
        <Fragment key={i}>
          <PinyinText v={p} />
          {i < filtered.length - 1 ? ", " : undefined}
        </Fragment>
      ))}
    </>
  );
};
