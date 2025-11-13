// Type definitions for YellowBridge character data

export interface ComponentInfo {
  character: string;
  pinyin: string[];
  description: string;
  isAltered?: boolean;
}

export interface FunctionalComponents {
  phonetic: ComponentInfo[];
  semantic: ComponentInfo[];
  primitive: ComponentInfo[];
}

export interface RadicalInfo extends ComponentInfo {
  kangxiRadicalNumber?: number;
}

export interface FormationMethod {
  typeChinese: string;
  typeEnglish: string;
  description: string;
  referencedCharacters: string[];
}

export interface SimplificationInfo {
  simplifiedForm: string;
  method: string;
  methodType?: string;
}

export interface YellowBridgeCharacter {
  character: string;
  pinyin: string[];
  definition: string | null;
  functionalComponents: FunctionalComponents;
  radical: RadicalInfo | null;
  formationMethods: FormationMethod[];
  allComponents: ComponentInfo[];
  simplification: SimplificationInfo | null;
  kangxiRadical?: number;
  sourceFile: string;
}
