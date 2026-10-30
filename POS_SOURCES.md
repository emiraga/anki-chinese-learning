# Part of speech sources

Sources that give a part of speech (POS) for a Chinese word. This list is meant
as a starting point for downloading POS data so it is available offline, instead
of looking words up one by one or asking an LLM.

The app uses the TOCFL codes from `app/data/pos.json` (V, Vs, Vst, Vp, Vaux,
...), which follow the 鄧守信 (Teng Shou-hsin) classification. Most other sources
use a coarser scheme (verb/noun/adverb) or a different one entirely (CKIP), so
their tags have to be mapped and can't always be converted 1:1.

Checked with the test word 繼續 (2026-10). Status for each item:
"verified" = checked in this repo or online, "unverified" = not yet checked,
needs a look before relying on it.

## Sources that return POS

### TOCFL 華語八千詞表 (primary source)

- **Scheme:** TOCFL codes, same as `pos.json`. Multiple categories per word
  are comma-separated (e.g. `V, Vaux`).
- **繼續:** `V` (Level 3 list).
- **Offline:** already in the repo, `data/tocfl/20240923/*.csv` (one CSV per
  level, parsed by `utils/shared/tocfl_csv.py`). Column `詞類 / Part of speech`.
- **Download:** https://tocfl.edu.tw/tocfl/ (download section; the older URL
  `sc-top.org.tw/chinese/download.php` cited in the 2022 PDF no longer
  responds). Verified that the site is up; check for newer versions than
  20240923.
- **Coverage:** ~8000 words only. Words outside the list have no POS here.
- **Reliability:** high. This is the authoritative source for the codes the app
  uses.

### Wiktionary (zh.wiktionary.org)

- **Scheme:** coarse Chinese terms (動詞, 名詞, 副詞, ...), one per sense.
- **繼續:** 動詞 (verb) "延續", and 名詞 (noun) "連續而不間斷".
- **Online:** https://zh.wiktionary.org/zh-hant/繼續
- **Download:** Wiktextract JSONL dumps at https://kaikki.org/zhwiktionary/
  (Chinese edition) and https://kaikki.org/dictionary/Chinese/ (English
  edition, Chinese words). Wiktextract entries normally carry a `pos` field.
  Verified that both pages exist; the file layout and size are unverified.
- **Coverage:** large, includes multi-character words.
- **Reliability:** medium. Crowd-sourced, no Vs/Vp/Vaux distinctions, so only
  useful as a sanity check or a fallback for words not in TOCFL.

### moedict 萌典 (MOE 重編國語辭典修訂本)

- **Scheme:** traditional Chinese grammar labels in a `type` field per
  definition: 動, 名, 副, 形, 助, 歎, 擬, 代, 連.
- **繼續:** no POS. In practice the `type` field is only present on
  single-character entries; in the local cache 16 of 1705 files have it, all
  single characters (還, 著, 吧, 長, ...).
- **Offline:** partially cached in `data/moedict/*.json`, fetched by
  `utils/shared/moedict.py` from `https://www.moedict.tw/uni/{word}`.
- **Download:** full dump at https://github.com/g0v/moedict-data
  (`dict-revised.json.xz`, MOE license: content may be converted but not
  modified). Verified that the repository and file exist.
- **Reliability:** high for single characters, but no help for words.

### kmcha.com

- **Scheme:** coarse (動詞, 名詞), from a 現代漢語詞典-style definition.
- **繼續:** （動詞）連下去；接著做，不間斷, plus a noun sense.
- **Online:** https://kmcha.com/similar/繼續
- **Download:** none; it would have to be scraped. Unclear where the data comes
  from and under what license.
- **Reliability:** low to medium. Not a good candidate for offline use.

### Jyut Dictionary (jyutdictionary.com)

- **Scheme:** English labels (verb, noun).
- **繼續:** verb "to continue; to persist", noun "continuation".
- **Online:** https://jyutdictionary.com/dictionary/entry/繼續
- **Download:** unverified. The site combines several open dictionaries
  (Cantonese-focused); find out which of them supplies the POS before using it.
- **Reliability:** medium. Cantonese-oriented, so Mandarin usage may differ.

## Related, but no per-word POS found yet

- **CKIP / Academia Sinica (中研院平衡語料庫).** Defines a detailed tagset
  (technical report
  https://ckip.iis.sinica.edu.tw/data/paper/report/ckip-9804.pdf, tag list
  https://lingcorpus.iis.sinica.edu.tw/kiwi/mkiwi/modern_c_wordtype.html). Its
  VL class ("verbs taking a verb phrase object") matches how 繼續 behaves, but
  the report doesn't list 繼續, so its tag is unconfirmed. Note that CKIP tags
  modals like 會/可以 as adverbs (D), not as auxiliaries. For offline use, the
  tagger https://github.com/ckiplab/ckip-transformers assigns POS to words in a
  sentence, which is context-dependent rather than a dictionary lookup.
- **Chinese Wordnet (NTU LOPE).** Gives CKIP tags per sense, but the query URL
  `lope.linguistics.ntu.edu.tw/cwn2/query/...` now returns 404. It might still
  be available as a downloadable dataset; unverified.

## Checked, no POS

- **COCT 國教院詞語分級** (https://coct.naer.edu.tw/word.jsp?WORD=繼續): level
  only (進階 第4級, 核心詞).
- **MOE 國語辭典簡編本** (https://dict.concised.moe.edu.tw/): definition and
  antonyms only.
- **hackchinese** (`data/hackchinese/words/*.json`): English glosses and
  sentences, no POS field.

## Suggested order for an offline POS lookup

1. TOCFL CSVs (already local), using the exact codes from `pos.json`.
2. Wiktextract dump from kaikki.org as a fallback for words not in TOCFL,
   with the coarse POS mapped to a rough TOCFL group (動詞 → V*, 名詞 → N,
   副詞 → Adv, ...), and marked as approximate.
3. moedict dump for single characters.
