import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();

// Helper function to generate mnemonic based on character meanings
function generateMnemonic(traditional: string, meaning: string, charMeanings: Map<string, string>): string {
    const chars = traditional.match(/[\u4e00-\u9fff]/g) || [];

    if (chars.length === 0) {
        return "";
    }

    if (chars.length === 1) {
        // For single character words, just use a simple reminder
        const charMeaning = charMeanings.get(chars[0]);
        if (charMeaning) {
            return `${chars[0]}：${charMeaning}`;
        }
        return "";
    }

    // For multi-character words, create a mnemonic from character meanings
    const charParts: string[] = [];
    for (const char of chars) {
        const charMeaning = charMeanings.get(char);
        if (charMeaning) {
            charParts.push(`${char}（${charMeaning}）`);
        } else {
            charParts.push(char);
        }
    }

    return charParts.join(" + ");
}

async function addMnemonicsToTOCFL() {
    try {
        console.log("Loading character meanings...");

        // First, get all learned characters to build a meaning map
        const charMeaningMap = new Map<string, string>();

        // Try to load from character notes if they exist
        try {
            const charNoteIds = await anki.note.findNotes({
                query: "note:Hanzi -is:suspended",
            });

            if (charNoteIds.length > 0) {
                const charNotes = await anki.note.notesInfo({ notes: charNoteIds });
                for (const note of charNotes) {
                    const traditional = note.fields["Traditional"]?.value;
                    const meaning = note.fields["Meaning"]?.value || note.fields["Meaning2"]?.value;
                    if (traditional && traditional.length === 1 && meaning) {
                        // Get first meaning only (before /)
                        const firstMeaning = meaning.split("/")[0].trim();
                        charMeaningMap.set(traditional, firstMeaning);
                    }
                }
                console.log(`Loaded ${charMeaningMap.size} character meanings from Hanzi notes`);
            }
        } catch (e) {
            console.log("No Hanzi notes found, will use phrase-based character extraction");
        }

        // If we don't have character meanings, extract from learned phrases
        if (charMeaningMap.size === 0) {
            console.log("Extracting character meanings from learned TOCFL phrases...");
            const learnedPhraseNoteIds = await anki.note.findNotes({
                query: "note:TOCFL -is:suspended",
            });
            const learnedPhraseNotes = await anki.note.notesInfo({ notes: learnedPhraseNoteIds });

            // For single-character phrases, we can extract the meaning
            for (const note of learnedPhraseNotes) {
                const traditional = note.fields["Traditional"].value;
                const meaning = note.fields["Meaning"].value;

                if (traditional.length === 1 && traditional.match(/[\u4e00-\u9fff]/)) {
                    const firstMeaning = meaning.split("/")[0].split("<br>")[0].trim();
                    if (!charMeaningMap.has(traditional)) {
                        charMeaningMap.set(traditional, firstMeaning);
                    }
                }
            }
            console.log(`Extracted ${charMeaningMap.size} character meanings from phrases`);
        }

        console.log("\nFetching TOCFL notes to add mnemonics...");

        // Get all TOCFL notes (we'll update both suspended and non-suspended)
        const phraseNoteIds = await anki.note.findNotes({
            query: "note:TOCFL",
        });
        const phraseNotes = await anki.note.notesInfo({ notes: phraseNoteIds });

        console.log(`Found ${phraseNotes.length} TOCFL notes`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const note of phraseNotes) {
            const traditional = note.fields["Traditional"].value;
            const meaning = note.fields["Meaning"].value;
            const currentMnemonic = note.fields["Mnemonic"]?.value || "";

            // Skip if mnemonic already exists
            if (currentMnemonic && currentMnemonic.trim().length > 0) {
                skippedCount++;
                continue;
            }

            // Generate mnemonic
            const mnemonic = generateMnemonic(traditional, meaning, charMeaningMap);

            if (mnemonic) {
                // Update the note
                await anki.note.updateNoteFields({
                    note: {
                        id: note.noteId,
                        fields: {
                            Mnemonic: mnemonic,
                        },
                    },
                });
                updatedCount++;

                if (updatedCount <= 10) {
                    console.log(`${updatedCount}. ${traditional}: ${mnemonic}`);
                } else if (updatedCount === 11) {
                    console.log("...");
                }
            }
        }

        console.log("\n" + "=".repeat(80));
        console.log(`✅ Successfully added mnemonics to ${updatedCount} TOCFL notes`);
        console.log(`⏭️  Skipped ${skippedCount} notes that already had mnemonics`);
        console.log(`Total processed: ${phraseNotes.length} notes`);

    } catch (error) {
        console.error("Error adding mnemonics:", error);
    }
}

addMnemonicsToTOCFL();
