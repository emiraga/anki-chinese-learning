import pinyin from "pinyin";

export type PinyinType = {
  pinyin_1: string;
  tone: number;
  sylable: string;
  count: number;
};

export function get_pinyin_unreliable(traditional: string, style: number) {
  let out = pinyin(traditional, {
    style,
    heteronym: true,
  });
  return out[0][0];
}

export function get_all_pinyin_from_lib(traditional: string, style: number) {
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
  return b.count - a.count;
}

export function cleanPinyinAnkiField(pinyin: string) {
  return pinyin
    .replace(/\<span style="color: rgb\([0-9, ]+\);"\>/g, "")
    .replace(/\<\/span\>/g, "");
}
