#!/bin/sh

pushd utils/zhuyin
./fill_zhuyin_anki.py
popd

pushd utils/tts
./fill_audio_anki.py --use-pinyin-hint
popd

./utils/hanzi/fill_hanzi_notes.py
./utils/props/fill_props_field.py
./utils/dong/translate.py
./utils/dong/download_images.py
./utils/dong/fill_dong_chinese.py
./utils/rtega/parse_rtega_html.py
./utils/rtega/fill_rtega_mnemonics.py
./utils/yellowbridge/convert.py
./utils/yellowbridge/fill_yellowbridge_chinese.py
