/**
 * Improve the template for deck Chinese::English:
 * - Add Pleco link (opens phrase/word in Pleco)
 * - Add styles and color coding (traditional, pinyin, meaning) without changing content order
 *
 * Discovers the note type and card template used by deck "Chinese::English",
 * then injects wrapper divs and Pleco into the Back template and appends CSS.
 *
 * Run with Anki open and AnkiConnect enabled:
 *   npx tsx utils/update_chinese_english_template.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { YankiConnect } from "yanki-connect";

const DECK = "Chinese::English";
const ANKI_CHINESE_ENGLISH_DIR = join(process.cwd(), "anki", "chinese_english");
const ADDITIONS_CSS_PATH = join(ANKI_CHINESE_ENGLISH_DIR, "additions.css");
const TOCFL_TONE_BLOCK_PATH = join(ANKI_CHINESE_ENGLISH_DIR, "tocfl_tone_block.html");

/** Map field name -> CSS class for styling. */
const FIELD_TO_CLASS: Record<string, string> = {
  Traditional: "ce-traditional",
  Hanzi: "ce-traditional",
  Chinese: "ce-traditional",
  Front: "ce-traditional",
  Pinyin: "ce-pinyin",
  Reading: "ce-pinyin",
  Meaning: "ce-meaning",
  Definition: "ce-meaning",
  English: "ce-meaning",
  Back: "ce-meaning",
};

const anki = new YankiConnect();

/** Replace first occurrence only */
function replaceFirst(html: string, search: string, replacement: string): string {
  const i = html.indexOf(search);
  if (i === -1) return html;
  return html.slice(0, i) + replacement + html.slice(i + search.length);
}

/** Build Pleco block using the given field name (e.g. Traditional or Hanzi). Single link only; script bails if container already filled. */
function plecoBlock(plecoFieldName: string): string {
  return `
<script type="text/template" id="pleco-char">{{${plecoFieldName}}}</script>
<div class="ce-pleco-wrap" id="pleco-link-container"></div>
<script>
(function(){
  var container = document.getElementById('pleco-link-container');
  if (!container || container.firstChild) return;
  var t = document.getElementById('pleco-char');
  if (!t) return;
  var text = (t.textContent || t.innerText || '').trim();
  if (!text) return;
  var url = 'plecoapi://x-callback-url/df?hw=' + encodeURIComponent(text);
  var a = document.createElement('a');
  a.href = url;
  a.className = 'pleco-link';
  a.textContent = 'Pleco';
  container.appendChild(a);
})();
</script>
`.trim();
}

/**
 * Load TOCFL tone block (same HTML + script as tocfl_single_chars/back.html), split into char-main and pinyin parts, substitute field names.
 */
function loadTocflToneBlocks(
  tradFieldName: string,
  pinyinFieldName: string
): { charMainBlock: string; pinyinBlock: string } {
  const raw = readFileSync(TOCFL_TONE_BLOCK_PATH, "utf-8").trim();
  const substitute = (s: string) =>
    s.replace(/\{\{Traditional\}\}/g, `{{${tradFieldName}}}`).replace(/\{\{Pinyin\}\}/g, `{{${pinyinFieldName}}}`);
  const sep = "</div>\n<div class=\"pinyin\">";
  const i = raw.indexOf(sep);
  if (i === -1) {
    return { charMainBlock: substitute(raw), pinyinBlock: "" };
  }
  const charMainBlock = substitute(raw.slice(0, i));
  const pinyinBlock = substitute("<div class=\"pinyin\">" + raw.slice(i + sep.length));
  return { charMainBlock, pinyinBlock };
}

/**
 * Inject back template: use TOCFL tone block (same code as Chinese::SingleChars), ce-back wrapper, and Pleco.
 */
function improveBack(back: string, fieldNames: string[]): { back: string } {
  let out = back;
  let plecoField = "";

  const tradField = fieldNames.find((f) => FIELD_TO_CLASS[f] === "ce-traditional");
  const pinyinField = fieldNames.find((f) => FIELD_TO_CLASS[f] === "ce-pinyin");
  const hasToneSupport = tradField && pinyinField && out.includes(`{{${tradField}}}`) && out.includes(`{{${pinyinField}}}`);

  let charMainBlock = "";
  let pinyinBlock = "";

  if (hasToneSupport && tradField && pinyinField) {
    const blocks = loadTocflToneBlocks(tradField, pinyinField);
    charMainBlock = blocks.charMainBlock;
    pinyinBlock = blocks.pinyinBlock;
  }

  // Replace pinyin first, then traditional, so order in back is preserved
  if (hasToneSupport && pinyinField && pinyinBlock) {
    const pyPlaceholder = `{{${pinyinField}}}`;
    if (out.includes(pyPlaceholder)) {
      out = replaceFirst(out, pyPlaceholder, pinyinBlock);
    }
  }

  for (const fname of fieldNames) {
    const placeholder = `{{${fname}}}`;
    if (out.indexOf(placeholder) === -1) continue;
    const cls = FIELD_TO_CLASS[fname] ?? "ce-meaning";
    if (cls === "ce-traditional") plecoField = fname;

    let replacement: string;
    if (cls === "ce-traditional" && hasToneSupport && charMainBlock) {
      replacement = charMainBlock;
    } else if (cls === "ce-pinyin" && hasToneSupport) {
      continue;
    } else {
      replacement = `<div class="${cls}">${placeholder}</div>`;
    }
    out = replaceFirst(out, placeholder, replacement);
  }
  if (!plecoField) plecoField = fieldNames[0] ?? "Traditional";

  out = '<div class="ce-back">' + out.trimEnd() + "</div>\n" + plecoBlock(plecoField);
  return { back: out };
}

async function main() {
  const cardIds = await anki.card.findCards({ query: `deck:"${DECK}"` });
  if (!cardIds.length) {
    throw new Error(`No cards in deck "${DECK}". Create the deck and add at least one card.`);
  }

  const [firstCardId] = cardIds;
  const cardsInfo = await anki.card.cardsInfo({ cards: [firstCardId] });
  const card = cardsInfo[0];
  if (!card) throw new Error("Could not get card info.");
  const noteId = card.note;
  const ord = card.ord ?? 0;

  const notesInfo = await anki.note.notesInfo({ notes: [noteId] });
  const note = notesInfo[0];
  if (!note) throw new Error("Could not get note info.");
  const modelName = note.modelName;

  const fieldNames = await anki.model.modelFieldNames({ modelName });
  const templates = await anki.model.modelTemplates({ modelName });
  const tmpls = (templates || {}) as Record<string, { Front?: string; Back?: string }>;
  const templateNames = Object.keys(tmpls);
  if (!templateNames.length) throw new Error(`No templates for model "${modelName}".`);
  const targetTemplateName = templateNames[ord] ?? templateNames[0];

  const currentBack = tmpls[targetTemplateName]?.Back ?? "";
  const { back: improvedBack } = improveBack(currentBack, fieldNames);

  const additionsCss = readFileSync(ADDITIONS_CSS_PATH, "utf-8").trim();
  const styling = await anki.model.modelStyling({ modelName });
  const currentCss =
    typeof styling === "string" ? styling : (styling as { css?: string } | null)?.css ?? "";
  const newCss = (currentCss || "").trim() + "\n\n" + additionsCss;

  console.log(`Deck: ${DECK}`);
  console.log(`Model: ${modelName}`);
  console.log(`Template: ${targetTemplateName} (ord ${ord})`);
  console.log("Updating Back template (wrappers + Pleco) and styling...");

  const updatedTemplates: Record<string, { Front: string; Back: string }> = {};
  for (const name of templateNames) {
    const t = tmpls[name];
    updatedTemplates[name] = {
      Front: t?.Front ?? "",
      Back: name === targetTemplateName ? improvedBack : (t?.Back ?? ""),
    };
  }
  await anki.model.updateModelTemplates({
    model: { name: modelName, templates: updatedTemplates },
  });

  await anki.model.updateModelStyling({
    model: { name: modelName, css: newCss },
  });

  console.log("\nDone. Chinese::English cards now have color coding and an Open in Pleco link.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
