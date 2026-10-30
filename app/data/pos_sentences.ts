import type { PosCode } from "./pos";

/**
 * Example sentences split into words, each word tagged with its TOCFL part of
 * speech code. The codes were checked against the TOCFL 8000 word list
 * (`data/tocfl/`).
 */

export type PosToken = {
  zh: string;
  /** Absent for punctuation. */
  pos?: PosCode;
  /** Short English meaning of the word in this sentence. */
  gloss?: string;
  /** What this word does in the sentence, shown in the tooltip. */
  note?: string;
};

export type PosSentence = {
  tokens: PosToken[];
  en: string;
  /** What the sentence shows about parts of speech. */
  note: string;
};

export const POS_SENTENCES: PosSentence[] = [
  {
    en: "I bought three books at the bookstore yesterday.",
    note: "Numbers and time words are nouns. A number needs a measure word before the noun it counts.",
    tokens: [
      { zh: "我", pos: "N", gloss: "I" },
      {
        zh: "昨天",
        pos: "N",
        gloss: "yesterday",
        note: "Time words are nouns.",
      },
      {
        zh: "在",
        pos: "Prep",
        gloss: "at",
        note: "在 + place: where the action happens.",
      },
      { zh: "書店", pos: "N", gloss: "bookstore" },
      { zh: "買", pos: "V", gloss: "buy" },
      {
        zh: "了",
        pos: "Ptc",
        gloss: "(done)",
        note: "Right after the verb: the buying is completed.",
      },
      {
        zh: "三",
        pos: "N",
        gloss: "three",
        note: "Numbers are nouns in the TOCFL list.",
      },
      {
        zh: "本",
        pos: "M",
        gloss: "(volume)",
        note: "Measure word for books.",
      },
      { zh: "書", pos: "N", gloss: "book" },
      { zh: "。" },
    ],
  },
  {
    en: "My older brother is riding a bike.",
    note: "The same 在 is an adverb when it goes straight before the verb: the action is in progress.",
    tokens: [
      { zh: "哥哥", pos: "N", gloss: "older brother" },
      {
        zh: "在",
        pos: "Adv",
        gloss: "(in progress)",
        note: "在 + verb, with no place: the action is going on right now.",
      },
      { zh: "騎", pos: "V", gloss: "ride" },
      { zh: "腳踏車", pos: "N", gloss: "bicycle" },
      { zh: "。" },
    ],
  },
  {
    en: "Because he got sick, he can't come to class today.",
    note: "因為…所以… are conjunctions linking two clauses. The auxiliary 能 goes before the main verb, and 不 before the auxiliary.",
    tokens: [
      { zh: "因為", pos: "Conj", gloss: "because" },
      { zh: "他", pos: "N", gloss: "he", note: "Pronouns are nouns." },
      {
        zh: "生病",
        pos: "Vp-sep",
        gloss: "get sick",
        note: "A change of state: he wasn't sick, now he is.",
      },
      {
        zh: "了",
        pos: "Ptc",
        gloss: "(happened)",
        note: "The change has taken place.",
      },
      { zh: "，" },
      { zh: "所以", pos: "Conj", gloss: "so" },
      { zh: "今天", pos: "N", gloss: "today" },
      { zh: "不", pos: "Adv", gloss: "not" },
      {
        zh: "能",
        pos: "Vaux",
        gloss: "can",
        note: "Auxiliary: comes before another verb.",
      },
      { zh: "來", pos: "V", gloss: "come" },
      {
        zh: "上課",
        pos: "V-sep",
        gloss: "attend class",
        note: "Verb + object word: can split, e.g. 上了兩個小時的課.",
      },
      { zh: "。" },
    ],
  },
  {
    en: "This coffee is too sweet. Could you give me a cup of tea?",
    note: "Determiner + measure word + noun. A state verb like 甜 is the predicate on its own, with no 'is'.",
    tokens: [
      {
        zh: "這",
        pos: "Det",
        gloss: "this",
        note: "Determiners point at a noun, and take a measure word before it.",
      },
      { zh: "杯", pos: "M", gloss: "cup" },
      { zh: "咖啡", pos: "N", gloss: "coffee" },
      { zh: "太", pos: "Adv", gloss: "too" },
      {
        zh: "甜",
        pos: "Vs",
        gloss: "sweet",
        note: "English adjectives are mostly state verbs: no 是 needed.",
      },
      { zh: "了", pos: "Ptc", gloss: "(excess)", note: "太…了: too much." },
      { zh: "，" },
      { zh: "可以", pos: "Vaux", gloss: "may" },
      { zh: "給", pos: "V", gloss: "give" },
      { zh: "我", pos: "N", gloss: "me" },
      { zh: "一", pos: "N", gloss: "one" },
      { zh: "杯", pos: "M", gloss: "cup" },
      { zh: "茶", pos: "N", gloss: "tea" },
      {
        zh: "嗎",
        pos: "Ptc",
        gloss: "(question)",
        note: "Turns the sentence into a yes/no question.",
      },
      { zh: "？" },
    ],
  },
  {
    en: "We play basketball together every weekend.",
    note: "Several adverbs can stand in a row between the subject and the verb.",
    tokens: [
      { zh: "我們", pos: "N", gloss: "we" },
      { zh: "每", pos: "Det", gloss: "every" },
      { zh: "個", pos: "M", gloss: "(general)" },
      { zh: "週末", pos: "N", gloss: "weekend" },
      {
        zh: "都",
        pos: "Adv",
        gloss: "all",
        note: "Sums up what comes before it: every weekend, without exception.",
      },
      { zh: "一起", pos: "Adv", gloss: "together" },
      { zh: "打", pos: "V", gloss: "play" },
      { zh: "籃球", pos: "N", gloss: "basketball" },
      { zh: "。" },
    ],
  },
  {
    en: "He broke my phone.",
    note: "把 moves the object before the verb. The action verb 弄 and the process verb 壞 together say what was done and how it ended.",
    tokens: [
      { zh: "他", pos: "N", gloss: "he" },
      {
        zh: "把",
        pos: "Ptc",
        gloss: "(object)",
        note: "把 + object + verb: what happened to the object.",
      },
      { zh: "我", pos: "N", gloss: "I" },
      {
        zh: "的",
        pos: "Ptc",
        gloss: "'s",
        note: "Links a modifier to the noun after it.",
      },
      { zh: "手機", pos: "N", gloss: "phone" },
      { zh: "弄", pos: "V", gloss: "handle, do" },
      {
        zh: "壞",
        pos: "Vp",
        gloss: "break",
        note: "The result: the phone changed into broken.",
      },
      { zh: "了", pos: "Ptc", gloss: "(done)" },
      { zh: "。" },
    ],
  },
  {
    en: "I only slept five hours last night.",
    note: "A separable verb splits to let in 了 and the duration: 睡覺 becomes 睡…覺.",
    tokens: [
      { zh: "我", pos: "N", gloss: "I" },
      { zh: "昨天", pos: "N", gloss: "yesterday" },
      { zh: "只", pos: "Adv", gloss: "only" },
      { zh: "睡", pos: "V-sep", gloss: "sleep", note: "First half of 睡覺." },
      { zh: "了", pos: "Ptc", gloss: "(done)" },
      { zh: "五", pos: "N", gloss: "five" },
      { zh: "個", pos: "M", gloss: "(general)" },
      { zh: "小時", pos: "N", gloss: "hour" },
      { zh: "的", pos: "Ptc", gloss: "(of)" },
      {
        zh: "覺",
        pos: "V-sep",
        gloss: "(sleep)",
        note: "Second half of 睡覺.",
      },
      { zh: "。" },
    ],
  },
  {
    en: "Although I really like this phone, I don't have enough money.",
    note: "喜歡 is a state verb that takes an object; 夠 is a state verb that can only be the predicate (not *夠錢).",
    tokens: [
      { zh: "雖然", pos: "Conj", gloss: "although" },
      { zh: "我", pos: "N", gloss: "I" },
      { zh: "很", pos: "Adv", gloss: "very" },
      {
        zh: "喜歡",
        pos: "Vst",
        gloss: "like",
        note: "A state, so it takes 很; transitive, so it takes an object.",
      },
      { zh: "這", pos: "Det", gloss: "this" },
      {
        zh: "支",
        pos: "M",
        gloss: "(stick)",
        note: "Measure word for long thin things, phones and pens.",
      },
      { zh: "手機", pos: "N", gloss: "phone" },
      { zh: "，" },
      { zh: "但是", pos: "Conj", gloss: "but" },
      { zh: "我", pos: "N", gloss: "I" },
      { zh: "的", pos: "Ptc", gloss: "'s" },
      { zh: "錢", pos: "N", gloss: "money" },
      { zh: "不", pos: "Adv", gloss: "not" },
      {
        zh: "夠",
        pos: "Vs-pred",
        gloss: "enough",
        note: "Only as a predicate, after the noun.",
      },
      { zh: "。" },
    ],
  },
  {
    en: "He walked home from school.",
    note: "A preposition phrase (從 + place) goes before the verb. Two verbs in a row: walk, return.",
    tokens: [
      { zh: "他", pos: "N", gloss: "he" },
      { zh: "從", pos: "Prep", gloss: "from" },
      { zh: "學校", pos: "N", gloss: "school" },
      { zh: "走", pos: "V", gloss: "walk" },
      { zh: "回", pos: "V", gloss: "return" },
      { zh: "家", pos: "N", gloss: "home" },
      { zh: "。" },
    ],
  },
];
