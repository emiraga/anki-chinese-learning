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
