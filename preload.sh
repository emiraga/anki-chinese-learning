#!/bin/sh

./utils/rtega/preload_missing_chars.py
./utils/dong/preload_missing_chars.py --limit 20
./utils/yellowbridge/preload_missing_chars.py --max-chars 20
