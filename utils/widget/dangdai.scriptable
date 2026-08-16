// ---------------------------------------------------------------------------
//  當代中文課程  A Course in Contemporary Chinese -- iOS vocabulary widget
// ---------------------------------------------------------------------------
//
//  ### CHANGE THIS LINE TO SWITCH CHAPTER ###
const LESSON = 5;
//  Book 2 has lessons 1-15. Set LESSON to the chapter you are studying,
//  then long-press the widget -> Edit Widget if it does not update right away.
//
//  Set LESSON = 0 to shuffle through every lesson in the book at once.
//
// ---------------------------------------------------------------------------
//  Setup (once):
//    1. Install "Scriptable" from the App Store (free).
//    2. Open Scriptable, tap + , paste this whole file in, name it "Dangdai".
//    3. Home screen:  long-press -> + -> Scriptable -> pick "Dangdai".
//       Lock screen:  Customize -> add widget -> Scriptable -> pick "Dangdai".
//    4. On the widget: long-press -> Edit Widget -> Script: "Dangdai".
//
//  The word advances every hour, and every widget showing the same lesson shows
//  the same word, so you can compare notes with classmates.
// ---------------------------------------------------------------------------

const DATA_URL =
  "https://gist.githubusercontent.com/ankur-ag/0dfa3b8b0246859eb956fa39eea53194/raw/dangdai.json";

// How often the shown word advances, in minutes.
const ROTATE_MINUTES = 60;

// Tone colours: 1=red 2=green 3=blue 4=purple 5=neutral.
// Lock screen widgets are rendered monochrome by iOS, so these apply on the
// home screen only.
const TONE_COLORS = [
  Color.dynamic(new Color("#6b7280"), new Color("#9ca3af")), // 0 / unknown
  Color.dynamic(new Color("#dc2626"), new Color("#f87171")), // 1
  Color.dynamic(new Color("#008000"), new Color("#00c000")), // 2
  Color.dynamic(new Color("#0000ff"), new Color("#4444ff")), // 3
  Color.dynamic(new Color("#9333ea"), new Color("#c084fc")), // 4
  Color.dynamic(new Color("#6b7280"), new Color("#9ca3af")), // 5
];

const ROTATE_MS = ROTATE_MINUTES * 60 * 1000;
const CACHE = FileManager.local();
const CACHE_PATH = CACHE.joinPath(CACHE.cacheDirectory(), "dangdai-widget.json");

async function loadData() {
  try {
    const req = new Request(`${DATA_URL}?v=${Date.now()}`);
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    if (data && data.lessons) {
      CACHE.writeString(CACHE_PATH, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    // Offline or the gist is unreachable: fall back to the last copy so the
    // widget keeps showing vocabulary instead of an error.
  }
  if (CACHE.fileExists(CACHE_PATH)) {
    return JSON.parse(CACHE.readString(CACHE_PATH));
  }
  return null;
}

// Words for the configured lesson, or the whole book when LESSON is 0.
function wordsFor(data) {
  if (!data || !data.lessons) return [];
  if (LESSON === 0) {
    return Object.keys(data.lessons)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((k) => data.lessons[k]);
  }
  return data.lessons[String(LESSON)] || [];
}

function currentSlot() {
  return Math.floor(Date.now() / ROTATE_MS);
}

function line(container, text, size, color, bold) {
  const t = container.addText(text);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  return t;
}

// The headword, one text per character so each can take its own tone colour.
// Point size is derived from the character count, since separate text elements
// cannot auto-shrink as a unit.
function bigHanzi(container, card, baseSize, availableWidth, forcedColor) {
  const chars = card.tt && card.tt.length ? card.tt : null;
  const count = chars ? chars.length : card.t.length;
  const size = Math.min(baseSize, Math.floor((availableWidth * 0.95) / Math.max(count, 1)));

  const row = container.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  if (!chars) {
    const t = line(row, card.t, size, forcedColor || TONE_COLORS[0], true);
    t.lineLimit = 1;
    t.minimumScaleFactor = 0.35;
  } else {
    for (const [char, tone] of chars) {
      const t = line(row, char, size, forcedColor || (tone ? TONE_COLORS[tone] : TONE_COLORS[0]), true);
      t.lineLimit = 1;
      t.minimumScaleFactor = 0.35;
    }
  }
  row.addSpacer();
  return row;
}

// Pinyin laid out syllable by syllable so each can take its tone colour.
function tonedPinyin(container, card, size, forcedColor, centered) {
  const row = container.addStack();
  row.layoutHorizontally();
  if (centered) row.addSpacer();
  if (!card.syl || !card.syl.length) {
    const t = line(row, card.p || "", size, forcedColor || TONE_COLORS[0], false);
    t.lineLimit = 1;
    t.minimumScaleFactor = 0.6;
  } else {
    for (const [syllable, tone] of card.syl) {
      const t = line(row, syllable, size, forcedColor || TONE_COLORS[tone], false);
      t.lineLimit = 1;
      t.minimumScaleFactor = 0.6;
      row.addSpacer(3);
    }
  }
  if (centered) row.addSpacer();
  return row;
}

const data = await loadData();
const words = wordsFor(data);
const family = config.widgetFamily || "medium";
const isAccessory = family.startsWith("accessory");
const w = new ListWidget();

if (!words.length) {
  // Distinguish "no data at all" from "lesson number out of range", since the
  // second is the mistake someone editing LESSON is most likely to make.
  const msg = !data
    ? "No data - check connection"
    : `Lesson ${LESSON} not found`;
  const t = w.addText(msg);
  t.font = Font.systemFont(isAccessory ? 11 : 13);
  t.centerAlignText();
  if (data && data.counts) {
    const avail = w.addText(`Available: ${Object.keys(data.counts).join(", ")}`);
    avail.font = Font.systemFont(isAccessory ? 9 : 11);
    avail.centerAlignText();
  }
} else {
  const card = words[currentSlot() % words.length];

  if (isAccessory) {
    // Lock screen: rendered monochrome, so colour is dropped and the tone marks
    // carry the tone instead.
    w.backgroundColor = new Color("#000000", 0);
    w.setPadding(0, 0, 0, 0);
    const white = Color.white();

    if (family === "accessoryInline") {
      w.addText(card.p ? `${card.t} ${card.p}` : card.t);
    } else if (family === "accessoryCircular") {
      const outer = w.addStack();
      outer.layoutVertically();
      outer.addSpacer();
      bigHanzi(outer, card, 40, 66, white);
      outer.addSpacer();
    } else {
      const outer = w.addStack();
      outer.layoutVertically();
      outer.addSpacer();
      bigHanzi(outer, card, 38, 150, white);
      outer.addSpacer(2);
      tonedPinyin(outer, card, 13, white, true);
      outer.addSpacer();
    }
  } else {
    w.setPadding(14, 14, 14, 14);
    w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"));
    const fg = Color.dynamic(new Color("#111111"), new Color("#f2f2f7"));
    const muted = Color.dynamic(new Color("#6b7280"), new Color("#9ca3af"));

    if (family === "small") {
      const stack = w.addStack();
      stack.layoutVertically();
      stack.addSpacer();
      bigHanzi(stack, card, 46, 132, null);
      if (card.p) {
        stack.addSpacer(4);
        tonedPinyin(stack, card, 14, null, true);
      }
      stack.addSpacer(3);
      const m = line(stack, card.m, 12, fg, false);
      m.centerAlignText();
      m.lineLimit = 3;
      m.minimumScaleFactor = 0.7;
      stack.addSpacer();
    } else {
      const isLarge = family === "large";
      const cols = w.addStack();
      cols.layoutHorizontally();
      cols.centerAlignContent();

      const left = cols.addStack();
      left.layoutVertically();
      left.size = new Size(isLarge ? 130 : 108, 0);
      left.addSpacer();
      bigHanzi(left, card, isLarge ? 68 : 54, isLarge ? 130 : 108, null);
      if (card.p) {
        left.addSpacer(4);
        tonedPinyin(left, card, isLarge ? 15 : 13, null, true);
      }
      left.addSpacer();

      cols.addSpacer(12);

      const right = cols.addStack();
      right.layoutVertically();
      right.addSpacer();
      const m = line(right, card.m, isLarge ? 16 : 14, fg, false);
      m.lineLimit = isLarge ? 5 : 4;
      m.minimumScaleFactor = 0.7;
      right.addSpacer(6);
      const tag = line(
        right,
        LESSON === 0 ? card.id : `第 ${LESSON} 課`,
        isLarge ? 12 : 10,
        muted,
        false
      );
      tag.lineLimit = 1;
      right.addSpacer();
    }
  }
}

// Refresh just after the next rotation boundary; iOS treats this as a hint.
w.refreshAfterDate = new Date((currentSlot() + 1) * ROTATE_MS + 5000);

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium();
}
Script.complete();
