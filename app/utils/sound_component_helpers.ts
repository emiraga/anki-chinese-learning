import type { DongCharacter } from "~/types/dong_character";
import type { YellowBridgeCharacter } from "~/types/yellowbridge_character";
import { scoreSoundSimilarity } from "~/utils/sound_similarity";
import { getNewCharacter } from "~/data/characters";

export interface SoundComponentCandidate {
  character: string;
  pinyin: string;
  score: number;
  depth: number;
  componentType: string[];
  source: "dong" | "yellowbridge";
}

// Helper to extract all components from a DongCharacter (non-recursive, single level)
export function extractAllComponents(
  dongChar: DongCharacter | null,
  depth: number,
): Array<{ character: string; pinyin: string; depth: number; componentType: string[] }> {
  if (!dongChar) return [];

  const allComponents = dongChar.components || [];

  const results: Array<{ character: string; pinyin: string; depth: number; componentType: string[] }> =
    [];

  for (const comp of allComponents) {
    const componentChar = comp.character;
    const componentPinyin = getPrimaryPinyin(componentChar, dongChar);

    if (componentPinyin) {
      results.push({
        character: componentChar,
        pinyin: componentPinyin,
        depth,
        componentType: comp.type,
      });
    }
  }

  return results;
}

export function getPrimaryPinyin(char: string, dongChar: DongCharacter): string {
  // First, check if this is the main character
  if (
    char === dongChar.char &&
    dongChar.pinyinFrequencies &&
    dongChar.pinyinFrequencies.length > 0
  ) {
    return dongChar.pinyinFrequencies[0].pinyin;
  }

  // Try to get pinyin from the chars array (component character data)
  const componentChar = dongChar.chars?.find((c) => c.char === char);
  if (
    componentChar?.pinyinFrequencies &&
    componentChar.pinyinFrequencies.length > 0
  ) {
    return componentChar.pinyinFrequencies[0].pinyin;
  }

  // Try to get from oldPronunciations
  if (
    componentChar?.oldPronunciations &&
    componentChar.oldPronunciations.length > 0
  ) {
    return componentChar.oldPronunciations[0].pinyin;
  }

  // Try to get from words array
  const componentWord = dongChar.words?.find(
    (w) => w.simp === char || w.trad === char,
  );
  if (componentWord?.items && componentWord.items.length > 0) {
    return componentWord.items[0].pinyin;
  }

  // Fallback to library to get approximate pinyin
  const newChar = getNewCharacter(char);
  if (newChar?.pinyin && newChar.pinyin.length > 0) {
    const firstPinyin = newChar.pinyin[0];
    return typeof firstPinyin === "string"
      ? firstPinyin
      : firstPinyin?.pinyinAccented || "";
  }

  // Return empty if we still can't determine
  return "";
}

// Fetch DongCharacter data directly
export async function fetchDongCharacter(char: string): Promise<DongCharacter | null> {
  if (!char) return null;

  try {
    const res = await fetch(`/data/dong/${char}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Fetch YellowBridge character data
export async function fetchYellowBridgeCharacter(char: string): Promise<YellowBridgeCharacter | null> {
  if (!char) return null;

  try {
    const res = await fetch(`/data/yellowbridge/info/${char}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Extract phonetic components from YellowBridge data
export function extractYellowBridgePhoneticComponents(
  ybChar: YellowBridgeCharacter,
  charPinyin: string,
): SoundComponentCandidate[] {
  const candidates: SoundComponentCandidate[] = [];

  // Extract phonetic components (convert to "sound" for consistency)
  for (const comp of ybChar.functionalComponents.phonetic) {
    if (comp.pinyin.length > 0) {
      // YellowBridge pinyin might have multiple pronunciations - use the first one
      const firstPinyin = comp.pinyin[0];
      candidates.push({
        character: comp.character,
        pinyin: firstPinyin,
        depth: 0,
        componentType: ["sound"], // YellowBridge "phonetic" is the same as "sound"
        score: scoreSoundSimilarity(charPinyin, firstPinyin),
        source: "yellowbridge",
      });
    }
  }

  return candidates;
}

// Merge candidates from Dong and YellowBridge, removing duplicates
export function mergeCandidates(
  dongCandidates: SoundComponentCandidate[],
  yellowBridgeCandidates: SoundComponentCandidate[],
): SoundComponentCandidate[] {
  const candidateMap = new Map<string, SoundComponentCandidate>();

  // Add Dong candidates first (they take priority)
  for (const candidate of dongCandidates) {
    candidateMap.set(candidate.character, candidate);
  }

  // Add YellowBridge candidates if not already present
  for (const candidate of yellowBridgeCandidates) {
    if (!candidateMap.has(candidate.character)) {
      candidateMap.set(candidate.character, candidate);
    }
  }

  return Array.from(candidateMap.values());
}

// Recursively gather all components by fetching nested characters
export async function getAllComponentsRecursive(
  dongChar: DongCharacter,
  charPinyin: string,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<SoundComponentCandidate[]> {
  visited.add(dongChar.char);
  const allCandidates: SoundComponentCandidate[] = [];

  // Get immediate components (all types)
  const immediate = extractAllComponents(dongChar, depth);

  // Process each component
  for (const comp of immediate) {
    // Skip if already visited (prevents self-reference and cycles)
    if (visited.has(comp.character)) {
      continue;
    }

    allCandidates.push({
      character: comp.character,
      pinyin: comp.pinyin,
      depth: comp.depth,
      componentType: comp.componentType,
      score: scoreSoundSimilarity(charPinyin, comp.pinyin),
      source: "dong",
    });

    // Recursively fetch and process nested components
    if (depth < 5) {
      const nestedChar = await fetchDongCharacter(comp.character);
      if (nestedChar) {
        const nestedCandidates = await getAllComponentsRecursive(
          nestedChar,
          charPinyin,
          depth + 1,
          visited,
        );
        allCandidates.push(...nestedCandidates);
      }
    }
  }

  return allCandidates;
}

// Component type configuration
export const COMPONENT_TYPE_CONFIG = {
  deleted: {
    borderColor: "border-gray-300 dark:border-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-800",
    badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  sound: {
    borderColor: "border-blue-300 dark:border-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  iconic: {
    borderColor: "border-green-300 dark:border-green-700",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  meaning: {
    borderColor: "border-red-300 dark:border-red-700",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  remnant: {
    borderColor: "border-purple-300 dark:border-purple-700",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  distinguishing: {
    borderColor: "border-cyan-300 dark:border-cyan-700",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  simplified: {
    borderColor: "border-pink-300 dark:border-pink-700",
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    badgeColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
} as const;

export const DEFAULT_TYPE_CONFIG = {
  borderColor: "border-gray-300 dark:border-gray-600",
  bgColor: "bg-gray-50 dark:bg-gray-800",
  badgeColor: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

// Helper to get component type styling
export function getComponentTypeStyle(componentType: string[]): {
  borderColor: string;
  bgColor: string;
  badgeColor: string;
} {
  // Check for each type in the component type array
  for (const type of componentType) {
    const typeLower = type.toLowerCase();
    for (const [key, config] of Object.entries(COMPONENT_TYPE_CONFIG)) {
      if (typeLower.includes(key)) {
        return config;
      }
    }
  }

  return DEFAULT_TYPE_CONFIG;
}

// Sort candidates by component type (sound/phonetic first) and then by score descending
export function sortCandidates(candidates: SoundComponentCandidate[]): SoundComponentCandidate[] {
  return [...candidates].sort((a, b) => {
    const aIsSound = a.componentType.some(
      (type) =>
        type.toLowerCase().includes("sound") ||
        type.toLowerCase().includes("phonetic"),
    );
    const bIsSound = b.componentType.some(
      (type) =>
        type.toLowerCase().includes("sound") ||
        type.toLowerCase().includes("phonetic"),
    );

    // If one is sound and the other isn't, sound comes first
    if (aIsSound && !bIsSound) return -1;
    if (!aIsSound && bIsSound) return 1;

    // Otherwise, sort by score descending
    return b.score - a.score;
  });
}

// Get CSS classes for score badge based on score value (5-level granular system)
export function getScoreBadgeClasses(score: number): string {
  if (score >= 9) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"; // Excellent
  }
  if (score >= 7) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"; // Good
  }
  if (score >= 5) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"; // Moderate
  }
  if (score >= 3) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"; // Poor
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"; // Very poor
}

// Get pinyin for a character with fallback to library
export function getCharacterPinyin(char: string, dongChar?: DongCharacter | null): string {
  // Try to get from DongCharacter data first
  if (dongChar?.pinyinFrequencies && dongChar.pinyinFrequencies.length > 0) {
    return dongChar.pinyinFrequencies[0].pinyin;
  }

  // Fallback to library
  const newChar = getNewCharacter(char);
  if (newChar?.pinyin && newChar.pinyin.length > 0) {
    const firstPinyin = newChar.pinyin[0];
    return typeof firstPinyin === "string"
      ? firstPinyin
      : firstPinyin?.pinyinAccented || "";
  }

  return "";
}

// Update sound component character in Anki
export async function updateSoundComponentInAnki(
  ankiId: number,
  soundComponentChar: string,
  propTagsToAdd?: string[],
): Promise<void> {
  // Dynamic import to avoid circular dependency and keep anki in client-side only
  const anki = (await import("~/apis/anki")).default;

  await anki.note.updateNoteFields({
    note: {
      id: ankiId,
      fields: { "Sound component character": soundComponentChar },
    },
  });

  // Add prop tags from the sound component character
  if (propTagsToAdd && propTagsToAdd.length > 0) {
    await anki.note.addTags({
      notes: [ankiId],
      tags: propTagsToAdd.join(" "),
    });
  }
}

// Load sound component candidates for a character (non-hook version for use in loops)
export async function loadSoundComponentCandidates(
  mainCharacter: string,
  mainCharPinyin: string,
  dongChar?: DongCharacter | null,
  ybChar?: YellowBridgeCharacter | null,
): Promise<SoundComponentCandidate[]> {
  let dongCandidates: SoundComponentCandidate[] = [];
  let ybCandidates: SoundComponentCandidate[] = [];

  // Get Dong candidates
  if (dongChar) {
    try {
      dongCandidates = await getAllComponentsRecursive(
        dongChar,
        mainCharPinyin,
        0,
        new Set([mainCharacter]),
      );
    } catch (err) {
      console.error("Error loading Dong candidates:", err);
    }
  }

  // Get YellowBridge candidates
  if (ybChar) {
    try {
      ybCandidates = extractYellowBridgePhoneticComponents(ybChar, mainCharPinyin);
    } catch (err) {
      console.error("Error loading YellowBridge candidates:", err);
    }
  }

  // Merge, deduplicate, and sort candidates
  const mergedCandidates = mergeCandidates(dongCandidates, ybCandidates);
  return sortCandidates(mergedCandidates);
}
