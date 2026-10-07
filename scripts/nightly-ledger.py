#!/usr/bin/env python3
"""Release reservations persisted with GitHub Contents API compare-and-swap."""
import base64
import binascii
import copy
import http.client
import json
import os
import re
import sys
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo


def identity(version, code):
    if not re.fullmatch(r"0\.1\.\d+", version):
        raise ValueError("Release version must be 0.1.patch")
    if not isinstance(code, int) or isinstance(code, bool) or not 1 <= code <= 2100000000:
        raise ValueError("versionCode must be an integer between 1 and 2100000000")
    return {"version": version, "versionCode": code}


def transition(state, action, args, now=None):
    now = now or datetime.now(timezone.utc)
    day = now.astimezone(ZoneInfo("Europe/Vienna")).date().isoformat()
    if action == "status":
        return state, state or {"initialized": False}
    if action == "seed":
        version, code, sha = args
        baseline = identity(version, int(code))
        validate_sha(sha)
        if state is not None:
            if state["latest"] == {**baseline, "sha": sha}:
                return state, {"seeded": False, "reason": "already initialized"}
            raise ValueError("Ledger already initialized; reconcile it with Play before changing it")
        attempt = {**baseline, "sha": sha, "day": day, "status": "succeeded"}
        state = {"lastReserved": baseline, "latest": {**baseline, "sha": sha},
                 "lastAttemptDay": day, "attempts": {sha: attempt}, "active": None}
        return state, {"seeded": True, **baseline}
    if state is None:
        raise ValueError("Seed the ledger from the latest Play release before building")
    if action == "reserve":
        sha, = args
        validate_sha(sha)
        if sha in state["attempts"]:
            return state, {"build": False, "reason": "source revision already attempted"}
        if state["active"]:
            return state, {"build": False, "reason": "another release is still active"}
        if day <= state["lastAttemptDay"]:
            return state, {"build": False, "reason": "daily attempt already used"}
        previous = state["lastReserved"]
        version = "0.1." + str(int(previous["version"].split(".")[2]) + 1)
        reserved = identity(version, previous["versionCode"] + 1)
        attempt = {**reserved, "sha": sha, "day": day, "status": "running", "id": str(uuid4())}
        state["lastReserved"] = reserved
        state["lastAttemptDay"] = day
        state["attempts"][sha] = attempt
        state["active"] = attempt["id"]
        return state, {"build": True, **attempt}
    if action == "finish":
        reservation, status = args
        if status not in ("failed", "succeeded"):
            raise ValueError("Finish status must be failed or succeeded")
        attempt = next((x for x in state["attempts"].values() if x.get("id") == reservation), None)
        if attempt is None:
            raise ValueError("Unknown reservation")
        if attempt["status"] == status:
            return state, {"finished": True, "status": status}
        if state["active"] != reservation or attempt["status"] != "running":
            raise ValueError("Reservation is no longer active")
        attempt["status"] = status
        state["active"] = None
        if status == "succeeded":
            state["latest"] = {key: attempt[key] for key in ("version", "versionCode", "sha")}
        return state, {"finished": True, "status": status}
    raise ValueError("Expected status, seed, reserve, or finish")


def validate_sha(sha):
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full Git SHA")


API_URL = "https://api.github.com/repos/MaximilianMauroner/moodinator/contents/ledger.json"
BRANCH = "release-state"


class StorageError(Exception):
    """Safe diagnostics for storage failures, without response bodies or tokens."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def auth_token():
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        try:
            result = subprocess.run(["gh", "auth", "token", "--hostname", "github.com"],
                                    capture_output=True, text=True, timeout=15, check=False)
        except (OSError, subprocess.SubprocessError):
            raise StorageError("GitHub authentication unavailable") from None
        if result.returncode == 0:
            token = result.stdout.strip()
    if not token or any(character.isspace() for character in token):
        raise StorageError("GitHub authentication unavailable")
    return token


class GitHubStorage:
    def __init__(self, token):
        self.token = token
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, body=None):
        url = API_URL + ("?ref=" + BRANCH if method == "GET" else "")
        headers = {"Authorization": "Bearer " + self.token,
                   "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                   "Content-Type": "application/json"}
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                         headers=headers, method=method)
        uncertainty = "; reconcile ledger before another release" if method == "PUT" else ""
        try:
            with self.opener.open(request, timeout=30) as response:
                payload = response.read()
        except urllib.error.HTTPError as error:
            code = error.code
            error.close()
            raise StorageError(f"GitHub ledger {method} failed (HTTP {code})" + uncertainty) from None
        except (OSError, urllib.error.URLError, http.client.HTTPException, ValueError):
            raise StorageError(f"GitHub ledger {method} failed" + uncertainty) from None
        try:
            return json.loads(payload)
        except (ValueError, UnicodeError):
            raise StorageError(f"Invalid GitHub ledger {method} response" + uncertainty) from None

    def read(self):
        response = self.request("GET")
        try:
            if response["type"] != "file" or response["encoding"] != "base64":
                raise ValueError()
            sha = response["sha"]
            validate_sha(sha)
            content = base64.b64decode("".join(response["content"].split()), validate=True)
            state = json.loads(content)
            validate_state(state)
        except (KeyError, TypeError, ValueError, UnicodeError, AttributeError, binascii.Error):
            raise StorageError("Ledger is missing, empty, or invalid; explicit reconciliation required") from None
        return state, sha

    def write(self, state, sha):
        content = base64.b64encode((json.dumps(state, indent=2) + "\n").encode()).decode()
        response = self.request("PUT", {"message": "Update nightly release ledger", "branch": BRANCH,
                                        "sha": sha, "content": content})
        try:
            validate_sha(response["content"]["sha"])
        except (KeyError, TypeError, ValueError):
            raise StorageError("Ledger persistence unconfirmed; reconcile before another release") from None


def validate_state(state):
    if not isinstance(state, dict) or not state:
        raise ValueError()
    for field in ("lastReserved", "latest"):
        value = state[field]
        identity(value["version"], value["versionCode"])
    validate_sha(state["latest"]["sha"])
    datetime.strptime(state["lastAttemptDay"], "%Y-%m-%d")
    attempts = state["attempts"]
    if not isinstance(attempts, dict) or not attempts:
        raise ValueError()
    running = []
    for sha, attempt in attempts.items():
        validate_sha(sha)
        if attempt["sha"] != sha or attempt["status"] not in ("running", "failed", "succeeded"):
            raise ValueError()
        identity(attempt["version"], attempt["versionCode"])
        datetime.strptime(attempt["day"], "%Y-%m-%d")
        if attempt["status"] == "running":
            if not isinstance(attempt["id"], str) or not attempt["id"]:
                raise ValueError()
            running.append(attempt["id"])
    if running != ([state["active"]] if state["active"] else []):
        raise ValueError()


def execute(storage, action, args, now=None):
    if action not in ("status", "reserve", "finish"):
        raise ValueError("Expected status, reserve, or finish; live seed is forbidden")
    if len(args) != {"status": 0, "reserve": 1, "finish": 2}[action]:
        raise ValueError("Invalid ledger action arguments")
    state, sha = storage.read()
    previous = copy.deepcopy(state)
    state, result = transition(state, action, args, now)
    if state != previous:
        storage.write(state, sha)
    return result


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "moodinator":
        raise ValueError("Expected moodinator and a ledger action")
    action, *args = sys.argv[2:]
    if action not in ("status", "reserve", "finish"):
        raise ValueError("Expected status, reserve, or finish; live seed is forbidden")
    result = execute(GitHubStorage(auth_token()), action, args)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except (StorageError, ValueError) as error:
        sys.exit(str(error))
    except Exception:
        sys.exit("Ledger operation failed; explicit reconciliation required")
