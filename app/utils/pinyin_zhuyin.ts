/**
 * Utility functions for processing pinyin and zhuyin pronunciations
 */

/**
 * Strips tone marks from zhuyin notation
 * Removes tone marks: ˊ ˇ ˋ ˙ (tones 2, 3, 4, 5) and keeps tone 1 (no mark)
 */
export const stripZhuyinTones = (zhuyin: string): string => {
  return zhuyin.replace(/[ˊˇˋ˙]/g, "");
};

/**
 * Strips tone marks from pinyin notation
 * Removes HTML tags first, then converts accented vowels to basic vowels
 */
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