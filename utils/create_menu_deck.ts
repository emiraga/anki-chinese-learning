import { YankiConnect } from "yanki-connect";

const anki = new YankiConnect();

interface PhraseData {
    traditional: string;
    pinyin: string;
    meaning: string;
    mnemonic?: string;
}

const MENU_PHRASES: PhraseData[] = [
    // Drinks
    { traditional: "咖啡", pinyin: "kā fēi", meaning: "Coffee" },
    { traditional: "美式", pinyin: "měi shì", meaning: "Americano" },
    { traditional: "拿鐵", pinyin: "ná tiě", meaning: "Latte" },
    { traditional: "燕麥奶", pinyin: "yàn mài nǎi", meaning: "Oat milk" },
    { traditional: "紅茶", pinyin: "hóng chá", meaning: "Black tea" },
    { traditional: "奶茶", pinyin: "nǎi chá", meaning: "Milk tea" },
    { traditional: "珍珠", pinyin: "zhēn zhū", meaning: "Pearls / Boba" },

    // Customization (Sugar/Ice)
    { traditional: "無糖", pinyin: "wú táng", meaning: "No sugar" },
    { traditional: "微糖", pinyin: "wēi táng", meaning: "Low sugar (25%)" },
    { traditional: "半糖", pinyin: "bàn táng", meaning: "Half sugar (50%)" },
    { traditional: "少糖", pinyin: "shǎo táng", meaning: "Less sugar (75%)" },
    { traditional: "全糖", pinyin: "quán táng", meaning: "Full sugar" },
    { traditional: "去冰", pinyin: "qù bīng", meaning: "No ice" },
    { traditional: "微冰", pinyin: "wēi bīng", meaning: "Little ice" },
    { traditional: "少冰", pinyin: "shǎo bīng", meaning: "Less ice" },
    { traditional: "常溫", pinyin: "cháng wēn", meaning: "Room temperature" },
    { traditional: "熱", pinyin: "rè", meaning: "Hot" },
    { traditional: "冰", pinyin: "bīng", meaning: "Ice / Cold" },

    // Breakfast & Staples
    { traditional: "蛋餅", pinyin: "dàn bǐng", meaning: "Egg crepe" },
    { traditional: "吐司", pinyin: "tǔ sī", meaning: "Toast" },
    { traditional: "漢堡", pinyin: "hàn bǎo", meaning: "Burger" },
    { traditional: "三明治", pinyin: "sān míng zhì", meaning: "Sandwich" },
    { traditional: "飯糰", pinyin: "fàn tuán", meaning: "Rice ball" },
    { traditional: "牛肉麵", pinyin: "niú ròu miàn", meaning: "Beef noodles" },
    { traditional: "滷肉飯", pinyin: "lǔ ròu fàn", meaning: "Braised pork rice" },
    { traditional: "小籠包", pinyin: "xiǎo lóng bāo", meaning: "Soup dumplings" },
    { traditional: "煎餃", pinyin: "jiān jiǎo", meaning: "Fried dumplings" },
    { traditional: "水餃", pinyin: "shuǐ jiǎo", meaning: "Boiled dumplings" },

    // Ingredients
    { traditional: "豬肉", pinyin: "zhū ròu", meaning: "Pork" },
    { traditional: "牛肉", pinyin: "niú ròu", meaning: "Beef" },
    { traditional: "雞肉", pinyin: "jī ròu", meaning: "Chicken" },
    { traditional: "培根", pinyin: "péi gēn", meaning: "Bacon" },
    { traditional: "鮪魚", pinyin: "wěi yú", meaning: "Tuna" },
    { traditional: "蔬菜", pinyin: "shū cài", meaning: "Vegetables" },
    { traditional: "蛋", pinyin: "dàn", meaning: "Egg" },
    { traditional: "起司", pinyin: "qǐ sī", meaning: "Cheese" },
    { traditional: "火腿", pinyin: "huǒ tuǐ", meaning: "Ham" },

    // Dishes & Signature Items
    { traditional: "三杯雞", pinyin: "sān bēi jī", meaning: "Three cup chicken" },
    { traditional: "蚵仔煎", pinyin: "é zǐ jiān", meaning: "Oyster omelet" },
    { traditional: "臭豆腐", pinyin: "chòu dòu fǔ", meaning: "Stinky tofu" },
    { traditional: "雞肉飯", pinyin: "jī ròu fàn", meaning: "Chicken rice" },
    { traditional: "排骨飯", pinyin: "pái gǔ fàn", meaning: "Pork chop rice" },
    { traditional: "控肉飯", pinyin: "kòng ròu fàn", meaning: "Braised pork belly rice" },
    { traditional: "蔥油餅", pinyin: "cōng yóu bǐng", meaning: "Scallion pancake" },
    { traditional: "刈包", pinyin: "guà bāo", meaning: "Gua bao (Pork belly bun)" },
    { traditional: "蚵仔麵線", pinyin: "é zǐ miàn xiàn", meaning: "Oyster vermicelli" },
    { traditional: "鹹酥雞", pinyin: "xián sū jī", meaning: "Popcorn chicken" },
    { traditional: "火鍋", pinyin: "huǒ guō", meaning: "Hot pot" },
    { traditional: "麻辣鍋", pinyin: "má là guō", meaning: "Spicy hot pot" },
    { traditional: "燙青菜", pinyin: "tàng qīng cài", meaning: "Blanched vegetables" },
    { traditional: "滷味", pinyin: "lǔ wèi", meaning: "Braised snacks (Lu wei)" },
    { traditional: "貢丸湯", pinyin: "gòng wán tāng", meaning: "Pork ball soup" },
    { traditional: "皮蛋豆腐", pinyin: "pí dàn dòu fǔ", meaning: "Century egg with tofu" },
    { traditional: "麻醬麵", pinyin: "má jiàng miàn", meaning: "Sesame noodles" },
    { traditional: "炸醬麵", pinyin: "zhá jiàng miàn", meaning: "Fried bean sauce noodles" },
    { traditional: "香腸", pinyin: "xiāng cháng", meaning: "Taiwanese sausage" },

    // Service
    { traditional: "內用", pinyin: "nèi yòng", meaning: "Dine-in" },
    { traditional: "外帶", pinyin: "wài dài", meaning: "Take-out" },
    { traditional: "單點", pinyin: "dān diǎn", meaning: "A la carte" },
    { traditional: "套餐", pinyin: "tào cān", meaning: "Set meal" },
    { traditional: "推薦", pinyin: "tuī jiàn", meaning: "Recommend" },
    { traditional: "結帳", pinyin: "jié zhàng", meaning: "Check out / Pay the bill" },
];

async function main() {
    const DECK_NAME = "Chinese::Taiwan Menu";
    const MODEL_NAME = "TOCFL";
    const timestamp = Date.now();

    try {
        console.log(`Checking/Creating deck: ${DECK_NAME}...`);
        await anki.deck.createDeck({ deck: DECK_NAME });

        console.log(`Adding ${MENU_PHRASES.length} phrases...`);
        const successfulNoteIds: number[] = [];

        for (let i = 0; i < MENU_PHRASES.length; i++) {
            const phrase = MENU_PHRASES[i];
            try {
                // Check if already exists
                const existing = await anki.note.findNotes({
                    query: `deck:"${DECK_NAME}" Traditional:"${phrase.traditional}"`
                });

                if (existing.length > 0) {
                    console.log(`  - Skipped (exists): ${phrase.traditional}`);
                    continue;
                }

                const noteId = await anki.note.addNote({
                    note: {
                        deckName: DECK_NAME,
                        modelName: MODEL_NAME,
                        fields: {
                            ID: `MENU-${timestamp}-${i + 1}`,
                            Traditional: phrase.traditional,
                            Simplified: phrase.traditional,
                            Pinyin: phrase.pinyin,
                            POS: "Menu",
                            Meaning: phrase.meaning,
                            "Meaning 2": "",
                            Variants: "",
                            Audio: "",
                            Pleco: "",
                            Mnemonic: phrase.mnemonic || "",
                        },
                        tags: ["taiwan-menu", "manual-add"]
                    }
                });
                if (noteId) {
                    successfulNoteIds.push(noteId as number);
                    console.log(`  ✓ Added: ${phrase.traditional}`);
                }
            } catch (e) {
                console.error(`  ✗ Failed to add ${phrase.traditional}:`, e);
            }
        }

        if (successfulNoteIds.length > 0) {
            console.log(`\nSuspending ${successfulNoteIds.length} notes...`);
            const cardIds: number[] = [];
            for (const noteId of successfulNoteIds) {
                const ids = await anki.card.findCards({ query: `nid:${noteId}` });
                cardIds.push(...ids);
            }
            if (cardIds.length > 0) {
                await anki.card.suspend({ cards: cardIds });
                console.log(`✓ Suspended ${cardIds.length} cards.`);
            }
        }

        console.log("\nDone! Please run the audio generation script next:");
        console.log("utils/tts/fill_audio_anki.py --use-pinyin-hint");

    } catch (error) {
        console.error("Error creating deck:", error);
    }
}

main();
