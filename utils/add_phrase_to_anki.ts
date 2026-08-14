import { YankiConnect } from "yanki-connect";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const anki = new YankiConnect();

interface PhraseData {
  traditional: string;
  pinyin: string;
  meaning: string;
  zhuyin?: string;
  mnemonic?: string;
}

async function addPhrasesToAnki(phrases: PhraseData[], deckName = "Chinese::phrases") {
  try {
    console.log(`\nAdding ${phrases.length} phrase(s) to Anki (deck: ${deckName})...\n`);

    const results = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      try {
        const note = {
          deckName: deckName,
          modelName: "TOCFL",
          fields: {
            ID: `MANUAL-${timestamp}-${i + 1}`,
            Traditional: phrase.traditional,
            Simplified: phrase.traditional, // Same as traditional for Taiwan-focused learning
            Pinyin: phrase.pinyin,
            POS: "",
            Meaning: phrase.meaning,
            "Meaning 2": "",
            Variants: "",
            Audio: "",
            Pleco: "",
            Mnemonic: phrase.mnemonic || "",
          },
          tags: ["manual-add"],
        };

        const noteId = await anki.note.addNote({ note });
        results.push({ success: true, noteId, phrase });
        console.log(`  ✓ ${phrase.traditional} (${phrase.pinyin})`);
      } catch (error) {
        results.push({ success: false, error, phrase });
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`  ✗ ${phrase.traditional} (${phrase.pinyin}) - ${errorMsg}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`\n✓ Successfully added ${successCount} phrase(s) to Anki!`);
    if (failureCount > 0) {
      console.log(`⚠ ${failureCount} phrase(s) failed (likely duplicates)`);
    }

    return results;
  } catch (error) {
    console.error("Error adding phrases to Anki:", error);
    throw error;
  }
}

async function suspendCardsForNotes(noteIds: number[]) {
  if (noteIds.length === 0) {
    return;
  }

  try {
    console.log(`\nSuspending cards for ${noteIds.length} note(s)...`);
    
    // Find all cards for these notes
    const allCardIds: number[] = [];
    for (const noteId of noteIds) {
      const cardIds = await anki.card.findCards({ query: `nid:${noteId}` });
      allCardIds.push(...cardIds);
    }
    
    if (allCardIds.length > 0) {
      await anki.card.suspend({ cards: allCardIds });
      console.log(`✓ Suspended ${allCardIds.length} card(s)`);
    }
    
  } catch (error) {
    console.error("\n⚠ Error suspending cards:", error);
    console.log("You can manually suspend cards by searching: tag:manual-add");
  }
}

async function generateAudioForNotes(noteIds: number[]) {
  if (noteIds.length === 0) {
    return;
  }

  try {
    console.log(`\nGenerating audio for ${noteIds.length} note(s)...`);
    
    // Create a temporary script to generate audio for specific notes
    const scriptPath = new URL("../tts/fill_audio_anki.py", import.meta.url).pathname;
    
    for (const noteId of noteIds) {
      try {
        // Get note info to extract text and pinyin
        const noteInfo = await anki.note.notesInfo({ notes: [noteId] });
        
        if (noteInfo && noteInfo.length > 0) {
          const note = noteInfo[0];
          const traditional = note.fields.Traditional?.value || "";
          const pinyin = note.fields.Pinyin?.value || "";
          
          if (traditional && pinyin) {
            console.log(`  Generating audio for: ${traditional} (${pinyin})`);
            
            // Call Python script to generate audio for this specific note
            // We'll use a simpler approach - just call the script for all empty audio
            // Since we just created these notes, they'll have empty audio
          }
        }
      } catch (error) {
        console.error(`  ✗ Failed to generate audio for note ${noteId}:`, error);
      }
    }
    
    // Run the Python script to fill all empty audio (including our new notes)
    console.log("\nRunning TTS generation script...");
    const { stdout, stderr } = await execAsync(
      `cd "${process.cwd()}" && utils/tts/fill_audio_anki.py --use-pinyin-hint`
    );
    
    if (stderr && !stderr.includes("dump_bash_state")) {
      console.error("TTS script errors:", stderr);
    }
    
    console.log("\n✓ Audio generation complete!");
    
  } catch (error) {
    console.error("\n⚠ Error generating audio:", error);
    console.log("You can manually generate audio by running:");
    console.log("  utils/tts/fill_audio_anki.py --use-pinyin-hint");
  }
}

/**
 * Example usage:
 * 
 * To add new phrases, replace the phrasesToAdd array with your own phrases.
 * Each phrase needs:
 *   - traditional: Traditional Chinese text
 *   - pinyin: Pinyin with tone marks (e.g., nǐ hǎo)
 *   - meaning: English meaning/translation
 *   - mnemonic (optional): Memory aid
 * 
 * Then run: npx tsx utils/add_phrase_to_anki.ts
 * 
 * The script will automatically:
 * 1. Add the phrases to Anki
 * 2. Generate Taiwanese Mandarin TTS audio for each phrase
 * 3. Suspend all cards (so you can unsuspend them when ready)
 */
async function main() {
  const phrasesToAdd: PhraseData[] = [
    {
      traditional: "你好",
      pinyin: "nǐ hǎo",
      meaning: "hello",
    },
    // Add more phrases here...
  ];

  if (phrasesToAdd.length === 0) {
    console.log("\nNo phrases to add. Edit the phrasesToAdd array in this file.");
    return;
  }

  // Specify the deck name (defaults to "Chinese::phrases")
  const deckName = "Chinese::phrases";
  
  // Add phrases to Anki
  const results = await addPhrasesToAnki(phrasesToAdd, deckName);
  
  // Extract successful note IDs for audio generation and suspension
  const successfulNoteIds = results
    .filter((r) => r.success && r.noteId)
    .map((r) => r.noteId as number);
  
  if (successfulNoteIds.length > 0) {
    // Generate audio for the new notes
    await generateAudioForNotes(successfulNoteIds);
    
    // Suspend all cards for these notes
    await suspendCardsForNotes(successfulNoteIds);
  }
}

// Run the main function
main().catch(console.error);

export { addPhrasesToAnki };
export type { PhraseData };

