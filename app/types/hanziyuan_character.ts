// Type definitions for HanziYuan character data

export interface HanziYuanCharacter {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "etymology-nav": string; // HTML content for navigation
  [key: string]: string; // Additional fields may be present as HTML content
}
