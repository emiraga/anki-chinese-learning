#!/bin/sh

set -x
set -e

./utils/hanzi/fill_hanzi_chars.py
./utils/hanzi/process_simplified_cards.py
./utils/hanzi/connect_dots_notes.py

./utils/hanzi/fill_props_field.py
./utils/hanzi/fill_connections_field.py --limit 40

./utils/zhuyin/fill_zhuyin_anki.py

./utils/tts/fill_audio_anki.py --use-pinyin-hint

./utils/video/augment_translation.py
./utils/video/fill_trimmed_audio.py --audio-preset speech
./utils/sync_ankiweb.py
