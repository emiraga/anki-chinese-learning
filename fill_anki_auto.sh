#!/bin/sh

pushd utils/zhuyin
./fill_zhuyin_anki.py
popd

pushd utils/tts
./fill_audio_anki.py --use-pinyin-hint
popd
