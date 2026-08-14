/**
 * For each *_traditional_pinyin.srt in a directory (and subdirs), create:
 * 1. A new SRT with only the traditional subtitle line per cue (pinyin removed).
 * 2. A .txt transcript with only the traditional text, one line per cue (no timestamps).
 *
 * Usage: npx tsx utils/srt_traditional_only.ts "/Users/ankur/Documents/Lazy Chinese/Beginner"
 *        npx tsx utils/srt_traditional_only.ts "/path/to/folder" [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const BEGINNER_DIR = process.argv[2] || join(process.env.HOME || "", "Documents/Lazy Chinese/Beginner");
const DRY_RUN = process.argv.includes("--dry-run");

function* walkSrtFiles(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkSrtFiles(full);
    } else if (e.isFile() && e.name.endsWith(".srt")) {
      yield full;
    }
  }
}

/** SRT cue: index, time range, text lines (we keep only first = traditional). */
function parseSrt(content: string): Array<{ index: number; time: string; lines: string[] }> {
  const cues: Array<{ index: number; time: string; lines: string[] }> = [];
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const index = parseInt(lines[0], 10);
    if (Number.isNaN(index)) continue;
    const time = lines[1];
    if (!/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(time)) continue;
    const textLines = lines.slice(2);
    cues.push({ index: cues.length + 1, time, lines: textLines });
  }
  return cues;
}

/** Format cues as SRT keeping only the first (traditional) line per cue. */
function toTraditionalOnlySrt(cues: Array<{ index: number; time: string; lines: string[] }>): string {
  return cues
    .map((c) => `${c.index}\n${c.time}\n${(c.lines[0] ?? "").trim()}\n`)
    .join("\n");
}

/** Format cues as plain transcript: one traditional line per cue, no timestamps. */
function toTranscriptTxt(cues: Array<{ index: number; time: string; lines: string[] }>): string {
  return cues.map((c) => (c.lines[0] ?? "").trim()).filter(Boolean).join("\n");
}

function main() {
  if (DRY_RUN) console.log("DRY RUN – no files will be written.\n");

  let count = 0;
  for (const filePath of walkSrtFiles(BEGINNER_DIR)) {
    const base = filePath.replace(/\.srt$/i, "");
    const outPath = base.replace(/_traditional_pinyin$/, "_traditional_only") + ".srt";
    if (outPath === filePath) continue;

    const content = readFileSync(filePath, "utf-8");
    const cues = parseSrt(content);
    if (!cues.length) {
      console.log("Skip (no cues):", filePath);
      continue;
    }
    const outSrt = toTraditionalOnlySrt(cues);
    const outTxtPath = outPath.replace(/\.srt$/i, ".txt");
    const outTxt = toTranscriptTxt(cues);
    if (DRY_RUN) {
      console.log("Would write:", outPath, "and", outTxtPath, "(", cues.length, "cues )");
    } else {
      writeFileSync(outPath, outSrt, "utf-8");
      writeFileSync(outTxtPath, outTxt, "utf-8");
      console.log("Wrote:", outPath, "+", outTxtPath, "(", cues.length, "cues )");
    }
    count++;
  }
  console.log("\nTotal:", count, "file(s).");
}

main();
