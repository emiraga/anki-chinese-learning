/**
 * Update TOCFL note type for SingleChars deck:
 * - Add "Sample Sentences" field if missing
 * - Set responsive Front/Back templates and CSS (mobile-friendly, 3 example sentences on back)
 *
 * Run with Anki open and AnkiConnect enabled:
 *   npx tsx utils/update_tocfl_single_chars_template.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { YankiConnect } from "yanki-connect";

const MODEL_NAME = "TOCFL";
const SAMPLE_FIELD = "Sample Sentences";
const TRAD_COLORED_FIELD = "Traditional Colored";
const PINYIN_COLORED_FIELD = "Pinyin Colored";

const anki = new YankiConnect();

function getTemplateDir(): string {
  const cwd = process.cwd();
  return join(cwd, "anki", "tocfl_single_chars");
}

async function main() {
  const dir = getTemplateDir();
  const frontHtml = readFileSync(join(dir, "front.html"), "utf-8").trim();
  const backHtml = readFileSync(join(dir, "back.html"), "utf-8").trim();
  const css = readFileSync(join(dir, "styling.css"), "utf-8").trim();

  const models = await anki.model.findModelsByName({ modelNames: [MODEL_NAME] });
  if (!models || models.length === 0) {
    throw new Error(`Model "${MODEL_NAME}" not found. Is Anki open with that note type?`);
  }

  const model = models[0];
  const fieldNames: string[] = model.flds.map((f) => f.name);

  for (const [fieldName, desc] of [
    [SAMPLE_FIELD, "Sample Sentences"],
    [TRAD_COLORED_FIELD, "Traditional Colored (for mobile tone colors)"],
    [PINYIN_COLORED_FIELD, "Pinyin Colored (for mobile tone colors)"],
  ] as [string, string][]) {
    if (!fieldNames.includes(fieldName)) {
      console.log(`Adding field "${fieldName}" to ${MODEL_NAME}...`);
      await anki.model.modelFieldAdd({
        modelName: MODEL_NAME,
        fieldName,
        index: fieldNames.length,
      });
      fieldNames.push(fieldName);
      console.log(`  Done.`);
    }
  }

  const templates = await anki.model.modelTemplates({ modelName: MODEL_NAME });
  const templateNames = Object.keys(templates || {});
  if (templateNames.length === 0) {
    throw new Error(`No card templates found for ${MODEL_NAME}.`);
  }

  // Only update one template so we don't make two cards identical (Anki rejects duplicate fronts).
  // Prefer the template named "TOCFL" (main card), else the first in list.
  const targetName = templateNames.includes("TOCFL") ? "TOCFL" : templateNames[0];
  const updates: Record<string, { Front: string; Back: string }> = {
    [targetName]: { Front: frontHtml, Back: backHtml },
  };

  console.log(`Updating template "${targetName}" (${templateNames.length} total; others unchanged)...`);
  await anki.model.updateModelTemplates({
    model: { name: MODEL_NAME, templates: updates },
  });

  console.log("Updating card styling (responsive CSS)...");
  await anki.model.updateModelStyling({
    model: { name: MODEL_NAME, css },
  });

  console.log("\nDone. TOCFL cards are now responsive and show Sample Sentences on the back when filled.");
  console.log("For tone colors on mobile: run  npx tsx utils/fill_tocfl_colored_fields.ts  then sync.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
