#!/bin/sh

set -x
set -e

./utils/hanzi/clean_notes.py
## ./utils/hanzi/suspend_listening_cards.py
./anki/connect-dots/deploy.py

./utils/tocfl/get_from_csv.py

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
./utils/sync_ankiweb.py
