import pinyin from "pinyin";

export type PinyinType = {
  pinyinAccented: string;
  tone: number;
  sylable: string;
  count?: number;
  ignoredFifthTone?: boolean;
};

export function getPinyinUnreliable(traditional: string, style: number) {
  let out = pinyin(traditional, {
    style,
    heteronym: true,
  });
  return out[0][0];
}

export function getAllPinyinUnreliable(traditional: string, style: number) {
  return pinyin(traditional, {
    style,
    heteronym: true,
  })[0];
}

export function comparePinyin(a: PinyinType, b: PinyinType) {
  if (a.sylable === b.sylable) {
    if (a.tone === 5) {
      return +1;
    }
    if (b.tone === 5) {
      return -1;
    }
  }
  return (b.count ?? 0) - (a.count ?? 0);
}

export function cleanPinyinAnkiField(pinyin: string) {
  return pinyin
    .replace(/\<span style="color: rgb\([0-9, ]+\);"\>/g, "")
    .replace(/\<\/span\>/g, "");
}
