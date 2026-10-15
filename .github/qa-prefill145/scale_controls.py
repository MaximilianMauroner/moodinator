"""Pure cold-byte oracle controls; no emulator/process/device operations."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('acceptance_r13', Path(__file__).with_name('acceptance.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


def row(identity, mood, scale):
    return dict(zip(a.FIELDS, [identity, mood, " \tQA fabricated\nexact  ", 123400 + identity,
                              '[{"name":"Happy","category":"positive","energy":"high"}]',
                              '["Work"]', 0, scale, -60, None]))


def with_hex(value):
    return dict(value, note_hex=value['note'].encode().hex().upper())


class ScaleOracleControls(unittest.TestCase):
    def setUp(self):
        self.acceptance = object.__new__(a.Acceptance)

    def test_v2_best_into_v1_requires_zero_and_exact_fields(self):
        source = row(1, 10, a.LEGACY_SCALE)
        target = row(2, 5, a.SCALE)
        saved = with_hex(dict(target, mood=0, based_on_entry_id=1))
        self.acceptance.assert_copy([saved], target, source, expected_mood=0)
        with self.assertRaisesRegex(RuntimeError, 'mood'):
            self.acceptance.assert_copy([dict(saved, mood=10)], target, source, expected_mood=0)
        with self.assertRaisesRegex(RuntimeError, 'mood_scale_json'):
            self.acceptance.assert_copy([dict(saved, mood_scale_json=a.LEGACY_SCALE)], target, source, expected_mood=0)
        with self.assertRaisesRegex(RuntimeError, 'note'):
            self.acceptance.assert_copy([dict(saved, note=source['note'].strip())], target, source, expected_mood=0)

    def test_current_best_into_v2_requires_ten_not_raw_zero(self):
        source = row(1, 0, a.SCALE)
        target = row(2, 7, a.LEGACY_SCALE)
        saved = with_hex(dict(target, mood=10, based_on_entry_id=1))
        self.acceptance.assert_copy([saved], target, source, expected_mood=10)
        with self.assertRaisesRegex(RuntimeError, 'mood'):
            self.acceptance.assert_copy([dict(saved, mood=0)], target, source, expected_mood=10)
        with self.assertRaisesRegex(RuntimeError, 'timestamp'):
            self.acceptance.assert_copy([dict(saved, timestamp=source['timestamp'])], target, source, expected_mood=10)

    def test_v2_worst_to_v2_requires_zero_after_canonical_form(self):
        source = row(1, 0, a.LEGACY_SCALE)
        target = row(2, 8, a.LEGACY_SCALE)
        saved = with_hex(dict(target, mood=0, based_on_entry_id=1))
        self.acceptance.assert_copy([saved], target, source, expected_mood=0)
        with self.assertRaisesRegex(RuntimeError, 'mood'):
            self.acceptance.assert_copy([dict(saved, mood=10)], target, source, expected_mood=0)

    def test_source_integrity_rejects_mutation_and_duplicate_destination(self):
        source = row(1, 10, a.LEGACY_SCALE)
        target = row(2, 0, a.SCALE)
        baseline = [with_hex(source), with_hex(target)]
        self.acceptance.assert_other_rows(baseline, [source], 2)
        with self.assertRaisesRegex(RuntimeError, 'source row'):
            self.acceptance.assert_other_rows([dict(baseline[0], mood=0), baseline[1]], [source], 2)
        with self.assertRaisesRegex(RuntimeError, 'count'):
            self.acceptance.assert_other_rows(baseline + [baseline[1]], [source], 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
