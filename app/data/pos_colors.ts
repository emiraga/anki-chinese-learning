import type { PosCode } from "./pos";
import posColorsJSON from "./pos_colors.json";

/**
 * The color of each part of speech code, used for the word boxes of the
 * annotated sentences on the `/pos` page.
 *
 * The data lives in `pos_colors.json` so that `utils/hanzi/connect_dots_notes.py`
 * can give the same colors to the POS values of the sentence ConnectDots cards.
 * `colors` maps each Tailwind color name to its 500 shade, which those cards
 * use; the page uses lighter shades of the same Tailwind color.
 */

export type PosColor = keyof typeof posColorsJSON.colors;

export const POS_COLOR_HEX: Record<PosColor, string> = posColorsJSON.colors;

export const POS_COLORS = posColorsJSON.pos as Record<PosCode, PosColor>;
