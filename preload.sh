#!/bin/sh

./utils/rtega/preload_missing_chars.py
./utils/dong/preload_missing_chars.py --limit 50
./utils/yellowbridge/preload_missing_chars.py --max-chars 50
./utils/hanziyuan/preload_missing_chars.py --skip-folders --max-chars 50
