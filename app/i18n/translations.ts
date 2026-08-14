import type { Language } from "./i18n";

/**
 * English source string -> per-language translation.
 *
 * Keyed by the exact English text used in the UI so that call sites can wrap an
 * existing label with t() without inventing keys. Missing entries fall back to
 * the English source (see i18n.tsx), so this table can grow incrementally.
 *
 * Only non-English languages need entries; "en" returns the source directly.
 */
export const translations: Record<
  string,
  Partial<Record<Language, string>>
> = {
  // App chrome
  "Learning Chinese": { "zh-Hant": "學中文" },
  reload: { "zh-Hant": "重新載入" },
  "loading...": { "zh-Hant": "載入中…" },

  // Top-level nav + submenus
  Pinyin: { "zh-Hant": "拼音" },
  Props: { "zh-Hant": "部件" },
  Characters: { "zh-Hant": "漢字" },
  "Sentence input": { "zh-Hant": "句子輸入" },
  "Todo Chars": { "zh-Hant": "待辦漢字" },
  Conflicts: { "zh-Hant": "衝突" },
  "All Props": { "zh-Hant": "所有部件" },
  "All Chars": { "zh-Hant": "所有漢字" },
  Heteronyms: { "zh-Hant": "多音字" },
  "Similar Props": { "zh-Hant": "相似部件" },
  "Sound Components": { "zh-Hant": "聲符" },
  "Sound Eval": { "zh-Hant": "發音評估" },
  Phrases: { "zh-Hant": "詞語" },
  "Discover More": { "zh-Hant": "探索更多" },
  Import: { "zh-Hant": "匯入" },
  Process: { "zh-Hant": "處理" },
  Homophones: { "zh-Hant": "同音字" },
  Study: { "zh-Hant": "學習" },
  "Weak Characters": { "zh-Hant": "弱點漢字" },
  Problematic: { "zh-Hant": "問題項目" },
  "Advance Cards": { "zh-Hant": "推進卡片" },
  "Sibling Cards": { "zh-Hant": "同源卡片" },
  Practice: { "zh-Hant": "練習" },
  Story: { "zh-Hant": "故事" },
  "Zhuyin Typing": { "zh-Hant": "注音打字" },
  Pronunciation: { "zh-Hant": "發音" },
  Stats: { "zh-Hant": "統計" },
  Settings: { "zh-Hant": "設定" },
  Integrity: { "zh-Hant": "資料完整性" },
  Migration: { "zh-Hant": "資料遷移" },
  Progress: { "zh-Hant": "進度" },
  "Exam level": { "zh-Hant": "檢定等級" },
  Help: { "zh-Hant": "說明" },

  // MorePhrases / Dangdai selector
  "Next level phrases Dangdai": { "zh-Hant": "當代中文下一級詞語" },
  Book: { "zh-Hant": "冊" },
  Lesson: { "zh-Hant": "課" },
  All: { "zh-Hant": "全部" },
};
