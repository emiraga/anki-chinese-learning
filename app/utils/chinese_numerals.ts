const DIGITS = "零一二三四五六七八九";
const SMALL_UNITS = ["千", "百", "十", ""];

// Stands in for a 二 that came from a digit, until the pinyin decides
// whether it is read èr or liǎng (兩百, 兩千, 兩萬).
const TWO_PLACEHOLDER = "\u0000";

function below10000(n: number): string {
  let out = "";
  let pendingZero = false;
  String(n)
    .padStart(4, "0")
    .split("")
    .map(Number)
    .forEach((digit, i) => {
      if (digit === 0) {
        pendingZero = out.length > 0;
        return;
      }
      if (pendingZero) {
        out += "零";
        pendingZero = false;
      }
      out += DIGITS[digit] + SMALL_UNITS[i];
    });
  return out;
}

/**
 * Reads a non-negative integer below 10^8 as one Chinese number:
 * 100 → 一百, 105 → 一百零五, 12 → 十二, 10500 → 一萬零五百.
 */
export function integerToChinese(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e8) {
    throw new Error(`Cannot read ${n} as a Chinese number`);
  }
  if (n === 0) {
    return "零";
  }
  const high = Math.floor(n / 10000);
  const low = n % 10000;
  let out = high > 0 ? below10000(high) + "萬" : "";
  if (low > 0) {
    if (high > 0 && low < 1000) {
      out += "零";
    }
    out += below10000(low);
  }
  // 10–19 at the start are read 十, 十二, not 一十, 一十二.
  return out.startsWith("一十") ? out.slice(1) : out;
}

/** Reads a digit string one digit at a time: 123 → 一二三, 101 → 一零一. */
export function digitsToChinese(digits: string): string {
  return digits
    .split("")
    .map((d) => DIGITS[Number(d)])
    .join("");
}

const DIGIT_RUN = /[0-9]+/g;

/** liǎng → liang: drops the tone marks, which NFD splits off as combining marks. */
const toneless = (syllable: string) =>
  syllable
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Replaces runs of ASCII digits in `text` with Chinese numerals, so that each
 * character lines up with one syllable of `syllables`.
 *
 * A number can be read as a whole (100號 → 一百號, yìbǎi hào) or digit by digit
 * (100號 → 一零零號, yī líng líng hào); the reading that gives one character per
 * syllable is used, and a 二 is written 兩 where the pinyin says liǎng.
 * Text without digits, or whose digits fit neither reading, is returned
 * unchanged.
 */
export function expandArabicNumerals(
  text: string,
  syllables: readonly string[],
): string {
  if (!/[0-9]/.test(text)) {
    return text;
  }
  const readings: ((run: string) => string)[] = [
    (run) => (run.length > 8 ? digitsToChinese(run) : integerToChinese(Number(run))),
    digitsToChinese,
  ];
  for (const read of readings) {
    const expanded = Array.from(
      text.replace(DIGIT_RUN, (run) => read(run).replaceAll("二", TWO_PLACEHOLDER)),
    );
    if (expanded.length === syllables.length) {
      return expanded
        .map((char, i) =>
          char !== TWO_PLACEHOLDER
            ? char
            : toneless(syllables[i]) === "liang"
              ? "兩"
              : "二",
        )
        .join("");
    }
  }
  return text;
}
