import { PINYIN_TO_ZHUYIN } from "./zhuyin";
import { stripPinyinTones } from "./pinyin";

/**
 * Extract tone number from accented pinyin
 * Returns 1-5 (1=first tone, 5=neutral tone)
 */
function getToneFromPinyin(pinyin: string): number {
  // Tone marks mapping
  const toneMappings: { [key: string]: number } = {
    // First tone (ā, ē, ī, ō, ū, ǖ)
    ā: 1,
    ē: 1,
    ī: 1,
    ō: 1,
    ū: 1,
    ǖ: 1,
    // Second tone (á, é, í, ó, ú, ǘ)
    á: 2,
    é: 2,
    í: 2,
    ó: 2,
    ú: 2,
    ǘ: 2,
    // Third tone (ǎ, ě, ǐ, ǒ, ǔ, ǚ)
    ǎ: 3,
    ě: 3,
    ǐ: 3,
    ǒ: 3,
    ǔ: 3,
    ǚ: 3,
    // Fourth tone (à, è, ì, ò, ù, ǜ)
    à: 4,
    è: 4,
    ì: 4,
    ò: 4,
    ù: 4,
    ǜ: 4,
  };

  for (const char of pinyin) {
    if (toneMappings[char]) {
      return toneMappings[char];
    }
  }

  // No tone mark found = neutral tone (5) or first tone (1)
  // We'll treat unmarked as first tone (1) for backwards compatibility
  return 1;
}

/**
 * Zhuyin phonetic component breakdown
 * Based on traditional phonological analysis
 */

// Initial consonants (聲母)
const ZHUYIN_INITIALS = {
  // Labials (唇音)
  ㄅ: { group: "labial-unaspirated", subgroup: "stop" },
  ㄆ: { group: "labial-aspirated", subgroup: "stop" },
  ㄇ: { group: "labial-nasal", subgroup: "nasal" },
  ㄈ: { group: "labial-fricative", subgroup: "fricative" },

  // Alveolars (舌尖音)
  ㄉ: { group: "alveolar-unaspirated", subgroup: "stop" },
  ㄊ: { group: "alveolar-aspirated", subgroup: "stop" },
  ㄋ: { group: "alveolar-nasal", subgroup: "nasal" },
  ㄌ: { group: "alveolar-lateral", subgroup: "lateral" },

  // Velars (舌根音)
  ㄍ: { group: "velar-unaspirated", subgroup: "stop" },
  ㄎ: { group: "velar-aspirated", subgroup: "stop" },
  ㄏ: { group: "velar-fricative", subgroup: "fricative" },

  // Palatals (舌面音)
  ㄐ: { group: "palatal-unaspirated", subgroup: "affricate" },
  ㄑ: { group: "palatal-aspirated", subgroup: "affricate" },
  ㄒ: { group: "palatal-fricative", subgroup: "fricative" },

  // Retroflexes (舌尖後音)
  ㄓ: { group: "retroflex-unaspirated", subgroup: "affricate" },
  ㄔ: { group: "retroflex-aspirated", subgroup: "affricate" },
  ㄕ: { group: "retroflex-fricative", subgroup: "fricative" },
  ㄖ: { group: "retroflex-approximant", subgroup: "approximant" },

  // Dentals (舌尖前音)
  ㄗ: { group: "dental-unaspirated", subgroup: "affricate" },
  ㄘ: { group: "dental-aspirated", subgroup: "affricate" },
  ㄙ: { group: "dental-fricative", subgroup: "fricative" },
} as const;

// Medials (介音)
const ZHUYIN_MEDIALS = {
  ㄧ: "i", // palatal
  ㄨ: "u", // labial
  ㄩ: "ü", // palatal-labial
} as const;

// Finals (韻母)
const ZHUYIN_FINALS = {
  // Simple finals
  ㄚ: { type: "open", backness: "back" },
  ㄛ: { type: "open", backness: "back" },
  ㄜ: { type: "open", backness: "mid" },
  ㄝ: { type: "open", backness: "front" },
  ㄦ: { type: "rhotic", backness: "mid" },

  // Compound finals with i
  ㄞ: { type: "diphthong", backness: "front" }, // ai
  ㄟ: { type: "diphthong", backness: "front" }, // ei

  // Compound finals with u
  ㄠ: { type: "diphthong", backness: "back" }, // ao
  ㄡ: { type: "diphthong", backness: "back" }, // ou

  // Nasal finals
  ㄢ: { type: "nasal-front", backness: "front" }, // an
  ㄣ: { type: "nasal-front", backness: "mid" }, // en
  ㄤ: { type: "nasal-back", backness: "back" }, // ang
  ㄥ: { type: "nasal-back", backness: "mid" }, // eng
} as const;

// Tone marks
const TONE_MARKS = ["ˊ", "ˇ", "ˋ", "˙"] as const;

/**
 * Parse a Zhuyin syllable into its phonetic components
 */
interface ZhuyinComponents {
  initial: string | null;
  medial: string | null;
  final: string | null;
  tone: number; // 1-5 (1 = first tone / unmarked, 2-5 = marked tones)
}

function parseZhuyin(zhuyin: string): ZhuyinComponents {
  // Extract tone first
  let tone = 1; // Default to first tone (unmarked)
  let syllable = zhuyin;

  for (let i = 0; i < TONE_MARKS.length; i++) {
    if (zhuyin.includes(TONE_MARKS[i])) {
      tone = i + 2; // Tone 2, 3, 4, 5
      syllable = zhuyin.replace(TONE_MARKS[i], "");
      break;
    }
  }

  let initial: string | null = null;
  let medial: string | null = null;
  let final: string | null = null;

  let pos = 0;

  // Try to extract initial
  if (pos < syllable.length) {
    const char = syllable[pos];
    if (char in ZHUYIN_INITIALS) {
      initial = char;
      pos++;
    }
  }

  // Try to extract medial
  if (pos < syllable.length) {
    const char = syllable[pos];
    if (char in ZHUYIN_MEDIALS) {
      medial = char;
      pos++;
    }
  }

  // Rest is final (if any)
  if (pos < syllable.length) {
    final = syllable.slice(pos);
  }

  // Special case: if no final, the medial might actually be the final
  // For example: ㄧ, ㄨ, ㄩ can stand alone as finals
  if (!final && medial && !initial) {
    final = medial;
    medial = null;
  }

  return { initial, medial, final, tone };
}

/**
 * Score the similarity between two initials (0-3 points)
 * Takes into account medials since they can act as onsets
 * Also checks if finals are medial-type characters (for cases like wu/yi)
 */
function scoreInitialSimilarity(
  init1: string | null,
  init2: string | null,
  medial1?: string | null,
  medial2?: string | null,
  final1?: string | null,
  final2?: string | null,
): number {
  // Perfect match
  if (init1 === init2 && init1 !== null) return 3;

  // Both null (no initial) - but check medials and finals
  if (!init1 && !init2) {
    // Check if finals are actually medial-type characters (like ㄨ, ㄧ, ㄩ standing alone)
    const final1IsMedial = final1 && final1 in ZHUYIN_MEDIALS;
    const final2IsMedial = final2 && final2 in ZHUYIN_MEDIALS;

    // If both have medial-type finals (like wu=ㄨ and yi=ㄧ), compare them
    if (final1IsMedial && final2IsMedial && !medial1 && !medial2) {
      return final1 === final2 ? 3 : 0;
    }

    // If one has medial-type final and the other doesn't, they're different
    if (final1IsMedial !== final2IsMedial && !medial1 && !medial2) {
      return 0;
    }

    // If both lack initials AND both lack medials, they're similar
    if (!medial1 && !medial2 && !final1IsMedial && !final2IsMedial) return 3;

    // If both have medials (acting as onsets), check if they match
    if (medial1 && medial2) {
      return medial1 === medial2 ? 3 : 0;
    }

    // If one has medial (acting as onset) and the other doesn't, they're quite different
    if (medial1 !== medial2) return 0;

    // Fallback
    return 3;
  }

  // One has initial, one doesn't
  if (!init1 || !init2) return 0;

  const info1 = ZHUYIN_INITIALS[init1 as keyof typeof ZHUYIN_INITIALS];
  const info2 = ZHUYIN_INITIALS[init2 as keyof typeof ZHUYIN_INITIALS];

  if (!info1 || !info2) return 0;

  // Extract place and manner of articulation
  const place1 = info1.group.split("-")[0];
  const manner1 = info1.subgroup;
  const aspiration1 = info1.group.includes("aspirated");

  const place2 = info2.group.split("-")[0];
  const manner2 = info2.subgroup;
  const aspiration2 = info2.group.includes("aspirated");

  let score = 0;

  // Same place of articulation = 1.2 points
  if (place1 === place2) {
    score += 1.2;
  } else {
    // Partial credit for related places
    const placeRelations: { [key: string]: string[] } = {
      labial: ["alveolar"],
      alveolar: ["labial", "dental", "retroflex"],
      dental: ["alveolar", "retroflex"],
      retroflex: ["alveolar", "dental", "palatal"],
      palatal: ["retroflex", "velar"],
      velar: ["palatal"],
    };
    if (placeRelations[place1]?.includes(place2)) {
      score += 0.4;
    }
  }

  // Same manner of articulation = 0.8 points
  if (manner1 === manner2) {
    score += 0.8;
  } else {
    // Partial credit for related manners
    const mannerRelations: { [key: string]: string[] } = {
      stop: ["affricate"],
      affricate: ["stop", "fricative"],
      fricative: ["affricate"],
      nasal: ["lateral"],
      lateral: ["nasal"],
    };
    if (mannerRelations[manner1]?.includes(manner2)) {
      score += 0.3;
    }
  }

  // Same aspiration = 0.7 points (aspiration is quite important)
  if (aspiration1 === aspiration2) {
    score += 0.7;
  }

  return Math.min(3, score);
}

/**
 * Score the similarity between two medials (0-2 points)
 * When both medials are null, the score depends on initial and final similarity
 */
function scoreMedialSimilarity(
  med1: string | null,
  med2: string | null,
  initialScore?: number,
  finalScore?: number,
): number {
  // Perfect match
  if (med1 === med2 && med1 !== null) return 2;

  // Both null (no medial)
  if (!med1 && !med2) {
    // If initial and final scores are provided, apply conditional logic
    if (initialScore !== undefined && finalScore !== undefined) {
      // If both initial and final have low similarity, don't give credit for both lacking medials
      // Threshold: at least one component should score > 2.5 to get credit
      // (we need strong similarity in at least one component)
      if (initialScore <= 2.4 && finalScore <= 2.4) {
        return 0;
      }
    }
    return 2;
  }

  // One has medial, one doesn't
  if (!med1 || !med2) return 0;

  // Different medials but both present
  // ㄧ (i) and ㄩ (ü) are more similar (both palatal)
  if ((med1 === "ㄧ" && med2 === "ㄩ") || (med1 === "ㄩ" && med2 === "ㄧ")) {
    return 1;
  }

  // ㄨ (u) vs ㄧ (i) or ㄩ (ü) - less similar
  return 0.5;
}

/**
 * Score the similarity between two finals (0-3 points)
 */
function scoreFinalSimilarity(
  fin1: string | null,
  fin2: string | null,
): number {
  // Perfect match
  if (fin1 === fin2) return 3;

  // Both null (no final)
  if (!fin1 && !fin2) return 3;

  // One has final, one doesn't
  if (!fin1 || !fin2) return 0;

  const info1 = ZHUYIN_FINALS[fin1 as keyof typeof ZHUYIN_FINALS];
  const info2 = ZHUYIN_FINALS[fin2 as keyof typeof ZHUYIN_FINALS];

  // If not in our standard finals, treat as medials-as-finals
  if (!info1 || !info2) {
    // Check if they're medials used as finals
    const isMedial1 = fin1 in ZHUYIN_MEDIALS;
    const isMedial2 = fin2 in ZHUYIN_MEDIALS;

    if (isMedial1 && isMedial2) {
      // Score like medials
      return scoreMedialSimilarity(fin1, fin2) * 1.5; // Scale to 0-3
    }
    return 0;
  }

  let score = 0;

  // Same type = 1.5 points
  if (info1.type === info2.type) {
    score += 1.5;
  } else {
    // Partial credit for related types
    const type1 = info1.type.split("-")[0];
    const type2 = info2.type.split("-")[0];

    if (type1 === type2) {
      score += 0.5;
    } else if (
      (type1 === "open" && type2 === "diphthong") ||
      (type1 === "diphthong" && type2 === "open")
    ) {
      score += 0.3;
    }
  }

  // Same backness = 1.5 points
  if (info1.backness === info2.backness) {
    score += 1.5;
  } else {
    // Partial credit for adjacent backness
    if (
      (info1.backness === "front" && info2.backness === "mid") ||
      (info1.backness === "mid" && info2.backness === "front") ||
      (info1.backness === "mid" && info2.backness === "back") ||
      (info1.backness === "back" && info2.backness === "mid")
    ) {
      score += 0.5;
    }
  }

  return Math.min(3, score);
}

/**
 * Score the similarity between two tones (0-2 points)
 * Only awards points if other phonetic components have sufficient similarity
 */
function scoreToneSimilarity(
  tone1: number,
  tone2: number,
  initialScore?: number,
  medialScore?: number,
  finalScore?: number,
): number {
  // Perfect match
  if (tone1 === tone2) return 2;

  // If other component scores are provided, apply conditional logic
  if (
    initialScore !== undefined &&
    medialScore !== undefined &&
    finalScore !== undefined
  ) {
    // Calculate total phonetic similarity (excluding tone)
    const phoneticTotal = initialScore + medialScore + finalScore;

    // Only give tone similarity credit if phonetic components have at least 50% similarity
    // Threshold: at least 4.0 points out of 8 possible (max is 3+2+3=8)
    if (phoneticTotal < 4.0) {
      return 0;
    }
  }

  // Tone similarity based on contour
  // Tone 1 (high level) vs Tone 2 (rising): somewhat similar (high register)
  // Tone 3 (low dipping) vs Tone 4 (falling): somewhat different
  // Tone 5 (neutral) is special

  const toneSimilarity: { [key: string]: number } = {
    "1-2": 1.0, // High level vs rising
    "1-3": 0.3, // High level vs low dip
    "1-4": 0.5, // High level vs falling
    "1-5": 0.5, // Neutral tone
    "2-3": 0.5, // Rising vs low dip
    "2-4": 0.3, // Rising vs falling
    "2-5": 0.5, // Neutral tone
    "3-4": 0.7, // Both have falling component
    "3-5": 0.5, // Neutral tone
    "4-5": 0.5, // Neutral tone
  };

  const key1 = `${Math.min(tone1, tone2)}-${Math.max(tone1, tone2)}`;
  return toneSimilarity[key1] || 0;
}

/**
 * Calculate sound similarity score between two pinyin syllables (0-10)
 *
 * Scoring breakdown:
 * - Initial: 0-3 points (place, manner, aspiration)
 * - Medial: 0-2 points
 * - Final: 0-3 points (type, backness)
 * - Tone: 0-2 points (contour similarity)
 *
 * @param pinyin1 First pinyin syllable (with or without tone marks)
 * @param pinyin2 Second pinyin syllable (with or without tone marks)
 * @returns Score from 0 (completely different) to 10 (identical)
 */
export function scoreSoundSimilarity(pinyin1: string, pinyin2: string): number {
  // Normalize pinyin (remove spaces, convert to lowercase)
  const normalized1 = pinyin1.trim().toLowerCase();
  const normalized2 = pinyin2.trim().toLowerCase();

  // Extract tones BEFORE stripping them
  const tone1 = getToneFromPinyin(normalized1);
  const tone2 = getToneFromPinyin(normalized2);

  // Now strip tones for Zhuyin conversion
  const p1 = stripPinyinTones(normalized1).replace(/ü/g, "v");
  const p2 = stripPinyinTones(normalized2).replace(/ü/g, "v");

  // Convert to Zhuyin
  const zhuyin1 = PINYIN_TO_ZHUYIN[p1];
  const zhuyin2 = PINYIN_TO_ZHUYIN[p2];

  if (!zhuyin1 || !zhuyin2) {
    // If we can't convert, return 0
    console.warn(`Could not convert to Zhuyin: ${p1} or ${p2}`);
    return 0;
  }

  // Parse components (but override tone with the one we extracted)
  const comp1 = parseZhuyin(zhuyin1);
  const comp2 = parseZhuyin(zhuyin2);

  // Override tones with the ones we extracted from accented pinyin
  comp1.tone = tone1;
  comp2.tone = tone2;

  // Calculate individual scores
  let initialScore = scoreInitialSimilarity(
    comp1.initial,
    comp2.initial,
    comp1.medial,
    comp2.medial,
    comp1.final,
    comp2.final,
  );
  let finalScore = scoreFinalSimilarity(comp1.final, comp2.final);
  let medialScore = scoreMedialSimilarity(
    comp1.medial,
    comp2.medial,
    initialScore,
    finalScore,
  );

  // Special case: Check if medial of one matches final of the other
  // This handles cases like yi (ㄧ) vs ti (ㄊㄧ) where ㄧ appears as final vs medial
  if (medialScore === 0 && finalScore === 0) {
    // Check if comp1's medial matches comp2's final (when both are medial-type characters)
    if (
      comp1.medial &&
      comp2.final &&
      comp1.medial === comp2.final &&
      comp1.medial in ZHUYIN_MEDIALS
    ) {
      medialScore = 2; // Give full medial score
      finalScore = 3; // Give full final score since they're the same sound
    }
    // Check if comp1's final matches comp2's medial
    else if (
      comp1.final &&
      comp2.medial &&
      comp1.final === comp2.medial &&
      comp1.final in ZHUYIN_MEDIALS
    ) {
      medialScore = 2; // Give full medial score
      finalScore = 3; // Give full final score since they're the same sound
    }
    // Check if both are medial-type characters but different (e.g., ㄨ vs ㄩ)
    else if (
      comp1.medial &&
      comp2.final &&
      comp1.medial in ZHUYIN_MEDIALS &&
      comp2.final in ZHUYIN_MEDIALS
    ) {
      // Score them as if they were both medials
      const crossMedialScore = scoreMedialSimilarity(comp1.medial, comp2.final);
      medialScore = crossMedialScore;
      finalScore = crossMedialScore * 1.5; // Scale to final range (0-3)
    }
    // Check if comp1's final is a medial and comp2's medial exists
    else if (
      comp1.final &&
      comp2.medial &&
      comp1.final in ZHUYIN_MEDIALS &&
      comp2.medial in ZHUYIN_MEDIALS
    ) {
      // Score them as if they were both medials
      const crossMedialScore = scoreMedialSimilarity(comp1.final, comp2.medial);
      medialScore = crossMedialScore;
      finalScore = crossMedialScore * 1.5; // Scale to final range (0-3)
    }
  }

  // Calculate tone score AFTER adjusting medial/final scores
  const toneScore = scoreToneSimilarity(
    comp1.tone,
    comp2.tone,
    initialScore,
    medialScore,
    finalScore,
  );

  const totalScore = initialScore + medialScore + finalScore + toneScore;

  return Math.round(totalScore * 10) / 10; // Round to 1 decimal place
}

/**
 * Get detailed breakdown of sound similarity
 */
export interface SoundSimilarityBreakdown {
  totalScore: number;
  initialScore: number;
  medialScore: number;
  finalScore: number;
  toneScore: number;
  components1: ZhuyinComponents;
  components2: ZhuyinComponents;
  zhuyin1: string;
  zhuyin2: string;
}

export function getSoundSimilarityBreakdown(
  pinyin1: string,
  pinyin2: string,
): SoundSimilarityBreakdown | null {
  const normalized1 = pinyin1.trim().toLowerCase();
  const normalized2 = pinyin2.trim().toLowerCase();

  // Extract tones BEFORE stripping them
  const tone1 = getToneFromPinyin(normalized1);
  const tone2 = getToneFromPinyin(normalized2);

  const p1 = stripPinyinTones(normalized1).replace(/ü/g, "v");
  const p2 = stripPinyinTones(normalized2).replace(/ü/g, "v");

  const zhuyin1 = PINYIN_TO_ZHUYIN[p1];
  const zhuyin2 = PINYIN_TO_ZHUYIN[p2];

  if (!zhuyin1 || !zhuyin2) {
    return null;
  }

  const components1 = parseZhuyin(zhuyin1);
  const components2 = parseZhuyin(zhuyin2);

  // Override tones with the ones we extracted from accented pinyin
  components1.tone = tone1;
  components2.tone = tone2;

  let initialScore = scoreInitialSimilarity(
    components1.initial,
    components2.initial,
    components1.medial,
    components2.medial,
    components1.final,
    components2.final,
  );
  let finalScore = scoreFinalSimilarity(components1.final, components2.final);
  let medialScore = scoreMedialSimilarity(
    components1.medial,
    components2.medial,
    initialScore,
    finalScore,
  );

  // Special case: Check if medial of one matches final of the other
  if (medialScore === 0 && finalScore === 0) {
    if (
      components1.medial &&
      components2.final &&
      components1.medial === components2.final &&
      components1.medial in ZHUYIN_MEDIALS
    ) {
      medialScore = 2;
      finalScore = 3;
    } else if (
      components1.final &&
      components2.medial &&
      components1.final === components2.medial &&
      components1.final in ZHUYIN_MEDIALS
    ) {
      medialScore = 2;
      finalScore = 3;
    }
    // Check if both are medial-type characters but different (e.g., ㄨ vs ㄩ)
    else if (
      components1.medial &&
      components2.final &&
      components1.medial in ZHUYIN_MEDIALS &&
      components2.final in ZHUYIN_MEDIALS
    ) {
      const crossMedialScore = scoreMedialSimilarity(
        components1.medial,
        components2.final,
      );
      medialScore = crossMedialScore;
      finalScore = crossMedialScore * 1.5;
    } else if (
      components1.final &&
      components2.medial &&
      components1.final in ZHUYIN_MEDIALS &&
      components2.medial in ZHUYIN_MEDIALS
    ) {
      const crossMedialScore = scoreMedialSimilarity(
        components1.final,
        components2.medial,
      );
      medialScore = crossMedialScore;
      finalScore = crossMedialScore * 1.5;
    }
  }

  // Calculate tone score AFTER adjusting medial/final scores
  const toneScore = scoreToneSimilarity(
    components1.tone,
    components2.tone,
    initialScore,
    medialScore,
    finalScore,
  );

  const totalScore = initialScore + medialScore + finalScore + toneScore;

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    initialScore: Math.round(initialScore * 10) / 10,
    medialScore: Math.round(medialScore * 10) / 10,
    finalScore: Math.round(finalScore * 10) / 10,
    toneScore: Math.round(toneScore * 10) / 10,
    components1,
    components2,
    zhuyin1,
    zhuyin2,
  };
}
