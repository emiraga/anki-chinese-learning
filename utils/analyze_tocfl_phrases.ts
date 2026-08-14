import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();

interface CharacterInfo {
    traditional: string;
    known: boolean;
}

interface PhraseAnalysis {
    noteId: number;
    traditional: string;
    meaning: string;
    pinyin: string;
    characters: CharacterInfo[];
    knownCharCount: number;
    totalCharCount: number;
    knownPercentage: number;
}

async function analyzeTOCFLPhrases() {
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
        console.log("\nFetching suspended TOCFL phrases (cards you haven't studied yet)...");

        // Get all suspended TOCFL phrases (the ones you haven't studied yet)
        const phraseNoteIds = await anki.note.findNotes({
            query: "note:TOCFL is:suspended",
        });
        const phraseNotes = await anki.note.notesInfo({ notes: phraseNoteIds });

        console.log(`Found ${phraseNotes.length} TOCFL phrases`);
        console.log("\nAnalyzing phrases...\n");

        const analyses: PhraseAnalysis[] = [];

        for (const note of phraseNotes) {
            const traditional = note.fields["Traditional"].value;
            const meaning = note.fields["Meaning"].value;
            const pinyin = note.fields["Pinyin"].value;

            // Analyze each character
            const characters: CharacterInfo[] = [];
            let knownCount = 0;

            for (const char of traditional) {
                // Skip punctuation and special characters
                if (char.match(/[\u4e00-\u9fff]/)) {
                    const known = knownChars.has(char);
                    characters.push({ traditional: char, known });
                    if (known) knownCount++;
                }
            }

            const totalCount = characters.length;
            const percentage = totalCount > 0 ? (knownCount / totalCount) * 100 : 0;

            analyses.push({
                noteId: note.noteId,
                traditional,
                meaning,
                pinyin,
                characters,
                knownCharCount: knownCount,
                totalCharCount: totalCount,
                knownPercentage: percentage,
            });
        }

        // Filter and sort suspended phrases by known character percentage
        const suspendedPhrasesWithMostKnownChars = analyses
            .filter(p => p.totalCharCount > 0)
            .sort((a, b) => {
                // Sort by percentage descending, then by total char count ascending
                if (b.knownPercentage !== a.knownPercentage) {
                    return b.knownPercentage - a.knownPercentage;
                }
                return a.totalCharCount - b.totalCharCount;
            });

        // Show top recommendations
        console.log("=".repeat(80));
        console.log("TOP RECOMMENDATIONS: Suspended TOCFL phrases you should learn next");
        console.log("=".repeat(80));
        console.log("\n");

        const topRecommendations = suspendedPhrasesWithMostKnownChars.slice(0, 50);

        for (let i = 0; i < topRecommendations.length; i++) {
            const phrase = topRecommendations[i];
            const unknownChars = phrase.characters
                .filter(c => !c.known)
                .map(c => c.traditional)
                .join(", ");

            console.log(`${i + 1}. ${phrase.traditional} (${phrase.pinyin})`);
            console.log(`   Meaning: ${phrase.meaning}`);
            console.log(`   Known: ${phrase.knownCharCount}/${phrase.totalCharCount} characters (${phrase.knownPercentage.toFixed(0)}%)`);
            if (unknownChars) {
                console.log(`   Unknown characters: ${unknownChars}`);
            }
            console.log("");
        }

        // Statistics
        console.log("\n" + "=".repeat(80));
        console.log("STATISTICS");
        console.log("=".repeat(80));
        console.log(`Total suspended TOCFL phrases: ${analyses.length}`);
        console.log(`Suspended phrases with 100% known chars: ${suspendedPhrasesWithMostKnownChars.filter(p => p.knownPercentage === 100).length}`);
        console.log(`Suspended phrases with 75-99% known chars: ${suspendedPhrasesWithMostKnownChars.filter(p => p.knownPercentage >= 75 && p.knownPercentage < 100).length}`);
        console.log(`Suspended phrases with 50-74% known chars: ${suspendedPhrasesWithMostKnownChars.filter(p => p.knownPercentage >= 50 && p.knownPercentage < 75).length}`);
        console.log(`Suspended phrases with 25-49% known chars: ${suspendedPhrasesWithMostKnownChars.filter(p => p.knownPercentage >= 25 && p.knownPercentage < 50).length}`);
        console.log(`Suspended phrases with 0-24% known chars: ${suspendedPhrasesWithMostKnownChars.filter(p => p.knownPercentage < 25).length}`);

    } catch (error) {
        console.error("Error analyzing TOCFL phrases:", error);
    }
}

analyzeTOCFLPhrases();
