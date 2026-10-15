"""Pure file-backed hierarchy transport controls; no device/process/socket."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('prefill_acceptance_r12', Path(__file__).parent / 'acceptance.py')
acceptance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(acceptance)
XML = '<?xml version="1.0"?><hierarchy rotation="0"><node text="QA synthetic" resource-id="fixture" /></hierarchy>'


class HierarchyControls(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        with patch.object(acceptance.signal, 'signal'):
            self.run = acceptance.Acceptance(argparse.Namespace(qa_root=root/'qa', apk=root/'fixture.apk', out=root/'out'))
        self.remote = {}
        self.links = set()
        self.calls = []
        self.dump_failure = False
        self.read_failure = False
        self.remove_failure = False
        self.dump_seconds = 0
        self.dump_error = None
        self.diagnostic_errors = {}
        self.png = b'\x89PNG\r\n\x1a\nsynthetic PNG fixture'
        self.logcat = b'only fabricated QA log lines\n'
        self.payload = XML
        def shell(*argv, **kwargs):
            self.calls.append(('shell', argv, kwargs))
            self.run.counter += 1
            if argv[:2] == ('test', '!'):
                if (argv[2] == '-e' and argv[3] in self.remote) or (argv[2] == '-L' and argv[3] in self.links):
                    raise RuntimeError('Owned path collision refused')
            elif argv[:3] == ('uiautomator', 'dump', '--compressed'):
                self.remote[argv[3]] = self.payload
                if self.dump_error is not None: raise self.dump_error
                if self.dump_seconds > kwargs['timeout']:
                    raise subprocess.TimeoutExpired(argv, kwargs['timeout'])
                if self.dump_failure: raise RuntimeError('dump failed')
                return 'UI hierchary dumped to: ' + argv[3] + '\n'
            elif argv[:2] == ('rm', '-f'):
                if self.remove_failure: raise RuntimeError('cleanup failed')
                del self.remote[argv[2]]
            else:
                raise AssertionError('Unexpected fixture command: ' + repr(argv))
            return ''
        def adb(*argv, **kwargs):
            self.calls.append(('adb', argv, kwargs))
            self.run.counter += 1
            if argv[:2] == ('exec-out', 'cat'):
                if self.read_failure: raise RuntimeError('read failed')
                return self.remote[argv[2]]
            if argv == ('exec-out', 'screencap', '-p'):
                if 'screenshot' in self.diagnostic_errors: raise self.diagnostic_errors['screenshot']
                return self.png
            if argv == ('logcat', '-d', '-t', '200', '-v', 'threadtime'):
                if 'logcat' in self.diagnostic_errors: raise self.diagnostic_errors['logcat']
                return self.logcat
            raise AssertionError('Unexpected fixture ADB command: ' + repr(argv))
        self.run.shell = Mock(side_effect=shell)
        self.run.adb_cmd = Mock(side_effect=adb)

    def expected_path(self):
        return f'/data/local/tmp/prefill145-ui-{acceptance.os.getpid()}-{self.run.counter}.xml'

    def test_dump_status_marker_reads_fresh_file_and_cleans_it(self):
        expected = self.expected_path()
        nodes = self.run.hierarchy('fresh')
        self.assertEqual(nodes, [{'text': 'QA synthetic', 'resource-id': 'fixture'}])
        self.assertEqual(self.calls, [
            ('shell', ('test', '!', '-e', expected), {}),
            ('shell', ('test', '!', '-L', expected), {}),
            ('shell', ('uiautomator', 'dump', '--compressed', expected), {'timeout': 15}),
            ('adb', ('exec-out', 'cat', expected), {'timeout': 8}),
            ('shell', ('rm', '-f', expected), {})])
        self.assertEqual(self.remote, {})
        snapshots = list((self.run.out/'ui').glob('*.xml'))
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(ET.fromstring(snapshots[0].read_text()).tag, 'hierarchy')
        self.assertNotIn('hierarchy_failure_diagnostics', self.run.result)

    def diagnostic_calls(self):
        return [call for call in self.calls if call[0] == 'adb' and call[1][:2] != ('exec-out', 'cat')]

    def assert_one_diagnostic_pair(self):
        self.assertEqual(self.diagnostic_calls(), [
            ('adb', ('exec-out', 'screencap', '-p'), {'timeout': 5, 'binary': True}),
            ('adb', ('logcat', '-d', '-t', '200', '-v', 'threadtime'), {'timeout': 5, 'binary': True})])

    def test_reference_idle_window_fits_new_dump_budget_but_not_old_eight(self):
        self.dump_seconds = 10
        # Model elapsed native wait without sleeping or invoking a real command.
        with self.assertRaises(subprocess.TimeoutExpired):
            self.run.shell('uiautomator', 'dump', '--compressed', self.expected_path(), timeout=8)
        self.calls.clear()
        self.remote.clear()
        self.assertEqual(self.run.hierarchy()[0]['resource-id'], 'fixture')
        dump = next(call for call in self.calls if call[1][:2] == ('uiautomator', 'dump'))
        self.assertEqual(dump[2]['timeout'], 15)
        read = next(call for call in self.calls if call[0] == 'adb')
        self.assertEqual(read[2]['timeout'], 8)
        self.assertEqual(self.diagnostic_calls(), [])

    def test_dump_timeout_has_one_attempt_no_read_and_preserves_original(self):
        error = subprocess.TimeoutExpired(['fixture-dump'], 15)
        self.dump_error = error
        with self.assertRaises(subprocess.TimeoutExpired) as caught:
            self.run.hierarchy()
        self.assertIs(caught.exception, error)
        self.assertEqual(len([call for call in self.calls if call[1][:2] == ('uiautomator', 'dump')]), 1)
        self.assertFalse(any(call[1][:2] == ('exec-out', 'cat') for call in self.calls))
        self.assertEqual(self.remote, {})
        self.assert_one_diagnostic_pair()
        self.assertEqual(self.run.result['hierarchy_errors'][0]['error'], repr(error))

    def test_existing_file_is_not_read_overwritten_or_removed(self):
        expected = self.expected_path()
        self.remote[expected] = 'old foreign snapshot'
        with self.assertRaisesRegex(RuntimeError, 'collision'): self.run.hierarchy()
        self.assertEqual(self.remote, {expected: 'old foreign snapshot'})
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.diagnostic_calls(), [])

    def test_dangling_symlink_is_not_followed_or_removed(self):
        expected = self.expected_path()
        self.links.add(expected)
        with self.assertRaisesRegex(RuntimeError, 'collision'): self.run.hierarchy()
        self.assertEqual(self.links, {expected})
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.diagnostic_calls(), [])

    def test_dump_failure_preserved_and_partial_file_cleaned(self):
        self.dump_failure = True
        with self.assertRaisesRegex(RuntimeError, 'dump failed'): self.run.hierarchy()
        self.assertEqual(self.remote, {})
        self.assert_one_diagnostic_pair()
        self.assertIn('dump failed', self.run.result['hierarchy_errors'][0]['error'])

    def test_read_failure_is_preserved_and_cleaned(self):
        self.read_failure = True
        with self.assertRaisesRegex(RuntimeError, 'read failed'): self.run.hierarchy()
        self.assertEqual(self.remote, {})
        self.assertIn('read failed', self.run.result['hierarchy_errors'][0]['error'])

    def test_cleanup_failure_cannot_pass(self):
        self.remove_failure = True
        with self.assertRaisesRegex(RuntimeError, 'cleanup failed'): self.run.hierarchy()
        self.assertEqual(list((self.run.out/'ui').glob('*.xml')), [])

    def test_initial_failure_remains_in_receipt_when_cleanup_also_fails(self):
        self.dump_failure = self.remove_failure = True
        with self.assertRaisesRegex(RuntimeError, 'dump failed'): self.run.hierarchy()
        self.assertIn('dump failed', self.run.result['hierarchy_errors'][0]['error'])
        self.assertIn('cleanup failed', self.run.result['hierarchy_errors'][0]['remote_cleanup_error'])
        self.assert_one_diagnostic_pair()

    def test_diagnostics_capture_independent_bytes_and_hashes_once(self):
        self.read_failure = True
        with self.assertRaisesRegex(RuntimeError, 'read failed'): self.run.hierarchy()
        self.assert_one_diagnostic_pair()
        diagnostics = self.run.result['hierarchy_failure_diagnostics']
        for name, payload in [('screenshot', self.png), ('logcat', self.logcat)]:
            record = diagnostics[name]
            self.assertEqual(record['status'], 'CAPTURED')
            self.assertEqual(record['timeout_seconds'], 5)
            self.assertEqual(record['sha256'], hashlib.sha256(payload).hexdigest())
            self.assertEqual(record['bytes'], len(payload))
            self.assertEqual((self.run.out / record['path']).read_bytes(), payload)
        # A second fabricated caller failure must not repeat first-failure diagnostics.
        with self.assertRaisesRegex(RuntimeError, 'read failed'): self.run.hierarchy()
        self.assert_one_diagnostic_pair()

    def test_diagnostic_failures_and_cleanup_do_not_replace_original(self):
        error = subprocess.TimeoutExpired(['original-fixture-dump'], 15)
        self.dump_error = error
        self.remove_failure = True
        self.diagnostic_errors = {'screenshot': subprocess.TimeoutExpired(['fixture-screenshot'], 5),
                                  'logcat': RuntimeError('fixture logcat rejected')}
        with self.assertRaises(subprocess.TimeoutExpired) as caught:
            self.run.hierarchy()
        self.assertIs(caught.exception, error)
        saved = json.loads((self.run.out / 'result.json').read_text())
        self.assertEqual(saved['hierarchy_errors'][0]['error'], repr(error))
        self.assertIn('cleanup failed', saved['hierarchy_errors'][0]['remote_cleanup_error'])
        self.assertEqual(saved['hierarchy_failure_diagnostics']['screenshot']['status'], 'FAILED')
        self.assertEqual(saved['hierarchy_failure_diagnostics']['logcat']['status'], 'FAILED')
        self.assert_one_diagnostic_pair()

    def test_execute_records_original_timeout_after_secondary_failures(self):
        error = subprocess.TimeoutExpired(['first-observation'], 15)
        self.dump_error = error
        self.remove_failure = True
        self.diagnostic_errors = {'screenshot': RuntimeError('diagnostic unavailable'),
                                  'logcat': subprocess.TimeoutExpired(['logcat'], 5)}
        self.run.prerequisites = Mock()
        self.run.boot = Mock()
        self.run.run_journeys = self.run.hierarchy
        self.run.cleanup = Mock()  # Never execute lifecycle/process cleanup in pure controls.
        with patch('builtins.print'):
            self.assertEqual(self.run.execute(), 1)
        saved = json.loads((self.run.out / 'result.json').read_text())
        self.assertEqual(saved['error'], repr(error))
        self.assertEqual(saved['hierarchy_errors'][0]['error'], repr(error))
        self.assertTrue(saved['first_failure'])
        self.assertEqual(saved['status'], 'FAIL')
        self.run.cleanup.assert_called_once()

    def test_transient_first_receipt_failure_skips_diagnostics_and_execute_recovers_original(self):
        error = subprocess.TimeoutExpired(['original-observation'], 15)
        write_error = OSError('fabricated first receipt write failure')
        self.dump_error = error
        self.run.prerequisites = Mock()
        self.run.boot = Mock()
        self.run.run_journeys = self.run.hierarchy
        self.run.cleanup = Mock()
        persist = self.run.persist
        writes = 0
        def transient_persist():
            nonlocal writes
            writes += 1
            if writes == 1: raise write_error
            persist()
        with patch.object(self.run, 'persist', side_effect=transient_persist), patch('builtins.print'):
            self.assertEqual(self.run.execute(), 1)
        self.assertEqual(writes, 2)
        saved = json.loads((self.run.out / 'result.json').read_text())
        self.assertEqual(saved['error'], repr(error))
        self.assertEqual(saved['hierarchy_errors'][0]['error'], repr(error))
        self.assertEqual(saved['hierarchy_errors'][0]['receipt_write_error'], repr(write_error))
        self.assertEqual(saved['status'], 'FAIL')
        self.assertNotIn('hierarchy_failure_diagnostics', saved)
        self.assertEqual(self.diagnostic_calls(), [])
        self.run.cleanup.assert_called_once()

    def test_persistent_receipt_failure_preserves_original_in_memory_without_durability_claim(self):
        error = subprocess.TimeoutExpired(['original-observation'], 15)
        write_error = OSError('fabricated persistent receipt write failure')
        self.dump_error = error
        self.run.prerequisites = Mock()
        self.run.boot = Mock()
        self.run.run_journeys = self.run.hierarchy
        self.run.cleanup = Mock()
        with patch.object(self.run, 'persist', side_effect=write_error) as persist:
            with self.assertRaises(OSError) as caught:
                self.run.execute()
        self.assertIs(caught.exception, write_error)
        self.assertEqual(persist.call_count, 2)
        self.assertEqual(self.run.result['error'], repr(error))
        failure, = self.run.result['hierarchy_errors']
        self.assertEqual(failure['error'], repr(error))
        self.assertEqual(failure['receipt_write_error'], repr(write_error))
        self.assertEqual(self.run.result['status'], 'FAIL')
        saved = json.loads((self.run.out / 'result.json').read_text())
        self.assertNotEqual(saved['status'], 'PASS')
        self.assertNotIn('error', saved)  # Constructor receipt is stale, not terminal proof.
        self.assertEqual(self.diagnostic_calls(), [])
        self.run.cleanup.assert_called_once()

    def test_no_diagnostics_on_interruption_or_base_control_exceptions(self):
        for error in (InterruptedError('fixture interrupted'), KeyboardInterrupt(), SystemExit(2)):
            with self.subTest(error=repr(error)):
                self.dump_error = error
                with self.assertRaises(type(error)) as caught:
                    self.run.hierarchy()
                self.assertIs(caught.exception, error)
                self.assertEqual(self.remote, {})
                self.assertEqual(self.diagnostic_calls(), [])
        self.dump_error = RuntimeError('late failure after signal')
        self.run.interrupted = acceptance.signal.SIGTERM
        with self.assertRaisesRegex(RuntimeError, 'late failure'): self.run.hierarchy()
        self.assertEqual(self.diagnostic_calls(), [])

    def test_interruption_during_diagnostic_stops_pair_and_keeps_original(self):
        self.dump_failure = True
        self.diagnostic_errors['screenshot'] = KeyboardInterrupt()
        with self.assertRaisesRegex(RuntimeError, 'dump failed'): self.run.hierarchy()
        self.assertEqual(len(self.diagnostic_calls()), 1)
        self.assertNotIn('logcat', self.run.result['hierarchy_failure_diagnostics'])
        self.assertIn('dump failed', self.run.result['hierarchy_errors'][0]['error'])

    def test_invalid_diagnostic_png_does_not_become_success_or_hide_xml_error(self):
        self.payload = 'not XML'
        self.png = b'not PNG'
        with self.assertRaisesRegex(RuntimeError, 'Native hierarchy absent'): self.run.hierarchy()
        diagnostics = self.run.result['hierarchy_failure_diagnostics']
        self.assertEqual(diagnostics['screenshot']['status'], 'FAILED')
        self.assertFalse((self.run.out / diagnostics['screenshot']['path']).exists())
        self.assertEqual(diagnostics['logcat']['status'], 'CAPTURED')
        self.assertNotEqual(self.run.result['status'], 'PASS')

    def test_success_marker_alone_never_becomes_hierarchy(self):
        self.payload = 'UI hierchary dumped to: /dev/tty\n'
        with self.assertRaisesRegex(RuntimeError, 'Native hierarchy absent'): self.run.hierarchy()
        self.assertEqual(self.remote, {})
        self.assertEqual(list((self.run.out/'ui').glob('*.xml')), [])
        self.assert_one_diagnostic_pair()

    def test_malformed_xml_refused_after_owned_cleanup(self):
        self.payload = '<hierarchy><node></hierarchy>'
        with self.assertRaises(ET.ParseError): self.run.hierarchy()
        self.assertEqual(self.remote, {})
        self.assert_one_diagnostic_pair()

    def test_subsequent_snapshot_uses_new_path_and_keeps_unrelated_file(self):
        unrelated = '/data/local/tmp/other-owner.xml'
        self.remote[unrelated] = 'unrelated'
        self.run.hierarchy('first')
        self.payload = XML.replace('QA synthetic', 'second snapshot')
        self.assertEqual(self.run.hierarchy('second')[0]['text'], 'second snapshot')
        dumps = [argv[-1] for _, argv, _ in self.calls if argv[:3] == ('uiautomator', 'dump', '--compressed')]
        self.assertEqual(len(set(dumps)), 2)
        self.assertEqual(self.remote, {unrelated: 'unrelated'})

    def test_diagnostics_stay_in_existing_transport_allowlist(self):
        self.dump_failure = True
        with self.assertRaisesRegex(RuntimeError, 'dump failed'): self.run.hierarchy()
        logger_spec = importlib.util.spec_from_file_location('fixture_evidence_logger', Path(__file__).with_name('log-evidence.py'))
        logger = importlib.util.module_from_spec(logger_spec)
        logger_spec.loader.exec_module(logger)
        forbidden = self.run.out / 'emulator-user' / 'console-credentials'
        forbidden.write_text('fabricated excluded fixture')
        files = logger.acceptance_evidence(self.run.out)
        self.assertNotIn(forbidden, files)
        for record in self.run.result['hierarchy_failure_diagnostics'].values():
            self.assertIn(self.run.out / record['path'], files)
        # The existing evidence inventory refuses a redirected UI subtree.
        ui = self.run.out / 'ui'
        for path in ui.iterdir(): path.unlink()
        ui.rmdir()
        ui.symlink_to(self.run.out / 'emulator-user', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'): logger.acceptance_evidence(self.run.out)


if __name__ == '__main__': unittest.main()
