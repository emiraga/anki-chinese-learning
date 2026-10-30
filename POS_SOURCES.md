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

## Offline copies

`./utils/pos/download_pos_sources.py` downloads every dump marked "Offline" below
into `data/` (about 280 MB, gitignored). `./utils/pos/print_pos_sources.py 繼續`
prints what each source says about a word; without arguments it prints how
often each tag occurs per source. The readers live in
`utils/shared/pos_sources.py` and return the tags unmapped, in each source's own
scheme.

## Sources that return POS

### TOCFL 華語八千詞表 (primary source)

- **Scheme:** TOCFL codes, same as `pos.json`. Multiple categories per word
  are comma-separated (e.g. `V, Vaux`).
- **繼續:** `V` (Level 3 list).
- **Offline:** already in the repo, `data/tocfl/20240923/*.csv` (one CSV per
  level, parsed by `utils/shared/tocfl_csv.py`). Column `詞類 / Part of speech`.
- **Download:** https://tocfl.edu.tw/tocfl/index.php/exam/download (the older
  URL `sc-top.org.tw/chinese/download.php` cited in the 2022 PDF no longer
  responds). Verified 2026-10: the newest list there is still
  `8000zhuyin_202409.zip`, the same version as the local copy.
- **Coverage:** ~8000 words only. Words outside the list have no POS here.
- **Reliability:** high. This is the authoritative source for the codes the app
  uses.

### TBCL 臺灣華語文能力基準 基礎詞彙表

- **Scheme:** TOCFL-style codes, but a coarse subset: only N, V, Vs, Vp, Vaux,
  Adv, M, Det, Conj, Prep, Ptc, plus `Phrase` (= Ph). No Vi, Vst, V-sep, Vpt,
  Vp-sep or Vs-attr/pred: 結婚 is `V` here but `Vp-sep` in TOCFL. A few cells
  are not codes at all (`Vt`, `Conj.`, a full-width `Ｖ`, `詞組`). Multiple
  categories are "/"-separated.
- **繼續:** not listed (it is TBCL level 4).
- **Offline:** `data/tbcl/臺灣華語文能力基準基礎詞彙表_111-09-20.xlsx` (180 KB), from
  `https://coct.naer.edu.tw/file/files/<same file name>`. Verified. It is no
  longer linked from the download page, but still served. Columns: 詞語, 級別,
  注音, 漢拼, 詞類/性質, 詞彙英譯, 語義/義項, 情境, 用法-常用搭配詞, 例句. One row
  per sense, so a word can be listed several times (還 has 6 rows).
- **Coverage:** 1518 rows, 1374 words after expanding variants, TBCL levels 1-3
  only. 1253 of those are also in TOCFL; for those, 82% of TBCL's tags are among
  TOCFL's codes for the word, and most disagreements are TBCL using the coarser
  code (V where TOCFL has V-sep/Vi/Vst). The 121 words not in TOCFL are mostly
  short forms (車, 鞋, 椅), names and easy compounds (法國, 星期一, 吃飯,
  晚餐), so it adds little beyond TOCFL.
- **Reliability:** high, same 鄧守信 framework as TOCFL, but coarser.
- **Not useful:** the main TBCL word list on https://coct.naer.edu.tw/page.jsp?ID=41
  (`14452詞語表202504.xlsx`, all 7 levels, 14452 words) has **no POS column**,
  only level, context (情境), frequencies, bopomofo and pinyin; the same applies
  to the 類詞綴表 (affixes) and the online lookup. ivankra/tocfl's `tbcl.csv`
  (https://github.com/ivankra/tocfl) has a POS column, but it is filled from this
  基礎詞彙表 for L1-3 only. The technical report 《解詞造句-華語文基礎詞語彙編》
  (17 MB PDF on page.jsp?ID=41) is the printed version of the same 基礎詞彙表,
  with the same coarse codes: the finer ones (Vi, Vst, V-sep, ...) appear only
  in its legend table, never on an entry. Checked 2026-10.
- **Download quirk:** coct.naer.edu.tw drops connections partway through larger
  files; `download_pos_sources.py` resumes with Range requests.

### Wiktionary (zh.wiktionary.org)

- **Scheme:** coarse Chinese terms (動詞, 名詞, 副詞, ...), one per sense.
- **繼續:** 動詞 (verb) "延續", and 名詞 (noun) "連續而不間斷".
- **Online:** https://zh.wiktionary.org/zh-hant/繼續
- **Offline:** Wiktextract JSONL dumps, one JSON object per entry and POS,
  with a `pos` field (and `pos_title`, the Chinese heading, in the Chinese
  edition). Verified, downloaded to:
  - `data/kaikki/en/kaikki.org-dictionary-Chinese.jsonl.gz` (English edition,
    156 MB compressed, 1.2 GB raw), from https://kaikki.org/dictionary/Chinese/.
    Keyed by the traditional form; simplified forms are `soft-redirect`
    entries without POS. Single characters only get `pos: "character"`, with
    all senses mixed together.
  - `data/kaikki/zh/kaikki.org-dictionary-漢語.jsonl.gz` (Chinese edition,
    91 MB compressed), from https://kaikki.org/zhwiktionary/漢語/. About 75% of
    the entries have no real POS (`unknown`, heading 釋義).
- **Coverage:** large, includes multi-character words: ~200k entries with a
  POS in the English edition.
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
- **Offline:** the full dump, `data/moedict_dump/dict-revised.json.xz` (15 MB),
  from https://github.com/g0v/moedict-data (branch `main`; MOE license: content
  may be converted but not modified). Verified: 161k entries, of which 8802
  have a `type` on at least one definition, all of them single characters
  except one (持阻). The per-word cache in `data/moedict/` is a subset of this
  dump.
- **Reliability:** high for single characters, but no help for words.

### jieba `dict.txt.big`

- **Scheme:** ICTCLAS / PKU tags (`v`, `n`, `a`, `d`, `vn`, `nr`, `i`, `l`,
  ...), one tag per line, with a corpus frequency.
- **繼續:** `v` (frequency 14690).
- **Offline:** `data/jieba/dict.txt.big` (8.6 MB), from
  https://github.com/fxsjy/jieba/tree/master/extra_dict (MIT). Verified. Format
  per line: `<word> <frequency> <tag>`; a word with several tags is listed once
  per tag (會 `v` and `zg`).
- **Coverage:** ~584k lines, traditional and simplified forms both listed.
- **Reliability:** medium. Automatically derived from a mainland corpus, coarse
  tags, no Vs/Vp distinctions; `a` (adjective) roughly maps to Vs.

### Universal Dependencies Chinese GSD treebank

- **Scheme:** UPOS (`VERB`, `AUX`, `ADJ`, ...) and the treebank's XPOS (`VV`,
  `MD`, `JJ`, ...), per token in a sentence.
- **繼續:** `VERB/VV` 23x, `ADJ/JJ` 1x, `NOUN/NN` 1x.
- **Offline:** `data/ud_chinese_gsd/zh_gsd-ud-{train,dev,test}.conllu`
  (12 MB), from https://github.com/UniversalDependencies/UD_Chinese-GSD
  (CC BY-SA 4.0). Verified. Traditional characters (Chinese Wikipedia text).
- **Coverage:** small: ~23k distinct word/tag pairs from ~4k sentences.
- **Reliability:** medium. Hand-annotated, but corpus counts rather than a
  dictionary: the tag depends on context. Useful for telling Vaux (會 `AUX/MD`)
  from plain verbs.

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
   TBCL 基礎詞彙表 for the few L1-3 words TOCFL lacks, with its coarse codes.
2. Wiktextract dump from kaikki.org as a fallback for words not in TOCFL,
   with the coarse POS mapped to a rough TOCFL group (動詞 → V*, 名詞 → N,
   副詞 → Adv, ...), and marked as approximate.
3. moedict dump for single characters.
4. jieba and UD GSD as tie-breakers, e.g. `a` / `ADJ` suggesting Vs and
   `AUX` suggesting Vaux.
