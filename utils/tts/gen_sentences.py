import google.generativeai as genai
import json
import os
from urllib.parse import quote
import time
from google.cloud import texttospeech
import random
from datetime import datetime

with open("ai_key.txt") as f:
    genai.configure(api_key=f.read().strip())

CHARS = "的一是不了在人有我他這個們中來上大為和國地到以說時要就出會可也你對生能子那得下自之年過作裡用道行所然家事成方多去法學如都同現當沒動麵起看定天分還進好小其些主樣心她本前開但因只從想日者意無力長把機十第公工明知三關點業外兩高間問很最物手文體美相見二等或新己身果西月話回特內老給世位次門常先海教兒東比水名真走入幾口認係氣題更別打女四電安少才太再做接件計期市山許至便空馬五書非聽白界光難思完路南住程北邊張取拉覺共師今院識候帶運每車親林服快英近準始怎呢叫台單影字愛備商百需花城亞請息火視越容照九寫八嗎包片易早除找吧吃念六週較推房半黑律足七興孩星音跟底站母京米客密友止千男錢網熱坐船樂球怕校苦久錯晚腦誰哪尼驚夜初喜食待習歡停游龍冷洲句漢衣您媽讀啊買歲著田左右份塊酒島哥寶弟伯慢歐忙姐介臨亮沙魚灣貴朋秘謝鐘禮雨闆飯脫旅筆睡賣堂喝園午練肉牛店爸床迎冰玩休兄街頁姓誠末妹課懂廳拜紹菜閉茶奶珠宜珍羊零胸蛋雞杯租餐昨漂腐鞋糖豬豆搭胖餓籠聊肌碗鈴飽乾甜灘臭後鴨姊棒啡噢籃咖糕辣踢蘋怡勿炒泳麼啤什面椰它遊周臺妳裏"
RANDOM_ORDER_CHARS = ''.join(random.sample(CHARS, len(CHARS)))

SPECIAL_CHARS = None

def setup_credentials():
    """
    Set up Google Cloud credentials
    You need to:
    1. Create a Google Cloud project
    2. Enable Text-to-Speech API
    3. Create a service account and download JSON key
    4. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
    """
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "gcloud_account.json"
    pass

def get_chinese_sentences_and_translations():
    """
    Generate 10 Chinese sentences using restricted vocabulary via API
    Returns JSON with Traditional Chinese sentences and their English translations
    """

    model = genai.GenerativeModel('gemini-2.5-flash-preview-05-20')

    prompt = f"""\
I am learning Traditional Mandarin with focus on Mandarin that is used in Taiwan.
Use TRADITIONAL Chinese characters (繁體中文) as used in Taiwan.
I want to you generate 10 sentences with characters I have learned already.

Here are traditional characters I learned so far: {CHARS}

Return ONLY a JSON object in this exact format:
{{
    "你好": "Hello!",
    "謝謝": "Thanks",
    "我很好": "I am fine",
    ...
}}
Make sentences longer, with variety of tenses, past, future, questions, because, therefore, after that, however, but, maybe, perhaps, possibly, if, then etc.
Sometimes include numbers, dates, time, to help me practice numbers too.
Make sure all Chinese text uses Traditional characters and the sentences are suitable for Taiwanese Mandarin learners.
Level of words should be at TOCFL 1 or HSK 2 level.
Do not use any other characters than ones that I have learned!

{"I want to focus on learning: " + SPECIAL_CHARS + " so include " + SPECIAL_CHARS + " more." if SPECIAL_CHARS and len(SPECIAL_CHARS) > 0 else""}
    """

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
            )
        )

        # Check if response has content
        if not response.candidates or not response.candidates[0].content.parts:
            print(f"No content returned. Finish reason: {response.candidates[0].finish_reason}")
            raise Exception("No content generated")

        # Extract the response content
        content = response.text.strip()

        # Clean up the response if it has markdown formatting
        if content.startswith('```json'):
            content = content.replace('```json', '').replace('```', '').strip()
        elif content.startswith('```'):
            content = content.replace('```', '').strip()

        # Parse JSON response
        sentences_dict = json.loads(content)

        return sentences_dict, prompt

    except Exception as e:
        print(f"Error calling API: {e}")
        return None, None


def taiwanese_tts(text, output_file="output.mp3", voice_name="cmn-TW-Standard-A", speaking_rate=0.6):
    """
    Convert text to speech using Taiwanese Mandarin voice

    Args:
        text (str): Text to convert (Traditional Chinese characters)
        output_file (str): Output audio file path
        voice_name (str): Voice to use (see available voices below)
    """

    # Initialize the client
    client = texttospeech.TextToSpeechClient()

    # Set the text input
    synthesis_input = texttospeech.SynthesisInput(text=text)

    # Build the voice request
    voice = texttospeech.VoiceSelectionParams(
        language_code="cmn-TW",  # Taiwanese Mandarin
        name=voice_name,
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE  # or MALE
    )

    # Select the type of audio file
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,  # Speed (0.25 to 4.0)
        pitch=0.0,          # Pitch (-20.0 to 20.0)
        volume_gain_db=0.0  # Volume (-96.0 to 16.0)
    )

    # Perform the text-to-speech request
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    # Write the response to an audio file
    with open(output_file, "wb") as out:
        out.write(response.audio_content)
        print(f'Output: "{output_file}"')


def main():
    setup_credentials()
    print("Generating Chinese sentences and audio files...")

    sentences_dict, prompt = get_chinese_sentences_and_translations()

    if not sentences_dict:
        print("Failed to get sentences from API")
        return

    print(f"Generated {len(sentences_dict)} Chinese sentences")

    # Create output directory if it doesn't exist
    output_dir = datetime.now().strftime("%Y-%m-%d-%H-%M")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Save JSON file
    json_filename = os.path.join(output_dir, "chinese_sentences.json")
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(sentences_dict, f, ensure_ascii=False, indent=2)
    print(f"JSON saved: {json_filename}")

    # Generate audio files for each sentence
    audio_files = []
    voice_name = "cmn-TW-Standard-C"
    speaking_rate = 0.6
    skipped_sentences = {}

    for i, (chinese, english) in enumerate(sentences_dict.items(), 1):
        print(f"\nProcessing {i}/{len(sentences_dict)}:")
        warning = False;
        for c in chinese:
            if c == "。" or c == "？" or c == "，" or c == "！":
                continue
            if c not in CHARS:
                skipped_sentences[chinese] = {"missing_char": c, "english":  english}
                print("warning, foreign char: " + c)
                warning = True
                break

        if warning:
            continue

        # Create filename (sanitize Chinese characters for filename)
        safe_filename = f"sentence_{i:02d}.mp3"
        audio_path = os.path.join(output_dir, safe_filename)

        # Generate TTS
        taiwanese_tts(chinese, audio_path, voice_name=voice_name, speaking_rate=speaking_rate)
        audio_files.append({
            "chinese": chinese,
            "english": english,
            "audio_file": safe_filename,
            "pinyin": ""  # You could add pinyin here if needed
        })

        # Small delay to be respectful to the TTS service
        time.sleep(0.5)

    # Save detailed output with audio file references
    detailed_output = {
        "voice_name": voice_name,
        "speaking_rate": speaking_rate,
        "sentences": sentences_dict,
        "audio_files": audio_files,
        "total_count": len(sentences_dict),
        "output_directory": output_dir,
        "skipped_sentences": skipped_sentences,
        "characters": CHARS,
        "focus_on_chars": SPECIAL_CHARS or "",
        "prompt": prompt,
    }

    detailed_filename = os.path.join(output_dir, "detailed_output.json")
    with open(detailed_filename, 'w', encoding='utf-8') as f:
        json.dump(detailed_output, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output_dir, "study.txt"), "w", encoding='utf-8') as f:
        f.write('\n' * 35)
        for file in audio_files:
            f.write(file["audio_file"] + "\n\n")
            f.write('\n'.join(x for x in file["chinese"]) + '\n\n')
            f.write(file["chinese"] + '\n\n')
            f.write(file["english"] + "\n\n")

    print(f"\n✅ (Complete!)")
    print(f"📁 Files saved in: {output_dir}/")
    print(f"📄 JSON: chinese_sentences.json")
    print(f"📄 TXT: study.txt")
    print(f"📄 Detailed: detailed_output.json")
    print(f"🔊 Audio files: {len(audio_files)} MP3 files")


def list_taiwanese_voices():
    """List all available Taiwanese Mandarin voices"""
    client = texttospeech.TextToSpeechClient()

    # Performs the list voices request
    voices = client.list_voices()

    print("List all available Taiwanese Mandarin voices:")
    for voice in voices.voices:
        if "cmn-TW" in voice.language_codes:
            print(f"voice name: {voice.name}")
            print(f"language code: {', '.join(voice.language_codes)}")
            print(f"gender: {voice.ssml_gender.name}")
            print(f"sample rate: {voice.natural_sample_rate_hertz}")
            print("-" * 40)

if __name__ == "__main__":
    main()
