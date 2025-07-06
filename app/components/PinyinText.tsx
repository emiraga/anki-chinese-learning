import { Link } from "react-router";

export const PinyinText: React.FC<{
  v: { pinyin: string; tone: number; sylable: string | null } | null;
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
    return <div className={`font-bold ${toneColors[v.tone]}`}>{v.pinyin}</div>;
  }
  return (
    <span className={`font-bold ${toneColors[v.tone]}`}>
      <Link to={"/sylable/" + v.sylable}>{v.pinyin}</Link>
    </span>
  );
};
