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

import pytest
from connect_dots_notes import ConnectDotsNote


class TestConnectDotsNoteSplitting:
    """Tests for ConnectDotsNote.split_if_needed method"""

    def test_no_split_when_10_or_fewer_items(self):
        """Notes with 10 or fewer items should not be split"""
        for count in [1, 5, 10]:
            left = [f"char{i}" for i in range(count)]
            right = [f"pinyin{i}" for i in range(count)]
            note = ConnectDotsNote(key="test:key", left=left, right=right)

            result = note.split_if_needed(max_items=10)

            assert len(result) == 1
            assert result[0] is note  # Should return the same object

    def test_split_11_items_into_two_notes(self):
        """11 items should split into 6 and 5"""
        left = [f"char{i}" for i in range(11)]
        right = [f"pinyin{i}" for i in range(11)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 2
        assert len(result[0].left) == 6
        assert len(result[1].left) == 5

    def test_split_12_items_into_two_equal_notes(self):
        """12 items should split into 6 and 6"""
        left = [f"char{i}" for i in range(12)]
        right = [f"pinyin{i}" for i in range(12)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 2
        assert len(result[0].left) == 6
        assert len(result[1].left) == 6

    def test_split_21_items_into_three_notes(self):
        """21 items should split into 7, 7, 7"""
        left = [f"char{i}" for i in range(21)]
        right = [f"pinyin{i}" for i in range(21)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 3
        assert len(result[0].left) == 7
        assert len(result[1].left) == 7
        assert len(result[2].left) == 7

    def test_split_25_items_into_three_notes(self):
        """25 items should split into 9, 8, 8"""
        left = [f"char{i}" for i in range(25)]
        right = [f"pinyin{i}" for i in range(25)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 3
        assert len(result[0].left) == 9
        assert len(result[1].left) == 8
        assert len(result[2].left) == 8

    def test_key_naming_convention(self):
        """First note keeps original key, others get :2, :3, etc."""
        left = [f"char{i}" for i in range(25)]
        right = [f"pinyin{i}" for i in range(25)]
        note = ConnectDotsNote(key="sound_component:青", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert result[0].key == "sound_component:青"
        assert result[1].key == "sound_component:青:2"
        assert result[2].key == "sound_component:青:3"

    def test_all_items_preserved_exactly_once(self):
        """All original items should appear exactly once across all split notes"""
        left = [f"char{i}" for i in range(37)]
        right = [f"pinyin{i}" for i in range(37)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        # Collect all items from split notes
        all_left = []
        all_right = []
        for split_note in result:
            all_left.extend(split_note.left)
            all_right.extend(split_note.right)

        # Original note sorts pairs, so we need to compare sorted versions
        original_pairs = set(zip(left, right))
        result_pairs = set(zip(all_left, all_right))

        assert original_pairs == result_pairs
        assert len(all_left) == len(left)  # No duplicates

    def test_left_right_correspondence_preserved(self):
        """Left-right pairs should remain matched after splitting"""
        # Use distinct mappings to verify correspondence
        left = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
        right = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]
        original_pairs = dict(zip(left, right))
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        # Verify each pair in split notes matches original mapping
        for split_note in result:
            for l, r in zip(split_note.left, split_note.right):
                assert original_pairs[l] == r

    def test_interleaved_distribution_maximizes_diversity(self):
        """Items should be distributed to maximize right value diversity in each note"""
        # 20 items with 4 distinct right values (5 each)
        left = [f"T1_{i}" for i in range(5)] + [f"T2_{i}" for i in range(5)] + \
               [f"T3_{i}" for i in range(5)] + [f"T4_{i}" for i in range(5)]
        right = ["mā"] * 5 + ["má"] * 5 + ["mǎ"] * 5 + ["mà"] * 5
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 2
        # Both notes should have all 4 tones represented
        for split_note in result:
            unique_tones = set(split_note.right)
            assert len(unique_tones) == 4, f"Expected 4 tones, got {unique_tones}"

    def test_sorted_by_right_then_left(self):
        """Items should be sorted by (right, left) before interleaving"""
        left = ["B", "A", "D", "C"]
        right = ["2", "1", "2", "1"]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=2)

        # Sorted by (right, left): (1,A), (1,C), (2,B), (2,D)
        # Interleaved: note0 gets (1,A), (2,B); note1 gets (1,C), (2,D)
        assert len(result) == 2
        # Both notes should have both right values
        assert set(result[0].right) == {"1", "2"}
        assert set(result[1].right) == {"1", "2"}

    def test_custom_max_items(self):
        """split_if_needed should respect custom max_items parameter"""
        left = [f"char{i}" for i in range(10)]
        right = [f"pinyin{i}" for i in range(10)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        # With max_items=5, should split 10 items into 5 and 5
        result = note.split_if_needed(max_items=5)

        assert len(result) == 2
        assert len(result[0].left) == 5
        assert len(result[1].left) == 5

    def test_single_item_no_split(self):
        """Single item notes should not be split"""
        note = ConnectDotsNote(key="test:key", left=["A"], right=["1"])

        result = note.split_if_needed(max_items=10)

        assert len(result) == 1
        assert result[0] is note

    def test_empty_note_no_split(self):
        """Empty notes should not be split (edge case)"""
        note = ConnectDotsNote(key="test:key", left=[], right=[])

        result = note.split_if_needed(max_items=10)

        assert len(result) == 1
        assert result[0] is note

    def test_exact_boundary_no_split(self):
        """Exactly max_items should not trigger a split"""
        left = [f"char{i}" for i in range(10)]
        right = [f"pinyin{i}" for i in range(10)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 1
        assert result[0] is note

    def test_one_over_boundary_splits(self):
        """max_items + 1 should trigger a split"""
        left = [f"char{i}" for i in range(11)]
        right = [f"pinyin{i}" for i in range(11)]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        assert len(result) == 2


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
        note = ConnectDotsNote(
            key="test:key",
            left=["hello, world"],
            right=["你好，世界"]
        )

        # ASCII comma should be escaped to fullwidth comma + variation selector
        assert "，︀" in note.left_str()

    def test_fake_right_str_sorted(self):
        """fake_right_str should return comma-separated sorted elements"""
        note = ConnectDotsNote(
            key="test:key",
            left=["A"],
            right=["1"],
            fake_right=["3", "2", "4"]
        )

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

        result = note.split_if_needed(max_items=10)

        assert len(result) == 1
        assert result[0].fake_right == []

    def test_fake_right_populated_when_split_missing_values(self):
        """Split notes missing some right values should have them in fake_right"""
        # 22 items with uneven distribution: 10 mā, 6 má, 4 mǎ, 2 mà
        left = [f"T1_{i}" for i in range(10)] + [f"T2_{i}" for i in range(6)] + \
               [f"T3_{i}" for i in range(4)] + [f"T4_{i}" for i in range(2)]
        right = ["mā"] * 10 + ["má"] * 6 + ["mǎ"] * 4 + ["mà"] * 2
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=8)

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
        left = [f"T1_{i}" for i in range(5)] + [f"T2_{i}" for i in range(5)] + \
               [f"T3_{i}" for i in range(5)] + [f"T4_{i}" for i in range(5)]
        right = ["mā"] * 5 + ["má"] * 5 + ["mǎ"] * 5 + ["mà"] * 5
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        # Both notes should have all 4 tones, so fake_right should be empty
        for split_note in result:
            assert len(set(split_note.right)) == 4
            assert split_note.fake_right == []

    def test_fake_right_does_not_include_own_values(self):
        """fake_right should never include values already in right"""
        left = [f"char{i}" for i in range(15)]
        right = ["a"] * 5 + ["b"] * 5 + ["c"] * 5
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=8)

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

        result = note.split_if_needed(max_items=6)

        for split_note in result:
            unique_right_count = len(set(split_note.right))
            fake_right_count = len(split_note.fake_right)
            left_count = len(split_note.left)
            # Verify the constraint: left >= unique_right + fake_right
            assert left_count >= unique_right_count + fake_right_count

    def test_fake_right_limit_truncates_when_needed(self):
        """fake_right should be truncated when there are many potential fake values"""
        # Create scenario with many unique right values
        # 20 items with 10 unique right values, split into 2 notes of 10
        left = [f"char{i}" for i in range(20)]
        right = [f"tone{i % 10}" for i in range(20)]  # 10 unique values
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
