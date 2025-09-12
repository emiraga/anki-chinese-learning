export interface ZhuyinCharacter {
  zhuyin: string;
  pinyin: string;
  englishKey: string;
  finger: string;
}

export const ZHUYIN_MAPPING: ZhuyinCharacter[] = [
  // Top row (1-0)
  { zhuyin: "ㄅ", pinyin: "b", englishKey: "1", finger: "left-pinky" },
  { zhuyin: "ㄉ", pinyin: "d", englishKey: "2", finger: "left-ring" },
  { zhuyin: "ˇ", pinyin: "ˇ", englishKey: "3", finger: "left-middle" },
  { zhuyin: "ˋ", pinyin: "ˋ", englishKey: "4", finger: "left-index" },
  { zhuyin: "ㄓ", pinyin: "zh", englishKey: "5", finger: "left-index" },
  { zhuyin: "ˊ", pinyin: "ˊ", englishKey: "6", finger: "right-index" },
  { zhuyin: "˙", pinyin: "˙", englishKey: "7", finger: "right-index" },
  { zhuyin: "ㄚ", pinyin: "a", englishKey: "8", finger: "right-middle" },
  { zhuyin: "ㄞ", pinyin: "ai", englishKey: "9", finger: "right-ring" },
  { zhuyin: "ㄢ", pinyin: "an", englishKey: "0", finger: "right-pinky" },
  { zhuyin: "ㄦ", pinyin: "er", englishKey: "-", finger: "right-pinky" },

  // QWERTY row
  { zhuyin: "ㄆ", pinyin: "p", englishKey: "q", finger: "left-pinky" },
  { zhuyin: "ㄊ", pinyin: "t", englishKey: "w", finger: "left-ring" },
  { zhuyin: "ㄍ", pinyin: "g", englishKey: "e", finger: "left-middle" },
  { zhuyin: "ㄐ", pinyin: "j", englishKey: "r", finger: "left-index" },
  { zhuyin: "ㄔ", pinyin: "ch", englishKey: "t", finger: "left-index" },
  { zhuyin: "ㄗ", pinyin: "z", englishKey: "y", finger: "right-index" },
  { zhuyin: "ㄧ", pinyin: "i", englishKey: "u", finger: "right-index" },
  { zhuyin: "ㄛ", pinyin: "o", englishKey: "i", finger: "right-middle" },
  { zhuyin: "ㄟ", pinyin: "ei", englishKey: "o", finger: "right-ring" },
  { zhuyin: "ㄣ", pinyin: "en", englishKey: "p", finger: "right-pinky" },

  // ASDF row
  { zhuyin: "ㄇ", pinyin: "m", englishKey: "a", finger: "left-pinky" },
  { zhuyin: "ㄋ", pinyin: "n", englishKey: "s", finger: "left-ring" },
  { zhuyin: "ㄎ", pinyin: "k", englishKey: "d", finger: "left-middle" },
  { zhuyin: "ㄑ", pinyin: "q", englishKey: "f", finger: "left-index" },
  { zhuyin: "ㄕ", pinyin: "sh", englishKey: "g", finger: "left-index" },
  { zhuyin: "ㄘ", pinyin: "c", englishKey: "h", finger: "right-index" },
  { zhuyin: "ㄨ", pinyin: "u", englishKey: "j", finger: "right-index" },
  { zhuyin: "ㄜ", pinyin: "e", englishKey: "k", finger: "right-middle" },
  { zhuyin: "ㄠ", pinyin: "ao", englishKey: "l", finger: "right-ring" },
  { zhuyin: "ㄤ", pinyin: "ang", englishKey: ";", finger: "right-pinky" },

  // ZXCV row
  { zhuyin: "ㄈ", pinyin: "f", englishKey: "z", finger: "left-pinky" },
  { zhuyin: "ㄌ", pinyin: "l", englishKey: "x", finger: "left-ring" },
  { zhuyin: "ㄏ", pinyin: "h", englishKey: "c", finger: "left-middle" },
  { zhuyin: "ㄒ", pinyin: "x", englishKey: "v", finger: "left-index" },
  { zhuyin: "ㄖ", pinyin: "r", englishKey: "b", finger: "left-index" },
  { zhuyin: "ㄙ", pinyin: "s", englishKey: "n", finger: "right-index" },
  { zhuyin: "ㄩ", pinyin: "ü", englishKey: "m", finger: "right-index" },
  { zhuyin: "ㄝ", pinyin: "ê", englishKey: ",", finger: "right-middle" },
  { zhuyin: "ㄡ", pinyin: "ou", englishKey: ".", finger: "right-ring" },
  { zhuyin: "ㄥ", pinyin: "eng", englishKey: "/", finger: "right-pinky" },
];

interface CharacterStats {
  character: string;
  attempts: number;
  successes: number;
  successRate: number;
}

interface TypingStats {
  [pinyin: string]: CharacterStats;
}

export const getRandomZhuyinCharacter = (
  stats?: TypingStats
): ZhuyinCharacter => {
  if (!stats || Object.keys(stats).length === 0) {
    const randomIndex = Math.floor(Math.random() * ZHUYIN_MAPPING.length);
    return ZHUYIN_MAPPING[randomIndex];
  }

  const weights = ZHUYIN_MAPPING.map((char) => {
    const charStats = stats[char.zhuyin];

    if (!charStats || charStats.attempts === 0) {
      return 3.0;
    }

    const attemptWeight = Math.max(0.1, 2.0 - charStats.attempts * 0.1);
    const successWeight = Math.max(0.1, 2.0 - charStats.successRate * 0.02);

    return attemptWeight * successWeight;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (let i = 0; i < weights.length; i++) {
    randomValue -= weights[i];
    if (randomValue <= 0) {
      return ZHUYIN_MAPPING[i];
    }
  }

  return ZHUYIN_MAPPING[ZHUYIN_MAPPING.length - 1];
};

export const findZhuyinByKey = (key: string): ZhuyinCharacter | undefined => {
  return ZHUYIN_MAPPING.find(
    (item) => item.englishKey.toLowerCase() === key.toLowerCase()
  );
};
