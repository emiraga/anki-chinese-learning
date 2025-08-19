#!/bin/sh

pushd utils/zhuyin
source venv/bin/activate
python3 fill_zhuyin_anki.py
popd

pushd utils/tts
source venv/bin/activate
python3 fill_audio_anki.py
popd
