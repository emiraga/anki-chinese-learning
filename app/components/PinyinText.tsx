import { Link } from "react-router";
import type { PinyinType } from "~/data/pinyin_function";

export const PinyinText: React.FC<{
  v: PinyinType | null;
}> = ({ v }) => {
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
        {v.pinyinAccented}
      </div>
    );
  }
  return (
    <span className={`font-bold ${toneColors[v.tone]}`}>
      <Link to={"/sylable/" + v.sylable}>{v.pinyinAccented}</Link>
    </span>
  );
};
