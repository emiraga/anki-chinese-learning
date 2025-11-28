#!/bin/sh

set -x

./utils/hanzi/fill_hanzi_notes.py

pushd utils/zhuyin
./fill_zhuyin_anki.py
popd

pushd utils/tts
./fill_audio_anki.py --use-pinyin-hint
popd

./utils/props/fill_props_field.py
./utils/hanziyuan/convert.py
./utils/dong/augment_data.py
./utils/dong/download_images.py
./utils/dong/fill_dong_chinese.py
./utils/rtega/parse_rtega_html.py
./utils/rtega/fill_rtega_mnemonics.py
./utils/yellowbridge/convert.py
./utils/yellowbridge/fill_yellowbridge_chinese.py
./utils/hackchinese/convert.py
