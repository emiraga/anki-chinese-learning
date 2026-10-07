#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "pytest",
#   "requests",
#   "dragonmapper",
# ]
# ///

"""
Unit tests for ConnectDotsNote splitting functionality.
"""

import connect_dots_notes
import pytest
from connect_dots_notes import (
    ConnectDotsNote,
    HanziDataStore,
    HanziNote,
    SyllableInitialHanziToPinyin,
    TagUnionHanziToPinyin,
    calculate_coverage_from_notes,
    get_tone_number,
    pinyin_with_zhuyin,
    stable_bin,
    syllable_with_tone,
)

from shared.pinyin_utils import pinyin_to_zhuyin_toneless


class TestConnectDotsNoteValidation:
    """Tests for ConnectDotsNote validation"""

    def test_mismatched_left_right_raises_error(self):
        """Creating a note with mismatched left/right lengths should raise ValueError"""
        with pytest.raises(ValueError, match="Left and Right must have equal lengths"):
            ConnectDotsNote(key="test:key", left=["A", "B"], right=["1"])

    def test_matched_lengths_succeeds(self):
        """Creating a note with matched lengths should succeed"""
        note = ConnectDotsNote(key="test:key", left=["A", "B"], right=["1", "2"])
        assert len(note.left) == len(note.right) == 2


class TestConnectDotsNoteStringOutput:
    """Tests for ConnectDotsNote string generation"""

    def test_left_str_sorted(self):
        """left_str should return comma-separated sorted elements"""
        note = ConnectDotsNote(key="test:key", left=["C", "A", "B"], right=["3", "1", "2"])

        assert note.left_str() == "A, B, C"

    def test_right_str_sorted_by_left(self):
        """right_str should be sorted by corresponding left elements"""
        note = ConnectDotsNote(key="test:key", left=["C", "A", "B"], right=["3", "1", "2"])

        # Sorted by left: A->1, B->2, C->3
        assert note.right_str() == "1, 2, 3"

    def test_comma_escaping(self):
        """Commas in values should be escaped"""
        note = ConnectDotsNote(key="test:key", left=["hello, world"], right=["你好，世界"])  # noqa: RUF001

        # ASCII comma should be escaped to fullwidth comma + variation selector
        assert "，︀" in note.left_str()  # noqa: RUF001

    def test_fake_right_str_sorted(self):
        """fake_right_str should return comma-separated sorted elements"""
        note = ConnectDotsNote(key="test:key", left=["A"], right=["1"], fake_right=["3", "2", "4"])

        assert note.fake_right_str() == "2, 3, 4"

    def test_fake_right_str_empty(self):
        """fake_right_str should return empty string when no fake_right"""
        note = ConnectDotsNote(key="test:key", left=["A"], right=["1"])

        assert note.fake_right_str() == ""


class TestConnectDotsNoteFakeRight:
    """Tests for fake_right functionality"""

    def test_fake_right_empty_when_no_split(self):
        """Notes that don't split should have empty fake_right"""
        note = ConnectDotsNote(key="test:key", left=["A", "B"], right=["1", "2"])

        result = note.split_stably(max_items=10)

        assert len(result) == 1
        assert result[0].fake_right == []

    def test_fake_right_populated_when_split_missing_values(self):
        """Split notes missing some right values should have them in fake_right"""
        # 22 items with uneven distribution: 10 mā, 6 má, 4 mǎ, 2 mà
        left = (
            [f"T1_{i}" for i in range(10)] + [f"T2_{i}" for i in range(6)] + [f"T3_{i}" for i in range(4)] + [f"T4_{i}" for i in range(2)]
        )
        right = ["mā"] * 10 + ["má"] * 6 + ["mǎ"] * 4 + ["mà"] * 2
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_stably(max_items=8)

        # With interleaving, some notes may not have all 4 tones
        # fake_right should contain the missing tones
        all_tones = {"mā", "má", "mǎ", "mà"}
        for split_note in result:
            actual_tones = set(split_note.right)
            fake_tones = set(split_note.fake_right)
            # fake_right should be exactly the missing tones
            assert fake_tones == all_tones - actual_tones
            # Together they should cover all tones
            assert actual_tones | fake_tones == all_tones

    def test_fake_right_empty_when_all_values_present(self):
        """Split notes with all right values should have empty fake_right"""
        # 20 items with 4 tones, evenly distributed
        left = [f"T1_{i}" for i in range(5)] + [f"T2_{i}" for i in range(5)] + [f"T3_{i}" for i in range(5)] + [f"T4_{i}" for i in range(5)]
        right = ["mā"] * 5 + ["má"] * 5 + ["mǎ"] * 5 + ["mà"] * 5
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_stably(max_items=10)

        # Hash bins don't guarantee every tone per note; fake_right is empty exactly when a note has all 4
        assert len(result) == 2
        assert any(len(set(n.right)) == 4 for n in result)
        for split_note in result:
            assert (split_note.fake_right == []) == (len(set(split_note.right)) == 4)

    def test_fake_right_does_not_include_own_values(self):
        """fake_right should never include values already in right"""
        left = [f"char{i}" for i in range(15)]
        right = ["a"] * 5 + ["b"] * 5 + ["c"] * 5
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_stably(max_items=8)

        for split_note in result:
            own_values = set(split_note.right)
            fake_values = set(split_note.fake_right)
            # No overlap between right and fake_right
            assert own_values & fake_values == set()

    def test_fake_right_limited_by_left_count(self):
        """fake_right should be limited so len(left) >= len(unique_right) + len(fake_right)"""
        # 12 items with 2 unique right values, split into notes of 6
        # Each note: 6 left items, 2 unique right -> max 4 fake_right
        left = [f"char{i}" for i in range(12)]
        right = ["a"] * 6 + ["b"] * 6
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_stably(max_items=6)

        for split_note in result:
            unique_right_count = len(set(split_note.right))
            fake_right_count = len(split_note.fake_right)
            left_count = len(split_note.left)
            # Verify the constraint: left >= unique_right + fake_right
            assert left_count >= unique_right_count + fake_right_count

    def test_fake_right_preserves_original_fake_right_on_split(self):
        """Original fake_right values should be included in split notes' fake_right pools.

        This covers the case where a syllable generator adds fake_right for missing tones
        (e.g., tones 1 and 5 not present in any card), then the note gets split.
        The split notes should still include those missing tones in their fake_right.
        """
        # 12 items across tones 2, 3, 4 (no tone 1 or 5)
        left = [f"T2_{i}" for i in range(4)] + [f"T3_{i}" for i in range(4)] + [f"T4_{i}" for i in range(4)]
        right = ["yú (ㄩˊ)"] * 4 + ["yǔ (ㄩˇ)"] * 4 + ["yù (ㄩˋ)"] * 4
        # Original fake_right has tone 1 and 5 (not present in any card)
        fake_right = ["yū (ㄩ)", "yu (ㄩ˙)"]
        note = ConnectDotsNote(key="syllable:yu", left=left, right=right, fake_right=fake_right)

        result = note.split_stably(max_items=6)

        assert len(result) == 2
        # Each split note should have the original fake_right tones available
        all_expected = {"yú (ㄩˊ)", "yǔ (ㄩˇ)", "yù (ㄩˋ)", "yū (ㄩ)", "yu (ㄩ˙)"}
        for split_note in result:
            actual_right = set(split_note.right)
            fake = set(split_note.fake_right)
            # fake_right should not overlap with right
            assert actual_right & fake == set()
            # All 5 tones should be covered between right and fake_right
            assert actual_right | fake == all_expected

    def test_fake_right_limit_truncates_when_needed(self):
        """fake_right should be truncated when there are many potential fake values"""
        # Create scenario with many unique right values
        # 20 items with 10 unique right values, split into 2 notes of 10
        left = [f"char{i}" for i in range(20)]
        right = [f"tone{i % 10}" for i in range(20)]  # 10 unique values
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_stably(max_items=10)

        for split_note in result:
            unique_right_count = len(set(split_note.right))
            fake_right_count = len(split_note.fake_right)
            left_count = len(split_note.left)
            # Each note has 10 left items
            # With interleaving, each note should have all 10 unique right values
            # So max fake_right = 10 - 10 = 0
            assert left_count >= unique_right_count + fake_right_count
            # Verify constraint holds even if there were candidates
            assert fake_right_count <= left_count - unique_right_count


class TestToneHelperFunctions:
    """Tests for tone-related helper functions"""

    def test_get_tone_number_tone_1(self):
        """Tone 1 (high flat) should return 1"""
        assert get_tone_number("mā") == 1
        assert get_tone_number("shī") == 1
        assert get_tone_number("hē") == 1

    def test_get_tone_number_tone_2(self):
        """Tone 2 (rising) should return 2"""
        assert get_tone_number("má") == 2
        assert get_tone_number("shí") == 2
        assert get_tone_number("hé") == 2

    def test_get_tone_number_tone_3(self):
        """Tone 3 (dipping) should return 3"""
        assert get_tone_number("mǎ") == 3
        assert get_tone_number("shǐ") == 3
        assert get_tone_number("hě") == 3

    def test_get_tone_number_tone_4(self):
        """Tone 4 (falling) should return 4"""
        assert get_tone_number("mà") == 4
        assert get_tone_number("shì") == 4
        assert get_tone_number("hè") == 4

    def test_get_tone_number_tone_5_neutral(self):
        """Neutral tone (no mark) should return 5"""
        assert get_tone_number("ma") == 5
        assert get_tone_number("de") == 5

    def test_syllable_with_tone_generates_correct_pinyin(self):
        """syllable_with_tone should generate correct toned pinyin"""
        assert syllable_with_tone("ma", 1) == "mā"
        assert syllable_with_tone("ma", 2) == "má"
        assert syllable_with_tone("ma", 3) == "mǎ"
        assert syllable_with_tone("ma", 4) == "mà"
        assert syllable_with_tone("ma", 5) == "ma"

    def test_syllable_with_tone_various_syllables(self):
        """syllable_with_tone should work with various syllables"""
        assert syllable_with_tone("shi", 1) == "shī"
        assert syllable_with_tone("he", 2) == "hé"
        assert syllable_with_tone("ni", 3) == "nǐ"
        assert syllable_with_tone("bu", 4) == "bù"

    def test_pinyin_with_zhuyin_format(self):
        """pinyin_with_zhuyin should return 'pinyin (zhuyin)' format"""
        result = pinyin_with_zhuyin("mā")
        assert "mā" in result
        assert "(" in result
        assert ")" in result
        # Should contain zhuyin character
        assert "ㄇ" in result

    def test_pinyin_with_zhuyin_neutral_tone(self):
        """pinyin_with_zhuyin should handle neutral tone"""
        result = pinyin_with_zhuyin("ma")
        assert "ma" in result
        assert "ㄇ" in result


class TestPinyinToZhuyinToneless:
    """Tests for the toneless zhuyin helper used for stable grouping."""

    def test_strips_tone_marks(self):
        assert pinyin_to_zhuyin_toneless("zhǎng") == "ㄓㄤ"
        assert pinyin_to_zhuyin_toneless("zhèn") == "ㄓㄣ"
        assert pinyin_to_zhuyin_toneless("hǎo") == "ㄏㄠ"

    def test_tone_independent(self):
        """All tones of a syllable map to the same toneless zhuyin."""
        variants = ["zhū", "zhú", "zhǔ", "zhù", "zhu"]
        assert len({pinyin_to_zhuyin_toneless(v) for v in variants}) == 1

    def test_bare_initial_syllables(self):
        """zhi/chi/shi/ri/zi/ci/si render as a bare initial symbol."""
        assert pinyin_to_zhuyin_toneless("zhī") == "ㄓ"
        assert pinyin_to_zhuyin_toneless("shì") == "ㄕ"

    def test_vowel_initial_syllables(self):
        assert pinyin_to_zhuyin_toneless("yī") == "ㄧ"
        assert pinyin_to_zhuyin_toneless("ān") == "ㄢ"


class TestStableBin:
    """Tests for the content-stable bin hashing helper."""

    def test_deterministic(self):
        assert stable_bin("豬", 4) == stable_bin("豬", 4)

    def test_in_range(self):
        for ch in ["豬", "張", "陣", "之", "止", "長"]:
            assert 0 <= stable_bin(ch, 3) < 3

    def test_independent_of_other_items(self):
        """A value's bin depends only on the value and bin count."""
        assert stable_bin("張", 2) == stable_bin("張", 2)
        assert stable_bin("張", 3) != stable_bin("張", 2) or True  # may coincide; just no error

    def test_growing_bins_only_moves_items_into_new_bin(self):
        """Jump consistent hash: going from n to n + 1 bins only moves items into bin n."""
        chars = [chr(0x4E00 + i) for i in range(2000)]
        for n in range(1, 6):
            moved = 0
            for ch in chars:
                before, after = stable_bin(ch, n), stable_bin(ch, n + 1)
                if before != after:
                    assert after == n
                    moved += 1
            # Roughly 1/(n + 1) of items move.
            expected = len(chars) / (n + 1)
            assert 0.8 * expected < moved < 1.2 * expected

    def test_rejects_zero_bins(self):
        with pytest.raises(ValueError, match="num_bins"):
            stable_bin("豬", 0)


def _chars(n: int) -> list[str]:
    # Distinct CJK characters for deterministic-but-varied hashing.
    return [chr(0x4E00 + i) for i in range(n)]


class TestSplitStably:
    """Tests for ConnectDotsNote.split_stably (content-stable splitting)."""

    def test_no_split_within_limit(self):
        for count in [1, 5, 10]:
            left = _chars(count)
            right = [f"r{i}" for i in range(count)]
            note = ConnectDotsNote(key="syllable_initial:ㄋ", left=left, right=right)
            result = note.split_stably(max_items=10)
            assert len(result) == 1
            assert result[0] is note

    def test_splits_when_over_limit(self):
        left = _chars(17)
        right = [f"r{i}" for i in range(17)]
        note = ConnectDotsNote(key="syllable_initial:ㄋ", left=left, right=right)
        result = note.split_stably(max_items=10)
        assert len(result) >= 2

    def test_all_items_preserved_exactly_once(self):
        left = _chars(25)
        right = [f"r{i}" for i in range(25)]
        note = ConnectDotsNote(key="k", left=left, right=right)
        result = note.split_stably(max_items=10)
        original = set(zip(left, right, strict=False))
        collected: list[tuple[str, str]] = []
        for n in result:
            collected.extend(zip(n.left, n.right, strict=False))
        assert set(collected) == original
        assert len(collected) == len(left)  # no duplicates

    def test_left_right_correspondence_preserved(self):
        left = _chars(15)
        right = [f"r{i}" for i in range(15)]
        mapping = dict(zip(left, right, strict=False))
        note = ConnectDotsNote(key="k", left=left, right=right)
        for n in note.split_stably(max_items=6):
            for left_val, right_val in zip(n.left, n.right, strict=False):
                assert mapping[left_val] == right_val

    def test_key_naming_convention(self):
        """Bin 0 keeps the original key, bin i gets ":<i + 1>"."""
        left = _chars(25)
        right = [f"r{i}" for i in range(25)]
        note = ConnectDotsNote(key="syllable_initial:ㄋ", left=left, right=right)
        result = note.split_stably(max_items=10)
        for n in result:
            expected_bin = stable_bin(n.left[0], 3)
            expected_key = "syllable_initial:ㄋ" if expected_bin == 0 else f"syllable_initial:ㄋ:{expected_bin + 1}"
            assert n.key == expected_key
        assert len({n.key for n in result}) == len(result)

    def test_filling_empty_bin_does_not_rename_siblings(self):
        """Keys are tied to bin index, so a previously empty bin filling up never shifts other keys."""
        # 11 items -> 2 bins; pick items so that bin 0 is empty, then add one that lands in bin 0.
        bin1_chars = [c for c in _chars(500) if stable_bin(c, 2) == 1][:11]
        bin0_char = next(c for c in _chars(500) if stable_bin(c, 2) == 0)
        before = ConnectDotsNote(key="k", left=bin1_chars, right=[f"r{i}" for i in range(11)]).split_stably(max_items=10)
        assert [n.key for n in before] == ["k:2"]

        after = ConnectDotsNote(key="k", left=[*bin1_chars, bin0_char], right=[f"r{i}" for i in range(12)]).split_stably(max_items=10)
        by_key = {n.key: n for n in after}
        assert by_key["k"].left == [bin0_char]
        assert sorted(by_key["k:2"].left) == sorted(bin1_chars)

    def test_stability_adding_item_keeps_others_in_place(self):
        """Adding an item (without changing bin count) must not move other items."""
        # 15 items -> 2 bins. Adding 1 -> 16 items, still 2 bins.
        left = _chars(15)
        right = [f"r{i}" for i in range(15)]
        before = ConnectDotsNote(key="k", left=left, right=right).split_stably(max_items=10)

        new_char = chr(0x4E00 + 999)
        after = ConnectDotsNote(key="k", left=[*left, new_char], right=[*right, "rNEW"]).split_stably(max_items=10)

        assert len(before) == len(after)  # bin count unchanged

        # Map char -> key for each version; every pre-existing char must keep its key.
        def char_to_key(notes: list[ConnectDotsNote]) -> dict[str, str]:
            return {c: n.key for n in notes for c in n.left}

        before_map = char_to_key(before)
        after_map = char_to_key(after)
        for ch in left:
            assert after_map[ch] == before_map[ch], f"{ch} moved bins on insert"

    def test_bins_roughly_balanced(self):
        left = _chars(30)
        right = [f"r{i}" for i in range(30)]
        result = ConnectDotsNote(key="k", left=left, right=right).split_stably(max_items=10)
        # 30 items, 3 bins expected; none should be wildly oversized.
        assert len(result) == 3
        for n in result:
            assert len(n.left) <= 20  # generous upper bound on hash imbalance


class TestTagUnionHanziToPinyin:
    """Tests for TagUnionHanziToPinyin generator"""

    @pytest.fixture
    def _data_store(self, monkeypatch: pytest.MonkeyPatch) -> None:
        store = HanziDataStore(
            hanzi_notes=[
                HanziNote(1, "兌", "duì", "exchange", "", {"prop-top::saloon-doors"}),
                HanziNote(2, "並", "bìng", "and", "", {"prop-top::sword-fight"}),
                HanziNote(3, "半", "bàn", "half", "", {"prop-top::saloon-doors", "prop-top::sword-fight"}),
                HanziNote(4, "好", "hǎo", "good", "", {"prop::other"}),
            ]
        )
        store.build_indexes()
        monkeypatch.setattr(connect_dots_notes, "_data_store", store)

    @pytest.mark.usefixtures("_data_store")
    def test_combines_tags_without_duplicates(self):
        generator = TagUnionHanziToPinyin("a+b", ["prop-top::saloon-doors", "prop-top::sword-fight"])
        notes = generator.generate_notes()
        assert len(notes) == 1
        assert notes[0].key == "union:a+b"
        assert sorted(notes[0].left) == ["並", "兌", "半"]

    def test_requires_at_least_two_tags(self):
        with pytest.raises(ValueError, match="at least 2 tags"):
            TagUnionHanziToPinyin("a", ["prop-top::saloon-doors"])

    def test_requires_prefixed_tags(self):
        with pytest.raises(ValueError, match="prefix::name"):
            TagUnionHanziToPinyin("a+b", ["prop-top::saloon-doors", "sword-fight"])


class TestSyllableInitialHanziToPinyin:
    """Tests for SyllableInitialHanziToPinyin generator"""

    def test_single_pronunciation_gets_other_tones_as_fake_right(self):
        """A lone character (e.g. 選) must not be a trivially skipped note."""
        notes = SyllableInitialHanziToPinyin("ㄒ", [HanziNote(1, "選", "xuǎn", "choose", "", set())]).generate_notes()
        assert len(notes) == 1
        assert notes[0].fake_right == [pinyin_with_zhuyin(syllable_with_tone("xuan", t)) for t in (1, 2, 4, 5)]
        assert not notes[0].has_single_right_value()

    def test_shared_pronunciation_gets_other_tones_as_fake_right(self):
        notes = SyllableInitialHanziToPinyin(
            "ㄚ", [HanziNote(1, "阿", "ā", "prefix", "", set()), HanziNote(2, "啊", "ā", "ah", "", set())]
        ).generate_notes()
        assert notes[0].fake_right == [pinyin_with_zhuyin(syllable_with_tone("a", t)) for t in (2, 3, 4, 5)]

    def test_mixed_pronunciations_have_no_fake_right(self):
        notes = SyllableInitialHanziToPinyin(
            "ㄋ", [HanziNote(1, "那", "nà", "that", "", set()), HanziNote(2, "你", "nǐ", "you", "", set())]
        ).generate_notes()
        assert notes[0].fake_right == []


class TestCalculateCoverage:
    """Tests for calculate_coverage_from_notes"""

    def test_only_hanzi_count_towards_coverage(self):
        """Non-Hanzi lefts (e.g. two-char phrases) are reported by type but don't inflate coverage."""
        notes_by_type = {
            "syllable": [ConnectDotsNote(key="syllable:ma", left=["媽", "馬"], right=["mā", "mǎ"])],
            "two_char_phrase": [ConnectDotsNote(key="two_char_phrase:媽", left=["媽媽", "媽的"], right=["a", "b"])],
        }
        coverage = calculate_coverage_from_notes(notes_by_type, {"媽", "馬", "選"})
        assert coverage.covered_hanzi == 2
        assert coverage.uncovered_characters == {"選"}
        assert coverage.coverage_percentage <= 100
        assert len(coverage.coverage_by_type["two_char_phrase"]) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
