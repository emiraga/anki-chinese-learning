#!/bin/sh

pushd utils/zhuyin
./fill_zhuyin_anki.py
popd

pushd utils/tts
./fill_audio_anki.py --use-pinyin-hint
popd

./utils/dong/download_images.py
./utils/dong/fill_dong_chinese.py
./utils/rtega/fill_rtega_mnemonics.py
