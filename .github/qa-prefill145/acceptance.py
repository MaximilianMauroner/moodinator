#!/usr/bin/env python3
"""Focused legacy note-only journey on one owned, rooted, nondebuggable QA emulator.

The parent supplies the source-matched APK and resource/lifecycle guard. Fixtures
only replace this fresh QA installation's SQLite data while it is force-stopped.
Every claimed Save is a public UI action followed by a cold SQLite byte oracle.
"""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import sqlite3
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

SOURCE = "e2c7bf7caa87943cfdb253373883616168686d98"
PACKAGE = "com.lab4code.moodinator.qa"
SERIAL = "emulator-5568"
IMAGE = "system-images;android-35;default;x86_64"
FIELDS = ("id", "mood", "note", "timestamp", "emotions", "context_tags", "energy",
          "mood_scale_json", "utc_offset_minutes", "based_on_entry_id")
SCALE = '{"version":1,"min":0,"max":10,"lowerIsBetter":true}'
LEGACY_SCALE = '{"version":2,"min":0,"max":10,"lowerIsBetter":false}'
QUICK_VISIBLE = {"showEmotions": True, "showContext": True, "showEnergy": True, "showNotes": True}
SCENARIOS = ["legacy-note-only-preserves-meaning"]
MOOD_LABELS = {0: "Elated", 2: "Good", 3: "Positive", 5: "Neutral"}


class PrerequisiteError(RuntimeError):
    pass


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def proc(pid):
    try:
        path = Path("/proc") / str(pid)
        raw = (path / "stat").read_text().rsplit(")", 1)[1].split()
        if raw[0] == "Z":
            return None
        return {"pid": int(pid), "start": raw[19], "ppid": int(raw[1]), "session": int(raw[3]),
                "exe": os.readlink(path / "exe"),
                "argv": (path / "cmdline").read_bytes().replace(b"\0", b" ").decode(errors="replace")}
    except (OSError, ValueError, IndexError):
        return None


class Acceptance:
    def __init__(self, args):
        self.qa = args.qa_root.resolve()
        self.apk = args.apk.resolve()
        self.out = args.out.resolve()
        self.out.mkdir(parents=True, exist_ok=False)
        self.env = dict(os.environ)
        self.env.update({"ADB_SERVER_SOCKET": "tcp:127.0.0.1:5038", "ANDROID_ADB_SERVER_PORT": "5038",
                         "ANDROID_AVD_HOME": str(self.out / "avds"),
                         "ANDROID_USER_HOME": str(self.out / "android-user"),
                         "ANDROID_EMULATOR_HOME": str(self.out / "emulator-user")})
        for name in ("avds", "android-user", "emulator-user", "commands", "ui", "db"):
            (self.out / name).mkdir(mode=0o700)
        self.sdk = Path(self.env.get("ANDROID_SDK_ROOT", self.env.get("ANDROID_HOME", ""))).resolve()
        self.adb = self.sdk / "platform-tools/adb"
        self.emulator = self.sdk / "emulator/emulator"
        self.avdmanager = self.sdk / "cmdline-tools/latest/bin/avdmanager"
        self.node = Path(self.env.get("PREFILL_NODE", "")).resolve()
        self.counter = 0
        self.owned = {}
        self.roots = []
        self.sessions = {}
        self.owned_ports = set()
        self.handles = []
        self.name = "prefill145_" + str(os.getpid())
        self.avd = self.out / "avds" / (self.name + ".avd")
        self.db_path = None
        self.storage_path = None
        self.result = {"status": "RUNNING", "source": SOURCE, "scenarios": [], "actions": [],
                       "scenario_verdicts": dict.fromkeys(SCENARIOS, "NOT_RUN"),
                       "save_retry": {"status": "NOT_INDUCED", "reason": "No release fault injection or source/authentication bypass; rendered source regressions are separate evidence."},
                       "serial": SERIAL, "adb_port": 5038, "residual_after_cleanup": None,
                       "limits": ["One disposable API35 x86_64/KVM profile; no physical-device or haptic claim.",
                                  "Focused note-only case only; earlier twelve unchanged-source cases are separate APK/evidence provenance."]}
        self.interrupted = None
        for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(signum, self.interrupt)
        self.persist()

    def interrupt(self, signum, frame):
        self.interrupted = signum
        raise InterruptedError(signal.Signals(signum).name)

    def write(self, name, value):
        path = self.out / name
        temporary = path.with_name(path.name + ".tmp")
        with temporary.open("w") as stream:
            json.dump(value, stream, ensure_ascii=True, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)

    def persist(self):
        self.write("result.json", self.result)

    def track(self):
        live = {int(p.name): proc(int(p.name)) for p in Path("/proc").iterdir() if p.name.isdigit()}
        live = {pid: item for pid, item in live.items() if item is not None}
        parents = {pid for pid, old in self.owned.items()
                   if pid in live and live[pid]["start"] == old["start"]}
        for pid, start in self.roots:
            if pid in live and live[pid]["start"] == start:
                parents.add(pid)
        # A start_new_session root proves ownership of its session. This also
        # finds emulator shutdown children that reparent before the next scan.
        for sid, start in self.sessions.items():
            leader = live.get(sid)
            if leader is not None and leader["start"] != start:
                continue
            parents.update(pid for pid, item in live.items()
                           if item["session"] == sid and int(item["start"]) >= int(start))
        changed = True
        while changed:
            changed = False
            for pid, item in live.items():
                if item["ppid"] in parents and pid not in parents:
                    parents.add(pid)
                    changed = True
        for pid in parents:
            self.owned[pid] = live[pid]

    def run(self, argv, timeout=30, binary=False, input_data=None, accepted_exit=(0,), retain_stdout=True):
        self.track()
        self.counter += 1
        prefix = self.out / "commands" / (f"{self.counter:04d}")
        command = [str(arg) for arg in argv]
        record = {"argv": command, "started": time.time(), "timeout_seconds": timeout}
        self.write(str(prefix.relative_to(self.out)) + ".json", record)
        try:
            completed = subprocess.run(command, env=self.env, input=input_data, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired as error:
            if retain_stdout:
                prefix.with_suffix(".stdout").write_bytes(error.stdout or b"")
            prefix.with_suffix(".stderr").write_bytes(error.stderr or b"")
            record.update({"exit": None, "ended": time.time(), "timeout": True,
                           "stdout_bytes": len(error.stdout or b""),
                           "stdout_sha256": hashlib.sha256(error.stdout or b"").hexdigest(),
                           "stdout_retention": "raw" if retain_stdout else "digest-only"})
            self.write(str(prefix.relative_to(self.out)) + ".json", record)
            raise
        if retain_stdout:
            prefix.with_suffix(".stdout").write_bytes(completed.stdout)
        prefix.with_suffix(".stderr").write_bytes(completed.stderr)
        record.update({"exit": completed.returncode, "ended": time.time(),
                       "stdout_bytes": len(completed.stdout),
                       "stdout_sha256": hashlib.sha256(completed.stdout).hexdigest(),
                       "stdout_retention": "raw" if retain_stdout else "digest-only"})
        self.write(str(prefix.relative_to(self.out)) + ".json", record)
        self.track()
        if completed.returncode not in accepted_exit:
            raise RuntimeError(f"Command {self.counter} exited {completed.returncode}: {command!r}: {completed.stderr.decode(errors='replace')[-1600:]}")
        return completed.stdout if binary else completed.stdout.decode(errors="strict")

    def adb_cmd(self, *args, **kwargs):
        return self.run([self.adb, "-P", "5038", "-s", SERIAL, *args], **kwargs)

    def shell(self, *args, **kwargs):
        return self.adb_cmd("shell", *args, **kwargs)

    def start_owned(self, argv, label):
        stream = (self.out / (label + ".log")).open("wb")
        self.handles.append(stream)
        child = subprocess.Popen([str(arg) for arg in argv], env=self.env, stdout=stream,
                                 stderr=subprocess.STDOUT, start_new_session=True)
        identity = proc(child.pid)
        if identity is None:
            raise PrerequisiteError(label + " process exited before identity capture")
        if identity["session"] != child.pid:
            self.owned[child.pid] = identity
            raise PrerequisiteError(label + " start_new_session identity was not established")
        self.roots.append((child.pid, identity["start"]))
        self.sessions[child.pid] = identity["start"]
        self.owned_ports.update((5038,) if label == "adb-server" else (5568, 5569))
        self.owned[child.pid] = identity
        self.result.setdefault("launches", []).append({"label": label, "argv": list(map(str, argv)),
                                                      "identity": identity, "environment": {key: self.env.get(key) for key in ("ADB_SERVER_SOCKET", "ANDROID_ADB_SERVER_PORT", "ANDROID_AVD_HOME", "ANDROID_USER_HOME", "ANDROID_EMULATOR_HOME", "NODE_OPTIONS")}})
        self.persist()
        return child

    def prerequisites(self):
        if not Path("/dev/kvm").exists() or not os.access("/dev/kvm", os.R_OK | os.W_OK):
            raise PrerequisiteError("Readable/writable /dev/kvm is required; no software-acceleration substitute")
        for tool in (self.adb, self.emulator, self.avdmanager, self.node):
            if not tool.is_file() or not os.access(tool, os.X_OK):
                raise PrerequisiteError("Executable prerequisite missing: " + str(tool))
        if not (self.sdk / "system-images/android-35/default/x86_64/system.img").is_file():
            raise PrerequisiteError("Existing API35 default x86_64 system image missing")
        if not self.apk.is_file():
            raise PrerequisiteError("APK missing")
        for port in (5038, 5568, 5569):
            with socket.socket() as connection:
                connection.settimeout(0.2)
                if connection.connect_ex(("127.0.0.1", port)) == 0:
                    raise PrerequisiteError(f"Private task port {port} already occupied; no foreign intervention")
        metadata = json.loads((self.qa / ".moodinator-qa-source.json").read_text())
        if metadata.get("sourceSha") != SOURCE or metadata.get("nativeSealed") is not True:
            raise PrerequisiteError("Exact sealed QA source identity mismatch")
        for relative, expected in metadata["files"].items():
            path = Path(relative)
            if path.is_absolute() or ".." in path.parts or sha(self.qa / path) != expected:
                raise PrerequisiteError("QA sealed input mismatch: " + relative)
        self.result["QA_metadata_sha256"] = sha(self.qa / ".moodinator-qa-source.json")
        self.result["APK_sha256"] = sha(self.apk)
        self.result["tools"] = {str(tool): sha(tool) for tool in (self.adb, self.emulator, self.node)}
        self.persist()

    def boot(self):
        self.run([self.avdmanager, "create", "avd", "--name", self.name, "--package", IMAGE,
                  "--path", self.avd], timeout=60, input_data=b"no\n")
        with (self.avd / "config.ini").open("a") as config:
            config.write("\nhw.ramSize=1024\nhw.cpu.ncore=1\nhw.lcd.width=720\nhw.lcd.height=1280\nhw.lcd.density=240\nhw.keyboard=yes\n")
        (self.out / "owned-avd-config.ini").write_bytes((self.avd / "config.ini").read_bytes())
        server = self.start_owned([self.adb, "-L", "tcp:localhost:5038", "nodaemon", "server"], "adb-server")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise PrerequisiteError("Private foreground ADB server exited")
            with socket.socket() as connection:
                connection.settimeout(0.2)
                if connection.connect_ex(("127.0.0.1", 5038)) == 0:
                    break
            time.sleep(0.2)
        else:
            raise PrerequisiteError("Private foreground ADB server never became ready")
        emulator = self.start_owned([self.emulator, "-avd", self.name, "-ports", "5568,5569",
                                     "-memory", "1024", "-cores", "1", "-accel", "on",
                                     "-gpu", "swiftshader_indirect", "-no-window", "-no-audio",
                                     "-no-snapshot", "-no-boot-anim", "-camera-back", "none",
                                     "-camera-front", "none"], "emulator")
        self.adb_cmd("wait-for-device", timeout=180)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            if emulator.poll() is not None:
                raise PrerequisiteError("Owned emulator exited during boot")
            if self.shell("getprop", "sys.boot_completed").strip() == "1":
                break
            time.sleep(1)
        else:
            raise PrerequisiteError("Owned emulator boot deadline exceeded")
        avd_name = self.adb_cmd("emu", "avd", "name").splitlines()
        if not avd_name or avd_name[0] != self.name:
            raise PrerequisiteError("Connected emulator AVD identity mismatch")
        self.result["guest"] = {key: self.shell("getprop", key).strip() for key in
                                ("ro.build.version.sdk", "ro.product.cpu.abi", "ro.build.fingerprint")}
        if self.result["guest"]["ro.build.version.sdk"] != "35" or self.result["guest"]["ro.product.cpu.abi"] != "x86_64":
            raise PrerequisiteError("Unexpected owned emulator image")
        self.adb_cmd("root")
        self.adb_cmd("wait-for-device", timeout=30)
        if self.shell("id", "-u").strip() != "0":
            raise PrerequisiteError("Rooted default emulator storage prerequisite missing")
        self.adb_cmd("install", "--no-streaming", self.apk, timeout=90)
        package = self.shell("dumpsys", "package", PACKAGE)
        (self.out / "package.txt").write_text(package)
        if not re.search(r"(?:pkgFlags|flags)=\[[^\]\n]*\bHAS_CODE\b", package) or re.search(r"(?:pkgFlags|flags)=\[[^\]\n]*\bDEBUGGABLE\b", package):
            raise PrerequisiteError("Installed package is missing or debuggable")
        paths = self.shell("pm", "path", PACKAGE).splitlines()
        if len(paths) != 1 or not paths[0].startswith("package:"):
            raise PrerequisiteError("Expected one owned QA base APK")
        installed = self.adb_cmd("exec-out", "cat", paths[0][8:], binary=True, retain_stdout=False)
        if hashlib.sha256(installed).hexdigest() != self.result["APK_sha256"]:
            raise PrerequisiteError("Installed APK differs from exact build")
        self.result["installed_APK_sha256"] = hashlib.sha256(installed).hexdigest()
        self.launch()
        self.wait(test_id="qa-source-sha-" + SOURCE, timeout=45)
        for title in ("Welcome to Moodinator", "Track Your Mood", "Look Back"):
            self.wait(text=title)
            self.tap(desc="Next onboarding page")
        self.wait(text="Your Data, Your Control")
        self.tap(desc="Get started")
        self.wait(desc="Today tab, log your mood")
        self.capture("onboarding")
        self.stop_app()
        matches = self.shell("find", f"/data/user/0/{PACKAGE}", "-name", "moodinator.db").splitlines()
        if len(matches) != 1 or not matches[0].startswith(f"/data/user/0/{PACKAGE}/"):
            raise PrerequisiteError("Expected initialized QA moodinator.db after public onboarding")
        self.db_path = matches[0]
        matches = self.shell("find", f"/data/user/0/{PACKAGE}", "-name", "RKStorage").splitlines()
        if len(matches) != 1 or not matches[0].startswith(f"/data/user/0/{PACKAGE}/"):
            raise PrerequisiteError("Expected QA AsyncStorage database for supported preferences fixture")
        self.storage_path = matches[0]
        self.result["storage"] = {"moods": self.db_path, "preferences": self.storage_path,
                                  "scope": "Fresh owned synthetic QA data only; no app-lock/onboarding/authentication mutation"}
        self.persist()

    def launch(self):
        component = self.shell("cmd", "package", "resolve-activity", "--brief", "-a", "android.intent.action.MAIN",
                               "-c", "android.intent.category.LAUNCHER", PACKAGE).strip().splitlines()[-1]
        if not component.startswith(PACKAGE + "/"):
            raise PrerequisiteError("QA launcher component mismatch")
        started = self.shell("am", "start", "-W", "-n", component, timeout=30)
        if not re.search(r"^Status: ok$", started, re.M):
            raise RuntimeError("QA launch failed: " + started)

    def stop_app(self):
        self.shell("am", "force-stop", PACKAGE)
        if self.shell("pidof", PACKAGE, accepted_exit=(0, 1)).strip():
            raise RuntimeError("Force-stopped QA process remained active")

    def hierarchy(self, label="state"):
        remote = f"/data/local/tmp/prefill145-ui-{os.getpid()}-{self.counter}.xml"
        # Refuse an existing file or dangling symlink before claiming this path.
        self.shell("test", "!", "-e", remote)
        self.shell("test", "!", "-L", remote)
        observation_error = None
        cleanup_error = None
        try:
            try:
                # AOSP Android15's reference dump allows 10s for native idle.
                # Add 5s for bridge/XML work; exact image correspondence is unknown.
                self.shell("uiautomator", "dump", "--compressed", remote, timeout=15)
                output = self.adb_cmd("exec-out", "cat", remote, timeout=8)
            except BaseException as error:
                observation_error = error
                raise
            finally:
                try:
                    self.shell("rm", "-f", remote)
                except BaseException as error:
                    if observation_error is None:
                        raise
                    cleanup_error = repr(error)
            begin, end = output.find("<hierarchy"), output.rfind("</hierarchy>")
            if begin < 0 or end < begin:
                raise RuntimeError("Native hierarchy absent")
            xml = output[begin:end + len("</hierarchy>")]
            self.counter += 1
            path = self.out / "ui" / f"{self.counter:04d}-{label}.xml"
            path.write_text(xml)
            return [element.attrib for element in ET.fromstring(xml).iter("node")]
        except BaseException as error:
            failure = {"path": remote, "error": repr(error)}
            if cleanup_error is not None:
                failure["remote_cleanup_error"] = cleanup_error
            self.result.setdefault("hierarchy_errors", []).append(failure)
            try:
                self.persist()
            except BaseException as receipt_error:
                # Keep the first observation error in memory for execute(). A
                # failed write proves no durable receipt and permits no diagnostics.
                failure["receipt_write_error"] = repr(receipt_error)
            else:
                if isinstance(error, Exception) and not isinstance(error, InterruptedError) and self.interrupted is None:
                    try:
                        self.diagnose_hierarchy_failure()
                    except BaseException as diagnostic_error:
                        failure["diagnostic_error"] = repr(diagnostic_error)
                        # Preserve the observation exception if a diagnostic's own
                        # receipt write fails; execute() still records the first error.
                        try:
                            self.persist()
                        except BaseException:
                            pass
            raise

    def diagnose_hierarchy_failure(self):
        """One read-only screenshot/logcat pair, never another hierarchy or input."""
        if self.interrupted is not None or "hierarchy_failure_diagnostics" in self.result:
            return
        diagnostics = {}
        self.result["hierarchy_failure_diagnostics"] = diagnostics
        prefix = f"{self.counter:04d}-hierarchy-failure"
        for name, argv, suffix in (
                ("screenshot", ("exec-out", "screencap", "-p"), ".png"),
                ("logcat", ("logcat", "-d", "-t", "200", "-v", "threadtime"), ".log")):
            if self.interrupted is not None:
                break
            relative = "ui/" + prefix + suffix
            record = {"timeout_seconds": 5, "path": relative}
            diagnostics[name] = record
            try:
                payload = self.adb_cmd(*argv, timeout=5, binary=True)
                if name == "screenshot" and not payload.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise RuntimeError("Diagnostic screenshot did not return PNG")
                with (self.out / relative).open("xb") as stream:
                    stream.write(payload)
                record.update(status="CAPTURED", bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest())
            except BaseException as error:
                record.update(status="FAILED", error=repr(error))
                if not isinstance(error, Exception) or isinstance(error, InterruptedError):
                    break
        self.persist()

    @staticmethod
    def matches(node, test_id=None, text=None, desc=None, include_disabled=False):
        if node.get("visible-to-user") == "false" or (not include_disabled and node.get("enabled") == "false"):
            return False
        return ((test_id is None or node.get("resource-id", "").split(":id/")[-1] == test_id)
                and (text is None or node.get("text") == text)
                and (desc is None or node.get("content-desc") == desc))

    def wait(self, timeout=12, count=1, **selector):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            nodes = [node for node in self.hierarchy() if self.matches(node, **selector)]
            if len(nodes) == count:
                return nodes
            time.sleep(0.25)
        raise RuntimeError(f"Native selector deadline: {selector!r}; required count={count}, observed={len(nodes)}")

    @staticmethod
    def bounds(node) -> tuple[int, int, int, int] | None:
        match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if not match:
            return None
        left, top, right, bottom = map(int, match.groups())
        return (left, top, right, bottom) if right > left and bottom > top else None

    def tap(self, long=False, index=0, count=1, **selector):
        nodes = self.wait(count=count, **selector)
        node = nodes[index]
        bounds = self.bounds(node)
        if bounds is None:
            raise RuntimeError("Control has no usable native bounds")
        left, top, right, bottom = bounds
        x, y = (left + right) // 2, (top + bottom) // 2
        self.result["actions"].append({"selector": selector, "index": index, "count": count,
                                        "node": node, "point": [x, y], "long_press_ms": 650 if long else 0})
        self.persist()
        self.shell("input", "swipe" if long else "tap", str(x), str(y),
                   *([str(x), str(y), "650"] if long else []))

    def scroll_to(self, **selector):
        for _ in range(8):
            found = [node for node in self.hierarchy() if self.matches(node, **selector)]
            if len(found) == 1 and self.bounds(found[0]) is not None:
                return found[0]
            if len(found) > 1:
                raise RuntimeError("Ambiguous scroll target")
            self.shell("input", "swipe", "360", "840", "360", "370", "350")
        raise RuntimeError("Native scroll limit: " + repr(selector))

    def capture(self, label):
        self.hierarchy(label)
        image = self.adb_cmd("exec-out", "screencap", "-p", binary=True)
        if not image.startswith(b"\x89PNG\r\n\x1a\n"):
            raise RuntimeError("Screenshot did not return PNG")
        path = self.out / "ui" / (label + ".png")
        path.write_bytes(image)

    def pull_database(self, remote, label):
        # The owning app is always stopped before pulling/replacing its database.
        if self.shell("pidof", PACKAGE, accepted_exit=(0, 1)).strip():
            raise RuntimeError("Refusing a live-app SQLite pull")
        directory = self.out / "db" / label
        directory.mkdir(exist_ok=False)
        files = self.shell("find", str(Path(remote).parent), "-maxdepth", "1", "-type", "f").splitlines()
        for suffix in ("", "-wal", "-shm"):
            if remote + suffix in files:
                data = self.adb_cmd("exec-out", "cat", remote + suffix, binary=True)
                (directory / ("input.db" + suffix)).write_bytes(data)
        original = directory / "input.db"
        if not original.is_file():
            raise PrerequisiteError("Owned SQLite file missing")
        copied = directory / "snapshot.db"
        self.write(str(directory.relative_to(self.out)) + "/raw-inputs.json",
                   {path.name: sha(path) for path in directory.iterdir() if path.is_file()})
        with closing(sqlite3.connect(f"file:{original}?mode=ro", uri=True)) as connection, closing(sqlite3.connect(copied)) as snapshot:
            connection.backup(snapshot)
            if snapshot.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Owned synthetic SQLite snapshot is invalid")
        self.write(str(directory.relative_to(self.out)) + "/inputs.json",
                   {path.name: sha(path) for path in directory.iterdir() if path.is_file()})
        return copied

    def replace_database(self, remote, local):
        if self.shell("pidof", PACKAGE, accepted_exit=(0, 1)).strip():
            raise RuntimeError("Refusing a live-app SQLite fixture replacement")
        owner = self.shell("stat", "-c", "%u:%g", remote).strip()
        mode = self.shell("stat", "-c", "%a", remote).strip()
        if not re.fullmatch(r"\d+:\d+", owner) or not re.fullmatch(r"[0-7]{3,4}", mode):
            raise PrerequisiteError("QA database ownership/mode unavailable")
        stage = "/data/local/tmp/prefill145-" + str(os.getpid()) + ".db"
        self.adb_cmd("push", local, stage)
        self.shell("cp", stage, remote)
        self.shell("chown", owner, remote)
        self.shell("chmod", mode, remote)
        self.shell("restorecon", remote)
        self.shell("rm", "-f", remote + "-wal", remote + "-shm", stage)
        if hashlib.sha256(self.adb_cmd("exec-out", "cat", remote, binary=True)).hexdigest() != sha(local):
            raise RuntimeError("Synthetic QA fixture replacement hash mismatch")

    def seed(self, label, rows, prefs):
        self.result["active_fixture"] = label
        self.persist()
        self.stop_app()
        database = self.pull_database(self.db_path, label + "-before-moods")
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("PRAGMA journal_mode=DELETE")
            columns = {row[1] for row in connection.execute("PRAGMA table_info(moods)")}
            if not set(FIELDS).issubset(columns):
                raise PrerequisiteError("Initialized QA schema is missing required columns")
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("DELETE FROM mood_emotions")
            connection.execute("DELETE FROM moods")
            connection.execute("DELETE FROM sqlite_sequence WHERE name='moods'")
            for row in rows:
                connection.execute("INSERT INTO moods (" + ",".join(FIELDS) + ") VALUES (" + ",".join("?" for _ in FIELDS) + ")",
                                   [row[key] for key in FIELDS])
            connection.execute("UPDATE sqlite_sequence SET seq=? WHERE name='moods'", (max([0] + [row["id"] for row in rows]),))
        self.replace_database(self.db_path, database)
        preferences = self.pull_database(self.storage_path, label + "-before-preferences")
        with closing(sqlite3.connect(preferences)) as connection, connection:
            connection.execute("PRAGMA journal_mode=DELETE")
            if {row[1] for row in connection.execute("PRAGMA table_info(catalystLocalStorage)")} != {"key", "value"}:
                raise PrerequisiteError("AsyncStorage schema differs from supported fixture")
            before = dict(connection.execute("SELECT key,value FROM catalystLocalStorage"))
            connection.execute("INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES (?,?)",
                               ("quickEntryPrefs", json.dumps(prefs, separators=(",", ":"))))
            after = dict(connection.execute("SELECT key,value FROM catalystLocalStorage"))
            if {key: value for key, value in before.items() if key != "quickEntryPrefs"} != {key: value for key, value in after.items() if key != "quickEntryPrefs"}:
                raise RuntimeError("Preferences fixture changed an unrelated setting")
        self.replace_database(self.storage_path, preferences)
        self.write("db/" + label + "-fixture.json", {"rows": rows, "preferences": prefs,
                    "moods_sha256": sha(database), "preferences_sha256": sha(preferences),
                    "mutation": "Only synthetic mood rows/junctions/sequence and quickEntryPrefs; all other settings retained"})
        self.launch()
        self.wait(desc="Today tab, log your mood")
        self.wait(test_id="qa-source-sha-" + SOURCE)

    def rows(self, database):
        with closing(sqlite3.connect(f"file:{database}?mode=ro", uri=True)) as connection:
            connection.row_factory = sqlite3.Row
            data = [dict(row) for row in connection.execute("SELECT " + ",".join(FIELDS) + ",hex(CAST(note AS BLOB)) AS note_hex FROM moods ORDER BY id")]
        return data

    def cold(self, label):
        self.stop_app()
        first = self.rows(self.pull_database(self.db_path, label + "-cold-before-start"))
        self.launch()
        self.wait(test_id="qa-source-sha-" + SOURCE)
        self.wait(desc="Today tab, log your mood")
        self.tap(desc="History tab, view past days and months")
        self.capture(label + "-cold-history")
        self.stop_app()
        second = self.rows(self.pull_database(self.db_path, label + "-cold-after-start"))
        if second != first:
            raise RuntimeError("Cold restart changed exact saved rows")
        self.write("db/" + label + "-oracle.json", {"rows": second, "cold_restart_equal": True})
        return second

    def mark(self, label, evidence):
        self.result["scenario_verdicts"][label] = "PASS"
        self.result["scenarios"].append({"name": label, "status": "PASS", **evidence})
        self.persist()
        print("PREFILL145_SCENARIO=" + json.dumps(self.result["scenarios"][-1], separators=(",", ":")), flush=True)

    def edit(self, row, rows, *, mood_label=None):
        self.tap(desc="History tab, view past days and months")
        if sum(other["timestamp"] == row["timestamp"] and other["mood"] == row["mood"] for other in rows) != 1:
            raise PrerequisiteError("Fixture does not expose a unique timestamp/rating public action")
        self.scroll_to(test_id="mood-entry-actions-" + str(row["timestamp"]),
                       desc="Actions for " + (mood_label if mood_label is not None else MOOD_LABELS[row["mood"]]) + " entry")
        self.tap(test_id="mood-entry-actions-" + str(row["timestamp"]),
                 desc="Actions for " + (mood_label if mood_label is not None else MOOD_LABELS[row["mood"]]) + " entry")
        self.tap(text="Edit entry")
        self.wait(desc="Close Edit Entry")

    def assert_copy(self, actual, destination, source, expected_note=None, timestamp_interval=None, *, expected_mood=None):
        row = next((entry for entry in actual if entry["id"] == destination["id"]), None)
        if row is None:
            raise RuntimeError("Saved destination identity missing")
        expected = dict(destination)
        for key in ("mood", "emotions", "context_tags", "energy"):
            expected[key] = source[key]
        if expected_mood is not None:
            expected["mood"] = expected_mood
        expected["note"] = source["note"] if expected_note is None else expected_note
        expected["based_on_entry_id"] = source["id"]
        if timestamp_interval:
            expected["utc_offset_minutes"] = timestamp_interval[2]
        for key, value in expected.items():
            if key == "timestamp" and timestamp_interval:
                if not timestamp_interval[0] <= row[key] <= timestamp_interval[1]:
                    raise RuntimeError("Quick-save timestamp falls outside actual guest-clock tap interval")
            elif row[key] != value:
                raise RuntimeError(f"Exact copy mismatch for {key}: {row[key]!r} != {value!r}")
        expected_hex = expected["note"].encode("utf-8").hex().upper()
        if row["note_hex"] != expected_hex:
            raise RuntimeError("Saved note bytes differ, including whitespace")
        return row

    def run_journeys(self):
        # Earlier twelve cases passed on this exact source in the retained r13
        # APK context. This execution owns only the remaining note-only case.
        now = int(time.time() * 1000) - 60000
        note_only = dict(zip(FIELDS, [231, 10, "QA145-legacy-note", now,
            '[{"name":"Happy","category":"positive","energy":"high"}]',
            '["Work","Home"]', 0, LEGACY_SCALE, 0, None]))
        self.seed("legacy-note-only", [note_only], QUICK_VISIBLE)
        self.edit(note_only, [note_only], mood_label="Elated")
        self.wait(desc="Increase mood to 1")
        self.capture("legacy-note-only-initial-current0")
        for _ in range(4):
            nodes = self.hierarchy()
            if any(self.matches(node, desc="Save entry") for node in nodes):
                break
            if not any(self.matches(node, desc="Next step") for node in nodes):
                raise RuntimeError("Legacy note-only edit page has no enabled Next step or final Save entry")
            self.tap(desc="Next step")
        else:
            raise RuntimeError("Legacy note-only form did not reach the final edit page")
        # Notes can be below the final page's viewport. Reaching the final Save
        # marker means scroll within this page, never request another Next step.
        self.scroll_to(test_id="entry-notes")
        self.tap(test_id="entry-notes")
        self.shell("input", "keyevent", "KEYCODE_MOVE_END")
        self.shell("input", "text", "-edited")
        self.shell("input", "keyevent", "KEYCODE_BACK")
        self.wait(test_id="entry-notes", text=note_only["note"] + "-edited")
        self.tap(desc="Save entry")
        self.wait(desc="Close Edit Entry", count=0)
        saved = self.cold("legacy-note-only")
        expected = dict(note_only, note=note_only["note"] + "-edited")
        expected["note_hex"] = expected["note"].encode().hex().upper()
        if saved != [expected]:
            raise RuntimeError("Legacy note-only edit changed mood meaning, metadata or other fields")
        self.mark("legacy-note-only-preserves-meaning", {"destination": saved[0],
                  "expected_initial_current_mood": 0, "expected_destination_raw_mood": 10})

    @staticmethod
    def assert_other_rows(saved, fixtures, destination_id):
        expected = [dict(row, note_hex=row["note"].encode().hex().upper())
                    for row in fixtures if row["id"] != destination_id]
        if (len(saved) != len(expected) + 1
                or [row for row in saved if row["id"] != destination_id] != expected):
            raise RuntimeError("Mixed-scale Save changed a source row or destination count")

    def cleanup(self):
        # Signals target only recorded PID/start pairs from our own two roots.
        for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(signum, signal.SIG_IGN)
        actions = []
        # Keep the original bounded TERM/KILL phases. Rescan within each phase
        # so a reparented watchdog cannot escape a frozen initial PID list.
        for signum, seconds in ((signal.SIGTERM, 3), (signal.SIGKILL, 3)):
            signaled = set()
            deadline = time.monotonic() + seconds
            while time.monotonic() < deadline:
                self.track()
                for identity in reversed(list(self.owned.values())):
                    key = (identity["pid"], identity["start"])
                    current = proc(identity["pid"])
                    if key not in signaled and current and current["start"] == identity["start"]:
                        try:
                            os.kill(identity["pid"], signum)
                            actions.append({"pid": identity["pid"], "start": identity["start"],
                                            "signal": signum.name})
                            signaled.add(key)
                        except ProcessLookupError:
                            pass
                time.sleep(0.1)
        self.track()
        before = list(self.owned.values())
        residual = [current for old in before if (current := proc(old["pid"])) and current["start"] == old["start"]]
        ports = {}
        for port in (5038, 5568, 5569):
            with socket.socket() as connection:
                connection.settimeout(0.2)
                ports[str(port)] = connection.connect_ex(("127.0.0.1", port)) != 0
        if not residual and all(ports.values()) and self.avd.is_dir():
            shutil.rmtree(self.avd)
            (self.out / "avds" / (self.name + ".ini")).unlink(missing_ok=True)
        for handle in self.handles:
            handle.close()
        self.result["residual_after_cleanup"] = residual
        self.result["owned_identities"] = before
        self.result["cleanup"] = {"owned_PID_start": before, "ports_closed": ports,
                                  "AVD_removed": not self.avd.exists(), "signals": actions, "foreign_process_actions": []}
        if residual or any(not ports[str(port)] for port in self.owned_ports) or self.avd.exists():
            self.result["status"] = "FAIL"
            self.result["cleanup_error"] = "Owned process, task port or AVD survives cleanup"
        self.persist()

    def execute(self):
        try:
            self.prerequisites()
            self.boot()
            self.run_journeys()
            metadata = json.loads((self.qa / ".moodinator-qa-source.json").read_text())
            if sha(self.qa / ".moodinator-qa-source.json") != self.result["QA_metadata_sha256"] or any(sha(self.qa / path) != expected for path, expected in metadata["files"].items()):
                raise RuntimeError("Sealed QA inputs changed during acceptance")
            if sha(self.apk) != self.result["APK_sha256"] or any(sha(tool) != expected for tool, expected in self.result["tools"].items()):
                raise RuntimeError("APK/tool bytes changed during acceptance")
            self.result["unchanged_QA_APK_tools"] = True
            self.result["status"] = "PASS"
        except BaseException as error:
            self.result.update({"status": "BLOCKED" if isinstance(error, PrerequisiteError) else "FAIL",
                                "error": repr(error), "first_failure": True,
                                "interruption_signal": self.interrupted})
            self.persist()
        finally:
            self.cleanup()
        print("PREFILL145_ACCEPTANCE=" + json.dumps(self.result, separators=(",", ":")), flush=True)
        return 0 if self.result["status"] == "PASS" else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--qa-root", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return Acceptance(parser.parse_args()).execute()


if __name__ == "__main__":
    sys.exit(main())
