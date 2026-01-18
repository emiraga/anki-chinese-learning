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

    def test_splitting_respects_sorted_order(self):
        """Items should be split based on sorted order of left elements"""
        # Provide unsorted input
        left = ["Z", "A", "M", "B", "Y", "C", "X", "D", "W", "E", "V", "F"]
        right = ["z", "a", "m", "b", "y", "c", "x", "d", "w", "e", "v", "f"]
        note = ConnectDotsNote(key="test:key", left=left, right=right)

        result = note.split_if_needed(max_items=10)

        # First note should have alphabetically earlier characters
        # After sorting: A, B, C, D, E, F, M, V, W, X, Y, Z
        # Split into 6 and 6: [A,B,C,D,E,F] and [M,V,W,X,Y,Z]
        assert len(result) == 2
        assert sorted(result[0].left) == result[0].left  # Already sorted within note
        assert sorted(result[1].left) == result[1].left
        # First note should have "earlier" letters
        assert max(result[0].left) < min(result[1].left)

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
