// Type definitions for Rtega character data
/* eslint-disable @typescript-eslint/naming-convention */

export interface RtegaMnemonicItem {
  html: string;
  text: string;
  author: string;
}

export interface RtegaMnemonic {
  text: string;
  html: string;
  items: RtegaMnemonicItem[];
}

export interface RtegaCharacter {
  id: string;
  character: string;
  traditional: string | null;
  simplified: string | null;
  japanese: string | null;
  uid: string;
  meaning: string;
  mnemonic: RtegaMnemonic;
  referenced_characters: string[];
  related_characters: string[];
}
