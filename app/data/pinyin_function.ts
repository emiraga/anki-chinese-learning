import pinyin from "pinyin";

interface ToneMapping {
  STYLE_TONE: string;
  STYLE_TONE2: string;
}

const SECOND_PINYIN_CHOICE = "個說麽咖行體誰漂都覺為亞幾只單便胖華樂妳";

const MAP_ANSWER: { [key1: string]: ToneMapping } = {
  們: { STYLE_TONE: "men", STYLE_TONE2: "men5" },
  榦: { STYLE_TONE: "gān", STYLE_TONE2: "gan1" },
  乾: { STYLE_TONE: "gān", STYLE_TONE2: "gan1" },
  蘋: { STYLE_TONE: "píng", STYLE_TONE2: "ping4" },
  誰: { STYLE_TONE: "shéi", STYLE_TONE2: "shei2" },
  姊: { STYLE_TONE: "jiě", STYLE_TONE2: "jie3" },
  舌: { STYLE_TONE: "shé", STYLE_TONE2: "she2" },
  和: { STYLE_TONE: "hàn", STYLE_TONE2: "han4" },
  // 便: { STYLE_TONE: "pián", STYLE_TONE2: "pian2" },
  許: { STYLE_TONE: "xǔ", STYLE_TONE2: "xu3" },
  胖: { STYLE_TONE: "pàng", STYLE_TONE2: "pang4" },
  微: { STYLE_TONE: "wéi", STYLE_TONE2: "wei2" },
};

export function get_pinyin(traditional: string, style: number) {
  if (MAP_ANSWER[traditional] !== undefined) {
    if (style === pinyin.STYLE_TONE) {
      return MAP_ANSWER[traditional].STYLE_TONE;
    } else if (style === pinyin.STYLE_TONE2) {
      return MAP_ANSWER[traditional].STYLE_TONE2;
    }
  }
  let out = pinyin(traditional, {
    style,
    heteronym: true,
  });
  if (SECOND_PINYIN_CHOICE.includes(traditional)) {
    return out[0][1];
  }
  return out[0][0];
}

export function get_all_pinyin_from_lib(traditional: string, style: number) {
  return pinyin(traditional, {
    style,
    heteronym: true,
  })[0];
}
