import importlib.util
import json
import base64
import copy
import io
from pathlib import Path
import sys
import urllib.error
import unittest
from datetime import datetime
from unittest.mock import patch, Mock

sys.dont_write_bytecode = True

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/nightly-ledger.py"
spec = importlib.util.spec_from_file_location("ledger", SCRIPT)
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


def moment(day):
    return datetime.fromisoformat(day + "T21:00:00+00:00")


def seeded(day="2026-09-16"):
    state, _ = ledger.transition(None, "seed", ["0.1.5", "40", "a" * 40], moment(day))
    return state


class ReleaseLedgerTests(unittest.TestCase):
    def test_failed_revision_is_never_retried_and_next_change_consumes_next_patch(self):
        state = seeded()
        state, first = ledger.transition(state, "reserve", ["b" * 40], moment("2026-09-17"))
        self.assertEqual((first["version"], first["versionCode"]), ("0.1.6", 41))
        state, _ = ledger.transition(state, "finish", [first["id"], "failed"])
        state, retry = ledger.transition(state, "reserve", ["b" * 40], moment("2026-09-18"))
        self.assertFalse(retry["build"])
        state, next_attempt = ledger.transition(state, "reserve", ["c" * 40], moment("2026-09-18"))
        self.assertEqual((next_attempt["version"], next_attempt["versionCode"]), ("0.1.7", 42))
        self.assertEqual(state["latest"]["version"], "0.1.5")

    def test_new_commit_same_day_and_active_release_are_gated(self):
        state = seeded()
        state, first = ledger.transition(state, "reserve", ["b" * 40], moment("2026-09-17"))
        state, active = ledger.transition(state, "reserve", ["c" * 40], moment("2026-09-18"))
        self.assertEqual(active["reason"], "another release is still active")
        state, _ = ledger.transition(state, "finish", [first["id"], "succeeded"])
        state, same_day = ledger.transition(state, "reserve", ["c" * 40], moment("2026-09-17"))
        self.assertEqual(same_day["reason"], "daily attempt already used")
        self.assertEqual(state["latest"]["sha"], "b" * 40)

    def test_vienna_date_handles_winter_summer_and_midnight(self):
        for timestamp, expected in [("2026-09-16T22:30:00+00:00", "2026-09-17"),
                                    ("2026-12-16T22:30:00+00:00", "2026-12-16")]:
            state, _ = ledger.transition(None, "seed", ["0.1.5", "8", "a" * 40], datetime.fromisoformat(timestamp))
            self.assertEqual(state["lastAttemptDay"], expected)

    def test_version_code_limit_and_uninitialized_state_fail_closed(self):
        with self.assertRaises(ValueError):
            ledger.transition(None, "reserve", ["b" * 40])
        state = seeded()
        state["lastReserved"]["versionCode"] = 2100000000
        with self.assertRaises(ValueError):
            ledger.transition(state, "reserve", ["b" * 40], moment("2026-09-17"))


class MockStorage:
    def __init__(self, state=None):
        self.state = copy.deepcopy(state if state is not None else seeded())
        self.sha = "1" * 40
        self.writes = 0
        self.lose_response = False

    def read(self):
        return copy.deepcopy(self.state), self.sha

    def write(self, state, sha):
        if sha != self.sha:
            raise ledger.StorageError("GitHub ledger PUT failed (HTTP 409)")
        self.state = copy.deepcopy(state)
        self.writes += 1
        self.sha = format(self.writes + 1, "040x")
        if self.lose_response:
            raise ledger.StorageError("GitHub ledger PUT failed; reconcile ledger before another release")


class GitHubLedgerTests(unittest.TestCase):
    def test_concurrent_stale_reservation_fails_cas_without_build_result(self):
        storage = MockStorage()
        original_read = storage.read
        snapshot = original_read()
        first = ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-17"))
        with patch.object(storage, "read", return_value=copy.deepcopy(snapshot)):
            with self.assertRaisesRegex(ledger.StorageError, "409"):
                ledger.execute(storage, "reserve", ["c" * 40], moment("2026-09-17"))
        self.assertTrue(first["build"])
        self.assertEqual(storage.writes, 1)
        self.assertEqual(storage.state["lastReserved"]["versionCode"], 41)
        self.assertNotIn("c" * 40, storage.state["attempts"])

    def test_uncertain_reservation_leaves_active_blocking_next_source(self):
        storage = MockStorage()
        storage.lose_response = True
        with self.assertRaises(ledger.StorageError):
            ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-17"))
        blocked = ledger.execute(storage, "reserve", ["c" * 40], moment("2026-09-18"))
        self.assertEqual(blocked["reason"], "another release is still active")
        self.assertEqual(storage.writes, 1)

    def test_lost_finish_before_persistence_keeps_active_reservation(self):
        storage = MockStorage()
        first = ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-17"))
        with patch.object(storage, "write", side_effect=ledger.StorageError("connection lost")):
            with self.assertRaises(ledger.StorageError):
                ledger.execute(storage, "finish", [first["id"], "succeeded"])
        blocked = ledger.execute(storage, "reserve", ["c" * 40], moment("2026-09-18"))
        self.assertEqual(blocked["reason"], "another release is still active")
        self.assertEqual(storage.state["latest"]["sha"], "a" * 40)

    def test_cancel_with_no_finish_keeps_reservation_active(self):
        storage = MockStorage()
        ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-17"))
        self.assertIsNotNone(ledger.execute(storage, "status", [])["active"])
        self.assertFalse(ledger.execute(storage, "reserve", ["c" * 40], moment("2026-09-18"))["build"])
        self.assertEqual(storage.writes, 1)

    def test_read_only_noop_and_finish_idempotence_only_persist_changes(self):
        storage = MockStorage()
        ledger.execute(storage, "status", [])
        duplicate = ledger.execute(storage, "reserve", ["a" * 40], moment("2026-09-17"))
        daily = ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-16"))
        self.assertFalse(duplicate["build"])
        self.assertFalse(daily["build"])
        self.assertEqual(storage.writes, 0)
        first = ledger.execute(storage, "reserve", ["b" * 40], moment("2026-09-17"))
        ledger.execute(storage, "finish", [first["id"], "succeeded"])
        ledger.execute(storage, "finish", [first["id"], "succeeded"])
        self.assertEqual(storage.writes, 2)

    def test_seed_forbidden_without_accessing_storage(self):
        storage = Mock()
        with self.assertRaisesRegex(ValueError, "seed is forbidden"):
            ledger.execute(storage, "seed", ["0.1.5", "40", "a" * 40])
        storage.read.assert_not_called()

    def response(self, state):
        return {"type": "file", "encoding": "base64", "sha": "1" * 40,
                "content": base64.b64encode(json.dumps(state).encode()).decode()}

    def test_missing_empty_or_invalid_ledger_fails_closed(self):
        storage = ledger.GitHubStorage("secret")
        for state in (None, {}, [], {"lastReserved": {}}):
            with self.subTest(state=state), patch.object(storage, "request", return_value=self.response(state)):
                with self.assertRaisesRegex(ledger.StorageError, "explicit reconciliation"):
                    storage.read()
        with patch.object(storage, "request", return_value={}):
            with self.assertRaises(ledger.StorageError):
                storage.read()

    def test_request_uses_fixed_repo_branch_and_prior_blob_sha(self):
        storage = ledger.GitHubStorage("secret")
        with patch.object(storage, "request", return_value=self.response(seeded())):
            state, sha = storage.read()
        with patch.object(storage, "request", return_value={"content": {"sha": "2" * 40}}) as request:
            storage.write(state, sha)
        method, body = request.call_args.args
        self.assertEqual(method, "PUT")
        self.assertEqual(body["branch"], "release-state")
        self.assertEqual(body["sha"], "1" * 40)
        self.assertEqual(json.loads(base64.b64decode(body["content"])), state)
        self.assertEqual(ledger.API_URL, "https://api.github.com/repos/MaximilianMauroner/moodinator/contents/ledger.json")

    def test_http_and_network_errors_never_expose_response_or_token_or_retry(self):
        storage = ledger.GitHubStorage("PRIVATE_TOKEN")
        failures = [urllib.error.HTTPError(ledger.API_URL, 404, "PRIVATE_TOKEN", {}, io.BytesIO(b"PRIVATE_BODY")),
                    urllib.error.HTTPError(ledger.API_URL, 409, "PRIVATE_TOKEN", {}, io.BytesIO(b"PRIVATE_BODY")),
                    urllib.error.URLError("PRIVATE_TOKEN"), TimeoutError("PRIVATE_BODY")]
        for failure in failures:
            with self.subTest(failure=type(failure)), patch.object(storage.opener, "open", side_effect=failure) as request:
                with self.assertRaises(ledger.StorageError) as raised:
                    storage.request("PUT", {"sha": "1" * 40})
                self.assertNotIn("PRIVATE", str(raised.exception))
                self.assertIn("reconcile", str(raised.exception))
                request.assert_called_once()

    def test_invalid_response_and_unconfirmed_write_are_sanitized(self):
        storage = ledger.GitHubStorage("secret")
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b"PRIVATE_TOKEN not JSON"
        with patch.object(storage.opener, "open", return_value=response):
            with self.assertRaisesRegex(ledger.StorageError, "Invalid GitHub") as raised:
                storage.request("PUT", {"sha": "1" * 40})
            self.assertNotIn("PRIVATE", str(raised.exception))
        with patch.object(storage, "request", return_value={}):
            with self.assertRaisesRegex(ledger.StorageError, "unconfirmed"):
                storage.write(seeded(), "1" * 40)

    def test_get_uses_release_branch_auth_header_and_bounded_timeout(self):
        storage = ledger.GitHubStorage("secret")
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps(self.response(seeded())).encode()
        with patch.object(storage.opener, "open", return_value=response) as request:
            storage.read()
        sent = request.call_args.args[0]
        self.assertEqual(sent.full_url, ledger.API_URL + "?ref=release-state")
        self.assertEqual(sent.get_method(), "GET")
        self.assertEqual(sent.get_header("Authorization"), "Bearer secret")
        self.assertEqual(request.call_args.kwargs["timeout"], 30)

    def test_cli_rejects_other_repo_and_live_seed_before_authentication(self):
        for arguments in (["ledger.py", "zen-mode", "status"],
                          ["ledger.py", "moodinator", "seed", "0.1.5", "40", "a" * 40]):
            with patch.object(ledger.sys, "argv", arguments), patch.object(ledger, "auth_token") as auth:
                with self.assertRaises(ValueError):
                    ledger.main()
                auth.assert_not_called()

    def test_redirect_never_forwards_authorization(self):
        handler = ledger.NoRedirect()
        self.assertIsNone(handler.redirect_request(Mock(), Mock(), 302, "Found", {}, "https://evil.example"))

    def test_cli_auth_environment_and_captured_fallback(self):
        with patch.dict(ledger.os.environ, {"GH_TOKEN": "gh-secret", "GITHUB_TOKEN": "github-secret"}, clear=True):
            self.assertEqual(ledger.auth_token(), "gh-secret")
        with patch.dict(ledger.os.environ, {}, clear=True), patch.object(ledger.subprocess, "run") as run:
            run.return_value = Mock(returncode=0, stdout="captured-secret\n")
            self.assertEqual(ledger.auth_token(), "captured-secret")
            self.assertTrue(run.call_args.kwargs["capture_output"])
        with patch.dict(ledger.os.environ, {}, clear=True), patch.object(ledger.subprocess, "run") as run:
            run.return_value = Mock(returncode=1, stdout="PRIVATE", stderr="PRIVATE")
            with self.assertRaisesRegex(ledger.StorageError, "authentication unavailable"):
                ledger.auth_token()


if __name__ == "__main__":
    unittest.main()
