/**
 * Demo/examples of how to use the sound similarity scoring function
 */

import { scoreSoundSimilarity, getSoundSimilarityBreakdown } from "./sound_similarity";

// Example 1: Basic usage
console.log("\n=== Basic Sound Similarity Examples ===\n");

const examples = [
  ["bao", "bao"], // Identical
  ["bao", "pao"], // Similar initial (b vs p)
  ["bao", "mao"], // Different initial, same final
  ["bao", "bei"], // Same initial, different final
  ["bao", "xiu"], // Completely different
  ["ban", "bang"], // Similar finals (an vs ang)
  ["ji", "ju"], // Same initial, different medial
];

examples.forEach(([pinyin1, pinyin2]) => {
  const score = scoreSoundSimilarity(pinyin1, pinyin2);
  console.log(`${pinyin1} vs ${pinyin2}: ${score}/10`);
});

// Example 2: Detailed breakdown
console.log("\n=== Detailed Breakdown Example ===\n");

const breakdown = getSoundSimilarityBreakdown("bao", "pao");
if (breakdown) {
  console.log(`Comparing: bao (${breakdown.zhuyin1}) vs pao (${breakdown.zhuyin2})`);
  console.log(`Total Score: ${breakdown.totalScore}/10`);
  console.log(`- Initial: ${breakdown.initialScore}/3`);
  console.log(`- Medial: ${breakdown.medialScore}/2`);
  console.log(`- Final: ${breakdown.finalScore}/3`);
  console.log(`- Tone: ${breakdown.toneScore}/2`);
  console.log(`\nComponents 1:`, breakdown.components1);
  console.log(`Components 2:`, breakdown.components2);
}

// Example 3: Filtering sound component candidates by quality
console.log("\n=== Filtering Sound Components ===\n");

// Simulating sound component candidates for 包 (bāo)
const soundComponent = "包";
const soundComponentPinyin = "bao";

const candidates = [
  { char: "抱", pinyin: "bao" }, // Perfect match
  { char: "炮", pinyin: "pao" }, // Good match (similar initial)
  { char: "飽", pinyin: "bao" }, // Perfect match
  { char: "跑", pinyin: "pao" }, // Good match
  { char: "泡", pinyin: "pao" }, // Good match
  { char: "保", pinyin: "bao" }, // Perfect match
  { char: "寶", pinyin: "bao" }, // Perfect match
  { char: "暴", pinyin: "bao" }, // Perfect match
  { char: "報", pinyin: "bao" }, // Perfect match
  { char: "豹", pinyin: "bao" }, // Perfect match
  { char: "貌", pinyin: "mao" }, // Moderate match (different initial)
  { char: "刨", pinyin: "pao" }, // Good match
  { char: "雹", pinyin: "bao" }, // Perfect match
];

console.log(`Sound component: ${soundComponent} (${soundComponentPinyin})\n`);

// Score each candidate and categorize by quality
const scoredCandidates = candidates.map((candidate) => ({
  ...candidate,
  score: scoreSoundSimilarity(soundComponentPinyin, candidate.pinyin),
}));

// Sort by score
scoredCandidates.sort((a, b) => b.score - a.score);

console.log("High quality matches (9-10 points):");
scoredCandidates
  .filter((c) => c.score >= 9)
  .forEach((c) => console.log(`  ${c.char} (${c.pinyin}): ${c.score}/10`));

console.log("\nGood quality matches (7-8.9 points):");
scoredCandidates
  .filter((c) => c.score >= 7 && c.score < 9)
  .forEach((c) => console.log(`  ${c.char} (${c.pinyin}): ${c.score}/10`));

console.log("\nModerate quality matches (5-6.9 points):");
scoredCandidates
  .filter((c) => c.score >= 5 && c.score < 7)
  .forEach((c) => console.log(`  ${c.char} (${c.pinyin}): ${c.score}/10`));

console.log("\nPoor quality matches (<5 points):");
scoredCandidates
  .filter((c) => c.score < 5)
  .forEach((c) => console.log(`  ${c.char} (${c.pinyin}): ${c.score}/10`));

// Example 4: Quality threshold filtering
console.log("\n=== Using Quality Threshold ===\n");

const QUALITY_THRESHOLD = 7.0; // Only show candidates with score >= 7

const highQualityCandidates = scoredCandidates.filter(
  (c) => c.score >= QUALITY_THRESHOLD
);

console.log(`Candidates with score >= ${QUALITY_THRESHOLD}:`);
highQualityCandidates.forEach((c) =>
  console.log(`  ${c.char} (${c.pinyin}): ${c.score}/10`)
);

export { scoredCandidates };
