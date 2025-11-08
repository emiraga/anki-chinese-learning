// Type definitions for YellowBridge character data

export interface YellowBridgeCharacter {
  decomp: string; // HTML content for character decomposition
  formation: string; // HTML content for character formation
  [key: string]: string; // Additional fields may be present as HTML content
}
