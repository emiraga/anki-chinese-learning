import posJSON from "./pos.json";

/** A part of speech code from the TOCFL 8000 word list (e.g. "Vs", "Vpt"). */
export type PosCode = keyof typeof posJSON;

export const POS = posJSON as { [key in PosCode]: [string, string, string] };

export function isPosCode(value: string): value is PosCode {
  return Object.hasOwn(POS, value);
}

/** Splits a POS field (e.g. "Vs, Adv" or "<b>N</b>/M") into its codes. */
export function parsePOSString(posString: string): string[] {
  return posString
    .replace(/<[^>]*>/g, "")
    .split(/[,;、/\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
