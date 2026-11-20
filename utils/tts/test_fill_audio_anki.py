#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pytest",
#   "requests",
#   "dragonmapper",
#   "google.cloud.texttospeech",
# ]
# ///

"""
Unit tests for checking a Gemini TTS transcript against the text it was meant to say.
"""

import sys

import pytest
from fill_audio_anki import says_text

# Transcripts come with full-width Chinese punctuation.
COMMA = "\uff0c"
EXCLAMATION = "\uff01"


class TestSaysText:
    def test_exact(self):
        assert says_text("這是一個很大的負擔。", "這是一個很大的負擔")

    def test_ignores_punctuation_and_pinyin(self):
        assert says_text(f"我要還書{EXCLAMATION}", "我要還(huán)書")

    @pytest.mark.parametrize("filler", ["欸", "啊", "啦", "喔", "耶", "嗯", "呀啊"])
    def test_allows_trailing_filler(self, filler: str):
        assert says_text(f"這是一個很大的負擔{filler}", "這是一個很大的負擔")

    def test_allows_leading_hesitation(self):
        assert says_text(f"嗯{COMMA}這是一個很大的負擔", "這是一個很大的負擔")

    def test_allows_leading_and_trailing(self):
        assert says_text(f"嗯{COMMA}這是一個很大的負擔欸", "這是一個很大的負擔")

    @pytest.mark.parametrize("particle", ["嗎", "吧", "了", "囉", "呢", "嘛", "的"])
    def test_rejects_meaning_changing_particle(self, particle: str):
        assert not says_text(f"他們來學校參觀{particle}", "他們來學校參觀")

    def test_rejects_too_many_trailing_fillers(self):
        assert not says_text("他們來學校參觀啊啊啊", "他們來學校參觀")

    def test_rejects_filler_not_allowed_at_start(self):
        assert not says_text(f"啊{COMMA}他們來學校參觀", "他們來學校參觀")

    def test_rejects_changed_word(self):
        assert not says_text("沒有咖啡了我就要喝茶", "沒有咖啡了我只好喝茶")

    def test_rejects_added_word_mid_sentence(self):
        assert not says_text("我真的是受得了這種天氣", "我真的受得了這種天氣")

    def test_rejects_dropped_particle_of_text(self):
        assert not says_text("你好", "你好啊")

    def test_rejects_garbled_start(self):
        assert not says_text("倒是你沒有咖啡了我只好喝茶", "沒有咖啡了我只好喝茶")

    def test_text_starting_with_leading_filler(self):
        # Read from the start, 嗯 嗯啊啊 has three trailing fillers; read as a
        # leading 嗯 before the text, it has two.
        assert says_text("嗯嗯啊啊", "嗯")

    def test_rejects_too_long_leading(self):
        assert not says_text("嗯欸他們來學校參觀", "他們來學校參觀")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
