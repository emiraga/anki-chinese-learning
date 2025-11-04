# Sound Similarity Scoring Function

## Overview

The `scoreSoundSimilarity()` function evaluates how similar two Chinese syllables sound based on their Zhuyin (Bopomofo) phonetic representations. It returns a score from 0 (completely different) to 10 (identical).

## Scoring Breakdown

The score is based on four phonetic components:

1. **Initial (聲母)**: 0-3 points
   - Place of articulation (labial, alveolar, velar, etc.)
   - Manner of articulation (stop, fricative, affricate, etc.)
   - Aspiration (aspirated vs unaspirated)

2. **Medial (介音)**: 0-2 points
   - ㄧ (i), ㄨ (u), or ㄩ (ü)

3. **Final (韻母)**: 0-3 points
   - Type (open, diphthong, nasal, etc.)
   - Backness (front, mid, back)

4. **Tone**: 0-2 points
   - Based on tonal contour similarity

## Usage

### Basic Usage

```typescript
import { scoreSoundSimilarity } from "~/utils/sound_similarity";

// Perfect match
const score1 = scoreSoundSimilarity("bao", "bao"); // Returns: 10

// Similar sounds (b vs p - same place, different aspiration)
const score2 = scoreSoundSimilarity("bao", "pao"); // Returns: ~9.7

// Different sounds
const score3 = scoreSoundSimilarity("bao", "xiu"); // Returns: ~2
```

### Detailed Breakdown

```typescript
import { getSoundSimilarityBreakdown } from "~/utils/sound_similarity";

const breakdown = getSoundSimilarityBreakdown("bao", "pao");

console.log(breakdown);
/*
{
  totalScore: 9.7,
  initialScore: 2.7,  // b vs p: same place (1.2) + same manner (0.8) + diff aspiration (0)
  medialScore: 2,     // Both have no medial
  finalScore: 3,      // Same final (ㄠ)
  toneScore: 2,       // Same tone
  components1: { initial: "ㄅ", medial: null, final: "ㄠ", tone: 1 },
  components2: { initial: "ㄆ", medial: null, final: "ㄠ", tone: 1 },
  zhuyin1: "ㄅㄠ",
  zhuyin2: "ㄆㄠ"
}
*/
```

### Filtering Sound Component Candidates

```typescript
import { scoreSoundSimilarity } from "~/utils/sound_similarity";

// Filter candidates by sound similarity to a sound component
const soundComponent = "包"; // bao
const soundComponentPinyin = "bao";

const candidates = [
  { char: "抱", pinyin: "bao" },
  { char: "炮", pinyin: "pao" },
  { char: "貌", pinyin: "mao" },
  // ... more candidates
];

// Score and filter
const QUALITY_THRESHOLD = 7.0;

const scoredCandidates = candidates
  .map(c => ({
    ...c,
    score: scoreSoundSimilarity(soundComponentPinyin, c.pinyin)
  }))
  .filter(c => c.score >= QUALITY_THRESHOLD)
  .sort((a, b) => b.score - a.score);

console.log(scoredCandidates);
/*
[
  { char: "抱", pinyin: "bao", score: 10 },    // Perfect match
  { char: "炮", pinyin: "pao", score: 9.7 },   // Very similar
  { char: "貌", pinyin: "mao", score: 7.8 },   // Moderate similarity
]
*/
```

## Score Interpretation Guide

| Score Range | Quality | Description | Example Pairs |
|-------------|---------|-------------|---------------|
| 9.0 - 10.0 | Excellent | Identical or nearly identical sounds | bao/bao, bao/pao |
| 7.0 - 8.9 | Good | Similar sounds with 1-2 small differences | ban/bang, ji/ju |
| 5.0 - 6.9 | Moderate | Some similarity, noticeable differences | bao/mao, ba/cha |
| 3.0 - 4.9 | Poor | Few similarities | bao/bei, ma/lu |
| 0.0 - 2.9 | Very Poor | Completely different sounds | bao/xiu, ba/ge |

## Phonetic Similarity Examples

### Initials

**High Similarity (2.5+ points):**
- b vs p (ㄅ vs ㄆ): Same place (labial), same manner (stop), different aspiration
- d vs t (ㄉ vs ㄊ): Same place (alveolar), same manner (stop), different aspiration
- g vs k (ㄍ vs ㄎ): Same place (velar), same manner (stop), different aspiration

**Moderate Similarity (1.0-2.4 points):**
- b vs m (ㄅ vs ㄇ): Same place (labial), different manner
- j vs q (ㄐ vs ㄑ): Same place (palatal), same manner (affricate), different aspiration
- zh vs ch (ㄓ vs ㄔ): Same place (retroflex), same manner (affricate), different aspiration

**Low Similarity (0-0.9 points):**
- b vs ch (ㄅ vs ㄔ): Different place, different manner
- m vs x (ㄇ vs ㄒ): Different place, different manner

### Finals

**High Similarity (2.5+ points):**
- an vs ang (ㄢ vs ㄤ): Both nasal, slightly different backness
- en vs eng (ㄣ vs ㄥ): Both nasal, slightly different backness

**Moderate Similarity (1.0-2.4 points):**
- a vs ai (ㄚ vs ㄞ): Open vs diphthong, similar backness
- o vs ou (ㄛ vs ㄡ): Open vs diphthong

**Low Similarity (0-0.9 points):**
- a vs i (ㄚ vs ㄧ): Completely different
- ou vs an (ㄡ vs ㄢ): Different type and backness

### Medials

**High Similarity (1.0+ points):**
- i vs ü (ㄧ vs ㄩ): Both palatal

**Low Similarity (0.5 points):**
- i vs u (ㄧ vs ㄨ): Palatal vs labial

## Use Cases

1. **Sound Component Validation**: Filter characters that truly use a character as a sound component
2. **Sound Component Discovery**: Find additional characters with similar pronunciation
3. **Learning Material Organization**: Group characters by sound similarity
4. **Pronunciation Practice**: Identify confusable sounds for targeted practice

## Implementation Notes

- Converts pinyin to Zhuyin for analysis (using PINYIN_TO_ZHUYIN mapping)
- Case-insensitive
- Strips tone marks from pinyin before conversion
- Returns 0 for invalid pinyin syllables
- Based on phonological features from traditional Chinese phonetics

## Testing

Run tests with:
```bash
npm test -- sound_similarity.test.ts
```

See `sound_similarity_demo.ts` for more examples.
