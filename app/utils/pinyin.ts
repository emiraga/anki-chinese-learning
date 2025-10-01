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

export const stripPinyinTones = (pinyin: string): string => {
  const cleanPinyin = pinyin
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, (match) => {
      // Convert accented vowels to basic vowels
      const map: { [key: string]: string } = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
      };
      return map[match] || match;
    });
  return cleanPinyin;
};