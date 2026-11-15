# Socratic tutor: saved state

To resume, run `/socratic-tutor` with:

```
resume from: @POS_SOCRATIC_METHOD.md
```

## Topic

Parts of speech (POS) as defined in `app/data/pos_details.json`
(當代中文課程-style tags). Target: 4/5 on every subskill (the default).

## Skill map

```
Topic: POS (pos_details.json)               overall: ██████░░░░ 63%
------------------------------------------------------------------
1 Noun phrases (N/Det/M)            [██████░░░░]  3/5
2 Before-verb (Adv/Conj/Prep/Vaux)  [██████░░░░]  3/5
3 Particles (Ptc)                   [██████░░░░]  3/5
4 Verb type (action/state/process)  [████████░░]  4/5  * independent
5 Transitivity                      [██████░░░░]  3/5
6 Separable (-sep)                  [██████░░░░]  3/5
7 Vs-attr / Vs-pred                 [██████░░░░]  3/5
8 Set phrases & multi-POS           [██████░░░░]  3/5
------------------------------------------------------------------
```

## Pending question (ask this first on resume)

Phase: spaced review. Every subskill has been taught; each of 1, 2, 3, 5, 6,
7, 8 needs one unprompted correct check to reach 4/5. Then the final mixed
assessment (one question per subskill plus one integrative problem).

Next question (subskill 7 recheck): what's the tag of 野生 (野生動物 ✓,
*這些動物很野生)? Expected: Vs-attr. Follow-up: how do you say "these
animals are wild"? (這些動物是野生的)

Suggested later rechecks: 1: 這三本書 / *三書 / 兩 vs 二. 2: 也 vs 而且, or
能 A-not-A. 3: 了 position, or 把 + definite object. 5: 跑 (Vi) vs 買 (V).
6: AAB reduplication 唱唱歌 (not yet taught!), 見面 + 跟他. 8: 要 + N vs
要 + V, or 完 (Ptc vs Vp).

The learner asked for strictly ONE question per message. Never bundle.

## Covered so far

- **Diagnostic:** 我要兩張紙 tagged perfectly (兩 = N, 要 + noun = V). Didn't
  know 跟 Prep vs Conj, or why *多人 is wrong but 高樓 is fine.
- **Verb types (subskill 4):** The learner derived the table:

  | Type | 很 | 在 | Negation |
  |---|---|---|---|
  | State (Vs, Vst) | ✓ | ✗ | 不 |
  | Action (V, Vi) | ✗ | ✓ | 不 (doesn't/won't), 沒 (didn't) |
  | Process (Vp, Vpt) | ✗ | ✗ | 沒 |

  Also: 很 is the strongest test (decisive). 在 and 不/沒 blur with emotions
  (他在生氣, 我沒生氣 are colloquially fine). Elimination works when one test
  is unclear (認識: 在 ✗ + 不 ✓ means Vst).
- Got right on their own: 忙 Vs, 坐 Vi, 丟 "lose" Vpt (丟垃圾 = V), 壞 Vs vs
  Vp, 變成 Vpt, 唱歌 V-sep, 畢業 Vp-sep.
- Needed help: 怕 (said action; misread 狗 as 夠), 醒 (Vp), 認識 (said Vpt),
  生氣 (said V-sep), 關心 (said V).
- **"Won't" + process verb:** 他不想醒. 不 negates the Vaux, not 醒. Also 不跑
  is habit or refusal, not ability (ability is 不能跑 / 不會跑).
- **Separable (subskill 6):** Structure is V + built-in O, so no second object
  (跟她結婚, 生他的氣). Material goes inside: 唱了兩首歌, 結過兩次婚. Pattern
  V + 了 + duration + 的 + O: needed the answer for 跳了一個小時的舞, then
  produced 他上了三個小時的網 on their own. 一個小時 (in speech) vs 一天/一年.
- **Vs-attr / Vs-pred (subskill 7):** Built the table 高 Vs (both), 多
  Vs-pred (*多人, 很多人), 公共 Vs-attr (*很公共). 主要: first said Vs,
  then correct after judging 很主要 ✗. 夠: Vs-pred on their own. Vs-attr as
  predicate needs 是…的: 這間廁所是公共的 (on their own).
- **Before-verb (subskill 2):** Vaux answers alone and forms A-not-A; Adv
  can't (*常。). 應該: guessed Adv, was told Vaux (應不應該, 應該。). 可以:
  Vaux on their own, both tests. 跟: swap test (我跟他是同學 swaps, so
  Conj; 我也跟他去 doesn't, so Prep). Was told the labels. Adverb before
  跟 means Prep: 我常跟朋友吃飯, correct with the reason.
- 昨天 is N (can be the subject). 也 must follow the subject (他也去了);
  而且 can precede it, so Conj.
- Subskill 4 restored to 4: 知道 → Vst on their own (很 "perhaps", 在 ✗,
  不 ✓, 沒 ✗).
- **Particles (subskill 3):** Sentence-final 了 = change (天冷了). Verbal
  了 = completion. 沒吃 not *沒吃了 (contradiction, correct reasoning).
  做得不好 (quality denied, not the doing). 把 + definite object (這支, not
  一支). 被 = unpleasant: needed the answer (said 他被升官了 was fine), then
  correct on 被摔壞. Taiwan: 在吃飯, not 吃著飯. 著 = lasting state (門開著).
  是…的 highlights time and never the object.
- **Subskill 8:** 脫褲子放屁 = Ph. 一舉兩得 = Id (four characters).
  半途而廢 Id ✓. 不好意思: said Id, then corrected to Ph (colloquial, even
  though it has four characters). 會 + N = Vst (unsure, needed nudging),
  會 + V = Vaux. 想 in 我很想你 = Vst on their own, with tests. 碗: M in
  三碗飯, N in 一個碗, with the reason. 在 in 他在家 = verb (Vst), not Prep
  (it's the only verb). Said 很在家 ✓ (it's ✗). 沒在家 is common in Taiwan.
- **Not yet covered:** reduplication of -sep (AAB: 唱唱歌), nothing else.

## Misconceptions and habits to watch

- Tends to tag by English meaning instead of running the tests, and often
  omits the test judgments even when asked for them. Keep requiring explicit
  ✓/✗ for each test.
- Judged 很 by whether it *appears* in the example sentence rather than
  whether it *can be added* (關心).
- Sometimes gives a broad category without the full tag (said "transitive
  state" instead of Vst). Ask for the exact tag.
- Misjudges mental or emotional verbs as actions (關心, 相信). Heuristic
  given: is it a condition or an activity? Then check 很.
- Answers only half of two-part questions. Insist on both parts.
- Reads 不 alone as "action". Remind them 不 fits both state and action,
  and 在 is what separates them.
- Says "transitional" when they mean "transitive". Correct the term.
- Initially treated 不 + process verb as "doesn't want to" (不醒).

## Suggested plan after the pending question

1. Spaced review (during 7): surprise-retest 4 and 6 (e.g. 跳舞 AAB, 見面 split).
2. Spaced review of 7 (e.g. 野生, 新, 少).
3. Subskill 2 (跟 Prep vs Conj, Adv vs Vaux A-not-A test).
4. Subskill 3 (Ptc), then 8, then the final mixed assessment.
