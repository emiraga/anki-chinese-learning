import pinyinSplit from "pinyin-split";
import {
  digitsToChinese,
  expandArabicNumerals,
  integerToChinese,
} from "./chinese_numerals";

describe("integerToChinese", () => {
  it.each([
    [0, "零"],
    [7, "七"],
    [10, "十"],
    [12, "十二"],
    [20, "二十"],
    [100, "一百"],
    [105, "一百零五"],
    [110, "一百一十"],
    [123, "一百二十三"],
    [1005, "一千零五"],
    [2020, "二千零二十"],
    [10000, "一萬"],
    [10500, "一萬零五百"],
    [12345, "一萬二千三百四十五"],
  ])("reads %i as %s", (n, expected) => {
    expect(integerToChinese(n)).toBe(expected);
  });

  it("rejects numbers it cannot read", () => {
    expect(() => integerToChinese(-1)).toThrow();
    expect(() => integerToChinese(1.5)).toThrow();
    expect(() => integerToChinese(1e8)).toThrow();
  });
});

describe("digitsToChinese", () => {
  it("reads each digit on its own", () => {
    expect(digitsToChinese("101")).toBe("一零一");
  });
});

describe("expandArabicNumerals", () => {
  const expand = (traditional: string, pinyin: string) =>
    expandArabicNumerals(traditional, pinyinSplit(pinyin));

  it("leaves text without digits unchanged", () => {
    expect(expand("復興路", "fù xīng lù")).toBe("復興路");
  });

  it("reads a number as a whole when the pinyin does", () => {
    expect(expand("復興路100號", "fù xīng lù yì bǎi hào")).toBe("復興路一百號");
  });

  it("reads a number digit by digit when the pinyin does", () => {
    expect(expand("復興路100號", "fù xīng lù yī líng líng hào")).toBe(
      "復興路一零零號",
    );
  });

  it("writes 兩 where the pinyin reads liǎng", () => {
    expect(expand("200號", "liǎng bǎi hào")).toBe("兩百號");
    expect(expand("200號", "èr bǎi hào")).toBe("二百號");
  });

  it("expands several numbers", () => {
    expect(expand("4段12號", "sì duàn shí èr hào")).toBe("四段十二號");
  });

  it("leaves the text unchanged when no reading fits the pinyin", () => {
    expect(expand("100號", "yì bǎi")).toBe("100號");
  });
});
