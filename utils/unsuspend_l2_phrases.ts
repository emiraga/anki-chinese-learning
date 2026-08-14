import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();

async function unsuspendL2Phrases() {
    try {
        console.log("Fetching learned TOCFL phrases to determine known characters...");

        // Get all TOCFL phrases that are NOT suspended (i.e., already studied)
        const learnedPhraseNoteIds = await anki.note.findNotes({
            query: "note:TOCFL -is:suspended",
        });
        const learnedPhraseNotes = await anki.note.notesInfo({ notes: learnedPhraseNoteIds });

        // Extract all characters from learned phrases
        const knownChars = new Set<string>();
        for (const note of learnedPhraseNotes) {
            const traditional = note.fields["Traditional"].value;
            for (const char of traditional) {
                // Only add Chinese characters (not punctuation)
                if (char.match(/[\u4e00-\u9fff]/)) {
                    knownChars.add(char);
                }
            }
        }

        console.log(`You know ${knownChars.size} characters (from ${learnedPhraseNotes.length} learned phrases)`);
        console.log("\nFetching suspended TOCFL phrases tagged with L2...");

        // Get all suspended TOCFL phrases tagged with L2
        const phraseNoteIds = await anki.note.findNotes({
            query: "note:TOCFL is:suspended tag:L2",
        });
        const phraseNotes = await anki.note.notesInfo({ notes: phraseNoteIds });

        console.log(`Found ${phraseNotes.length} suspended TOCFL phrases with L2 tag`);

        // Filter for phrases where we know 100% of characters
        const notesToUnsuspend: number[] = [];
        const cardsToUnsuspend: number[] = [];
        const phraseDetails: Array<{ traditional: string; pinyin: string; meaning: string }> = [];

        for (const note of phraseNotes) {
            const traditional = note.fields["Traditional"].value;
            const pinyin = note.fields["Pinyin"].value;
            const meaning = note.fields["Meaning"].value;

            // Check if we know all characters
            let allKnown = true;
            let charCount = 0;

            for (const char of traditional) {
                if (char.match(/[\u4e00-\u9fff]/)) {
                    charCount++;
                    if (!knownChars.has(char)) {
                        allKnown = false;
                        break;
                    }
                }
            }

            if (allKnown && charCount > 0) {
                notesToUnsuspend.push(note.noteId);
                // Collect all card IDs from this note
                if (note.cards && note.cards.length > 0) {
                    cardsToUnsuspend.push(...note.cards);
                }
                phraseDetails.push({ traditional, pinyin, meaning });
            }
        }

        console.log(`\nFound ${notesToUnsuspend.length} L2-tagged phrases with 100% known characters`);
        console.log(`Total cards to unsuspend: ${cardsToUnsuspend.length}`);

        if (cardsToUnsuspend.length === 0) {
            console.log("\nNo cards to unsuspend!");
            return;
        }

        // Show what we're about to unsuspend
        console.log("\nPhrases to unsuspend:");
        console.log("=".repeat(80));
        for (let i = 0; i < Math.min(phraseDetails.length, 20); i++) {
            const phrase = phraseDetails[i];
            console.log(`${i + 1}. ${phrase.traditional} (${phrase.pinyin}) - ${phrase.meaning}`);
        }
        if (phraseDetails.length > 20) {
            console.log(`... and ${phraseDetails.length - 20} more`);
        }

        console.log("\n" + "=".repeat(80));
        console.log(`Unsuspending ${cardsToUnsuspend.length} cards from ${notesToUnsuspend.length} notes...`);

        // Unsuspend the cards
        await anki.card.unsuspend({ cards: cardsToUnsuspend });

        console.log("✅ Successfully unsuspended all L2-tagged phrases with 100% known characters!");

    } catch (error) {
        console.error("Error unsuspending L2 phrases:", error);
    }
}

unsuspendL2Phrases();
