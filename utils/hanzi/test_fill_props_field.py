#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pytest",
#   "requests",
#   "dragonmapper",
#   "google-genai",
#   "google-cloud-translate>=3.15.0",
# ]
# ///

"""
Unit tests for the cloze sentence helpers in fill_props_field.
"""

import pytest
from fill_props_field import find_repeated_word_characters, strip_cloze_hints, strip_cloze_markup, validate_cloze_sentence


class TestStripCloze:
    def test_strip_markup_keeps_answer(self):
        assert strip_cloze_markup("今天好{{c1::熱::hot}}{{c1::熱}}死了。") == "今天好熱熱死了。"

    def test_strip_hints_keeps_cloze(self):
        assert strip_cloze_hints("我很{{c1::聰明::smart}}你也很{{c1::聰明}}。") == "我很{{c1::聰明}}你也很{{c1::聰明}}。"


class TestValidateClozeSentence:
    def test_valid_cloze(self):
        assert validate_cloze_sentence("只要在紅茶裡加一點牛奶就變成好喝的{{c1::奶茶}}了。", "奶茶") == ""

    def test_valid_cloze_with_hint(self):
        assert validate_cloze_sentence("我喜歡喝{{c1::烏龍茶::oolong tea}}。", "烏龍茶") == ""

    def test_repeated_cloze(self):
        assert validate_cloze_sentence("這些點心{{c1::夠}}不{{c1::夠}}。", "夠") == ""

    def test_separable_word(self):
        assert validate_cloze_sentence("他{{c1::看}}了兩次{{c1::病}}了。", "看病") == ""

    def test_missing_cloze(self):
        assert "no {{c1::...}} cloze" in validate_cloze_sentence("我喜歡喝奶茶。", "奶茶")

    def test_wrong_answer(self):
        assert "not the word" in validate_cloze_sentence("我喜歡喝{{c1::紅茶}}。", "奶茶")

    def test_malformed_markup(self):
        assert "malformed" in validate_cloze_sentence("我喜歡喝{{c1::奶茶}}和{{c1::綠茶。", "奶茶")

    def test_non_chinese_script(self):
        assert "Japanese or Korean" in validate_cloze_sentence("我喜歡喝{{c1::奶茶}}。ふふ", "奶茶")


class TestFindRepeatedWordCharacters:
    def test_no_repetition(self):
        assert find_repeated_word_characters("小孩掉進水裡大喊「{{c1::救命}}」。", "救命") == set()

    def test_repeated_character(self):
        assert find_repeated_word_characters("救生員聽到有人喊「{{c1::救命}}」。", "救命") == {"救"}

    def test_separable_word(self):
        assert find_repeated_word_characters("他{{c1::看}}了兩次{{c1::病}}還是生病。", "看病") == {"病"}

    def test_hint_is_ignored(self):
        assert find_repeated_word_characters("我喜歡喝{{c1::奶茶::milk tea}}。", "奶茶") == set()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
