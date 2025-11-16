// Type definitions for HanziYuan character data (converted format)

export interface EtymologyItem {
  id: string; // Etymology ID (e.g., "J29285")
  image: string; // Path to SVG image relative to public/
}

export interface EtymologySection {
  chinese: string; // Chinese name for the section (e.g., "甲骨文")
  count: number; // Number of items
  items: EtymologyItem[];
}

export interface EtymologyCharacters {
  oracle: EtymologySection; // Oracle characters 甲骨文
  bronze: EtymologySection; // Bronze characters 金文
  seal: EtymologySection; // Seal characters 篆文
  liushutong: EtymologySection; // Liushutong characters 六书通
}

export interface MarkerInfo {
  character: string;
  pronunciation: string;
}

export interface ComponentMarkers {
  removed?: string | MarkerInfo; // Content removed (rem-)
  added?: string | MarkerInfo; // Content added (rem+)
  not?: string | MarkerInfo; // Negation (not-)
}

export interface Component {
  description: string; // Description of the component (e.g., "tree", "person-right")
  characters: string; // Chinese characters for this component
  component: string; // Best single character extracted
  pronunciation: string; // Pinyin pronunciation
  quantity?: string; // Quantity word (e.g., "two", "three")
  role?: string; // Role of component (e.g., "phonetic")
  markers?: ComponentMarkers; // Special markers
}

export interface ComponentName {
  name: string; // Name/description
  character: string; // Chinese character
  pronunciation: string; // Pinyin pronunciation
}

export interface SimplificationRule {
  rule: string; // Rule code (e.g., "A037", "B012")
  simplified?: string; // Simplified character
  newChar?: string; // New character form
}

export interface CharacterDecomposition {
  type?: string; // "Compound" or "Component"
  character?: string; // Main character
  components?: Component[]; // Array of components
  names?: ComponentName[]; // Alternative names
  olderForms?: string[]; // Historical forms
  mutants?: string[]; // Variant forms
  variantOf?: string; // Character this is a variant of
  simplificationRules?: SimplificationRule[]; // Simplification rules
  simplifiedForm?: string; // Simplified form
  newCharForm?: string; // New character form
  crossReferences?: string[]; // Related character references
  notes?: string; // Additional notes
  raw?: string; // Raw text if parsing failed
}

export interface CharacterInfo {
  // Dictionary mapping labels to plain text content
  // Common fields include:
  // - "Traditional in your browser 繁体字的浏览器显示"
  // - "Simplified in your browser 简体字的浏览器显示"
  // - "Older traditional characters 旧繁体字/异体字"
  // - "Pinyin pronunciation 拼音"
  // - "Character decomposition 字形分解"
  // - "Meaning in English 英文意思"
  // - "Meaning in simplified Chinese 简体中文意思"
  [key: string]: string | undefined;
}

export interface RuleReference {
  code: string; // Rule code like "A098"
  characters: string; // Related characters
}

export interface DecompositionNotes {
  explanations?: string[]; // Explanatory notes like "(- text)"
  ruleReferences?: RuleReference[]; // Rule references with codes
  crossReferences?: string[]; // "see X" references
  relatedCharacters?: string[]; // Character/pinyin pairs
  specialMarkers?: string[]; // Special markers like "(original-", "(inversion-"
  notes?: string[]; // Plain text notes
}

export interface HanziYuanCharacter {
  characterInfo: CharacterInfo;
  etymologyCharacters: EtymologyCharacters;
  characterDecomposition: CharacterDecomposition;
  decompositionNotes?: DecompositionNotes;
}
