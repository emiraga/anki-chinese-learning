#!/bin/sh

set -x

./utils/hanzi/fill_hanzi_chars.py
./utils/hanzi/clean_notes.py
./utils/hanzi/connect_dots_notes.py
./utils/hanzi/fill_props_field.py

./utils/tocfl/get_from_csv.py

./utils/zhuyin/fill_zhuyin_anki.py

./utils/tts/fill_audio_anki.py --use-pinyin-hint

./utils/hanziyuan/convert.py

./utils/dong/augment_data.py
./utils/dong/download_images.py
./utils/dong/fill_dong_chinese.py

./utils/rtega/parse_rtega_html.py
./utils/rtega/fill_rtega_mnemonics.py

./utils/yellowbridge/convert.py
./utils/yellowbridge/fill_yellowbridge_chinese.py

./utils/hackchinese/convert.py
./utils/hackchinese/fill_hackchinese_outlier.py
./utils/hackchinese/fill_example_sentences.py
