import { scoreSoundSimilarity, getSoundSimilarityBreakdown } from "./sound_similarity";

describe("scoreSoundSimilarity", () => {
  test("identical sounds score 10", () => {
    expect(scoreSoundSimilarity("ba", "ba")).toBe(10);
    expect(scoreSoundSimilarity("zhong", "zhong")).toBe(10);
  });

  test("similar initials: b vs p (same place, different aspiration)", () => {
    const score = scoreSoundSimilarity("ba", "pa");
    expect(score).toBeGreaterThan(7); // Same final (3) + medial (2) + tone (2) + partial initial
    expect(score).toBeLessThan(10);
  });

  test("different initials: b vs ch (very different)", () => {
    const score = scoreSoundSimilarity("ba", "cha");
    expect(score).toBeGreaterThan(5); // Same final and tone
    expect(score).toBeLessThan(9); // Different initial (partial credit), same final and tone
  });

  test("same initial and final, different tone", () => {
    const score1 = scoreSoundSimilarity("fāng", "fàng"); // Same except tone (1st vs 4th)
    expect(score1).toBeGreaterThan(7); // Same initial, medial, final, different tone
    expect(score1).toBeLessThan(10); // Should not be perfect match

    const score2 = scoreSoundSimilarity("ma", "ma"); // No tone marks
    expect(score2).toBe(10); // Without tone marks, treated as same (both tone 1)
  });

  test("completely different sounds", () => {
    const score = scoreSoundSimilarity("ba", "xu");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(4);
  });

  test("similar finals: an vs ang", () => {
    const score = scoreSoundSimilarity("ban", "bang");
    expect(score).toBeGreaterThan(7); // Same initial, medial, similar finals
    expect(score).toBeLessThan(10);
  });

  test("breakdown provides detailed scores", () => {
    const breakdown = getSoundSimilarityBreakdown("ba", "pa");
    expect(breakdown).not.toBeNull();
    if (breakdown) {
      expect(breakdown.totalScore).toBeGreaterThan(0);
      expect(breakdown.initialScore).toBeGreaterThan(0);
      expect(breakdown.initialScore).toBeLessThan(3); // Similar but not identical
      expect(breakdown.medialScore).toBe(2); // Both have no medial
      expect(breakdown.finalScore).toBe(3); // Same final
      expect(breakdown.toneScore).toBe(2); // Same tone (unmarked = tone 1)
    }
  });

  test("handles invalid pinyin", () => {
    const score = scoreSoundSimilarity("xyz", "abc");
    expect(score).toBe(0);
  });

  test("case insensitive", () => {
    const score1 = scoreSoundSimilarity("BA", "ba");
    const score2 = scoreSoundSimilarity("ba", "ba");
    expect(score1).toBe(score2);
  });

  test("real-world example: sound components", () => {
    // 包 (bao) vs 抱 (bao) - should be identical
    expect(scoreSoundSimilarity("bao", "bao")).toBe(10);

    // 包 (bao) vs 炮 (pao) - similar initials
    const score = scoreSoundSimilarity("bao", "pao");
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThan(10);
  });

  test("nasal finals: en vs eng", () => {
    const score = scoreSoundSimilarity("ben", "beng");
    expect(score).toBeGreaterThan(7); // Same initial, similar finals
  });

  test("medial differences: i vs u vs ü", () => {
    const score1 = scoreSoundSimilarity("ji", "ju"); // ㄐㄧ vs ㄐㄩ
    const score2 = scoreSoundSimilarity("gu", "ge"); // ㄍㄨ vs ㄍㄜ

    // Both should have same initial (3), tone (2), different medial/final
    expect(score1).toBeGreaterThan(5);
    expect(score1).toBeLessThan(10);
    expect(score2).toBeGreaterThan(3);
    expect(score2).toBeLessThan(10);
  });

  test("medial as final: yi vs ti", () => {
    // yi (ㄧ) has ㄧ as final, ti (ㄊㄧ) has ㄧ as medial
    // They should score well because they share the same sound
    const score = scoreSoundSimilarity("yì", "tī");
    expect(score).toBeGreaterThan(4); // Should get credit for shared ㄧ sound
    expect(score).toBeLessThan(8); // But not perfect due to different initial and tone
  });

  test("low similarity initials and finals should not get medial credit", () => {
    // dá (ㄉㄚˊ) vs hé (ㄏㄜˊ) - different initials and finals
    // Should NOT get 2 points for both lacking medials
    const breakdown = getSoundSimilarityBreakdown("dá", "hé");

    expect(breakdown).not.toBeNull();
    if (breakdown) {
      // Initial: ㄉ (alveolar) vs ㄏ (velar) - low similarity
      expect(breakdown.initialScore).toBeLessThan(2);

      // Final: ㄚ (back) vs ㄜ (mid) - moderate similarity
      expect(breakdown.finalScore).toBeLessThan(3);

      // Medial: both null, but since initial and final are both low, should be 0
      expect(breakdown.medialScore).toBe(0);

      // Total should be significantly lower than 6.0
      expect(breakdown.totalScore).toBeLessThan(6);
      expect(breakdown.totalScore).toBeGreaterThan(2); // But not completely different
    }
  });

  test("hù vs suǒ - different sounds with shared medial", () => {
    // hù (ㄏㄨˋ) vs suǒ (ㄙㄨㄛˇ)
    const breakdown = getSoundSimilarityBreakdown("hù", "suǒ");

    expect(breakdown).not.toBeNull();
    if (breakdown) {
      // Initial: ㄏ (velar-fricative) vs ㄙ (dental-fricative) - partial similarity
      expect(breakdown.initialScore).toBeGreaterThan(0);
      expect(breakdown.initialScore).toBeLessThan(2);

      // Medial: both have ㄨ - should get full credit
      expect(breakdown.medialScore).toBe(2);

      // Final: null vs ㄛ - one has final, one doesn't
      expect(breakdown.finalScore).toBe(0);

      // Tone: 4 vs 3 - partial similarity
      expect(breakdown.toneScore).toBeGreaterThan(0);

      // Total score
      expect(breakdown.totalScore).toBeGreaterThan(2);
      expect(breakdown.totalScore).toBeLessThan(6);
    }
  });
});
