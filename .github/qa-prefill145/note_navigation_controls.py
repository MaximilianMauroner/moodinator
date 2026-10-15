"""Pure focused-navigation replay; fake UI/ADB plus temporary synthetic SQLite.

No command, emulator, socket or device is started. Final-page XML is a minimal
equivalent of r13/ui/2142-state.xml (SHA256 f7e69788196dfbd344ca05c8e0361ff7
084fb455f4bc2a2a98775fd671ae76e8): enabled Save, no Next and no visible notes.
"""
from contextlib import closing
from copy import deepcopy
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("focused_acceptance_r14", Path(__file__).with_name("acceptance.py"))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)

FINAL_DETAILS_XML = '''<hierarchy rotation="0">
<node content-desc="Close Edit Entry" enabled="true" bounds="[641,130][699,187]" />
<node content-desc="Increase mood to 1" enabled="true" bounds="[365,233][412,281]" />
<node text="Elated" enabled="true" bounds="[233,267][284,292]" />
<node text="ANY MORE CONTEXT?" enabled="true" bounds="[0,345][720,370]" />
<node resource-id="energy-level-0" content-desc="Energy level 0: Drained" enabled="true" bounds="[26,703][153,775]" />
<node content-desc="Save entry" enabled="true" bounds="[368,1102][690,1176]" />
</hierarchy>'''


class Replay(a.Acceptance):
    """Use actual runner logic for journey, tap, scroll, edit, cold and row checks."""

    def __init__(self, root, *, missing_save=False, endless_next=False, missing_notes=False,
                 cold_mutation=None, restart_mood=None):
        self.out = root
        (root / "ui").mkdir()
        self.db_path = "synthetic-owned-qa/moodinator.db"
        self.result = {"actions": [], "scenarios": [], "scenario_verdicts": dict.fromkeys(a.SCENARIOS, "NOT_RUN")}
        self.events, self.receipts = [], {}
        self.mode, self.page, self.notes_visible, self.focused = "today", 0, False, False
        self.fixture, self.saved, self.draft = [], [], ""
        self.missing_save, self.endless_next, self.missing_notes = missing_save, endless_next, missing_notes
        self.cold_mutation, self.restart_mood = cold_mutation or {}, restart_mood

    def persist(self):
        pass

    def write(self, name, value):
        self.receipts[name] = deepcopy(value)

    def seed(self, label, rows, prefs):
        self.events.append(("seed", label))
        self.fixture = deepcopy(rows)
        self.saved = deepcopy(rows)
        self.draft = rows[0]["note"]
        self.mode = "today"

    def hierarchy(self, label="state"):
        if self.mode == "edit" and self.page >= 2 and not self.endless_next:
            root = ET.fromstring(FINAL_DETAILS_XML)
            if self.missing_save:
                root.find("node[@content-desc='Save entry']").set("enabled", "false")
            if self.notes_visible:
                ET.SubElement(root, "node", {"resource-id": "entry-notes", "text": self.draft,
                                            "enabled": "true", "bounds": "[26,868][694,1049]"})
            self.events.append(("final-details", not self.missing_save, self.notes_visible))
            return [node.attrib for node in root.iter("node")]
        if self.mode == "edit":
            return [{"content-desc": "Close Edit Entry", "enabled": "true", "bounds": "[641,130][699,187]"},
                    {"content-desc": "Increase mood to 1", "enabled": "true", "bounds": "[365,233][412,281]"},
                    {"content-desc": "Next step", "enabled": "true", "bounds": "[368,1102][690,1176]"}]
        if self.mode == "today":
            return [{"resource-id": "qa-source-sha-" + a.SOURCE, "enabled": "true"},
                    {"content-desc": "Today tab, log your mood", "enabled": "true"},
                    {"content-desc": "History tab, view past days and months", "enabled": "true", "bounds": "[300,1180][450,1250]"}]
        if self.mode == "history":
            return [{"resource-id": "mood-entry-actions-" + str(self.fixture[0]["timestamp"]),
                     "content-desc": "Actions for Elated entry", "enabled": "true", "bounds": "[30,400][650,460]"}]
        if self.mode == "menu":
            return [{"text": "Edit entry", "enabled": "true", "bounds": "[100,400][600,460]"}]
        return []

    def wait(self, timeout=12, count=1, **selector):
        nodes = [node for node in self.hierarchy() if self.matches(node, **selector)]
        if len(nodes) != count:
            raise RuntimeError("Replay native selector unavailable: " + repr(selector))
        return nodes

    def shell(self, *argv, **kwargs):
        if argv[:2] == ("input", "tap"):
            x, y = map(int, argv[2:])
            targets = [node for node in self.hierarchy()
                       if (box := self.bounds(node)) is not None and box[0] < x < box[2] and box[1] < y < box[3]]
            if len(targets) != 1:
                raise AssertionError("Replay tap is not on one public control")
            node = targets[0]
            target = node.get("resource-id") or node.get("content-desc") or node.get("text")
            self.events.append(("tap", target))
            if target == "History tab, view past days and months":
                self.mode = "history"
            elif target.startswith("mood-entry-actions-"):
                self.mode = "menu"
            elif target == "Edit entry":
                self.mode, self.page = "edit", 0
            elif target == "Next step":
                self.page += 1
            elif target == "entry-notes":
                self.focused = True
            elif target == "Save entry":
                if self.page < 2 or self.draft != self.fixture[0]["note"] + "-edited":
                    raise AssertionError("Replay refuses early Save")
                self.saved = [dict(self.fixture[0], note=self.draft)]
                self.mode = "history"
            else:
                raise AssertionError("Unexpected public tap: " + target)
            return ""
        if argv == ("input", "swipe", "360", "840", "360", "370", "350"):
            self.events.append(("scroll",))
            self.notes_visible = not self.missing_notes
            return ""
        if argv == ("input", "keyevent", "KEYCODE_MOVE_END"):
            if not self.focused:
                raise AssertionError("No focused note")
            return ""
        if argv == ("input", "text", "-edited"):
            if not self.focused:
                raise AssertionError("No focused note")
            self.events.append(("text", "-edited"))
            self.draft += "-edited"
            return ""
        if argv == ("input", "keyevent", "KEYCODE_BACK"):
            self.focused = False
            return ""
        raise AssertionError("Unexpected fake input: " + repr(argv))

    def adb_cmd(self, *argv, **kwargs):
        if argv == ("exec-out", "screencap", "-p"):
            return b"\x89PNG\r\n\x1a\nfabricated replay image"
        raise AssertionError("No real ADB permitted")

    def run(self, *args, **kwargs):
        raise AssertionError("No external command permitted in pure replay")

    def stop_app(self):
        self.mode = "stopped"

    def launch(self):
        self.mode = "today"

    def pull_database(self, remote, label):
        self.events.append(("pull", label))
        path = self.out / (label + ".db")
        data = deepcopy(self.saved)
        data[0].update(self.cold_mutation)
        if self.restart_mood is not None and label.endswith("-cold-after-start"):
            data[0]["mood"] = self.restart_mood
        with closing(sqlite3.connect(path)) as connection, connection:
            connection.execute("CREATE TABLE moods (" + ",".join(a.FIELDS) + ")")
            connection.executemany("INSERT INTO moods VALUES (" + ",".join("?" for _ in a.FIELDS) + ")",
                                   [[row[key] for key in a.FIELDS] for row in data])
        return path


class NoteNavigationControls(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.number = 0

    def replay(self, **kwargs):
        self.number += 1
        root = Path(self.temporary.name) / str(self.number)
        root.mkdir()
        return Replay(root, **kwargs)

    def test_final_marker_then_scroll_note_edit_and_one_public_save(self):
        replay = self.replay()
        replay.run_journeys()
        self.assertEqual(a.SCENARIOS, ["legacy-note-only-preserves-meaning"])
        relevant = [event for event in replay.events if event in (
            ("tap", "Next step"), ("scroll",), ("tap", "entry-notes"),
            ("text", "-edited"), ("tap", "Save entry"))]
        self.assertEqual(relevant, [("tap", "Next step"), ("tap", "Next step"), ("scroll",),
                                    ("tap", "entry-notes"), ("text", "-edited"), ("tap", "Save entry")])
        self.assertLess(replay.events.index(("final-details", True, False)), replay.events.index(("scroll",)))
        self.assertEqual([event[1] for event in replay.events if event[0] == "pull"],
                         ["legacy-note-only-cold-before-start", "legacy-note-only-cold-after-start"])
        expected = dict(replay.fixture[0], note="QA145-legacy-note-edited",
                        note_hex="QA145-legacy-note-edited".encode().hex().upper())
        self.assertEqual(replay.receipts["db/legacy-note-only-oracle.json"],
                         {"rows": [expected], "cold_restart_equal": True})
        self.assertEqual(replay.result["scenario_verdicts"], {"legacy-note-only-preserves-meaning": "PASS"})
        self.assertEqual([event for event in replay.events if event[0] == "seed"], [("seed", "legacy-note-only")])

    def test_old_notes_presence_loop_fails_on_same_final_page(self):
        replay = self.replay()
        replay.mode = "edit"
        with self.assertRaisesRegex(RuntimeError, "selector unavailable"):
            for _ in range(4):
                nodes = replay.hierarchy()
                if any(replay.matches(node, test_id="entry-notes") for node in nodes):
                    break
                replay.tap(desc="Next step")
        self.assertEqual(replay.events.count(("tap", "Next step")), 2)
        self.assertNotIn(("scroll",), replay.events)
        self.assertNotIn(("tap", "Save entry"), replay.events)

    def test_disabled_final_save_is_refused_without_extra_next_or_save(self):
        replay = self.replay(missing_save=True)
        with self.assertRaisesRegex(RuntimeError, "no enabled Next step or final Save entry"):
            replay.run_journeys()
        self.assertEqual(replay.events.count(("tap", "Next step")), 2)
        self.assertNotIn(("tap", "Save entry"), replay.events)
        self.assertNotIn(("scroll",), replay.events)

    def test_missing_final_page_retains_four_step_bound(self):
        replay = self.replay(endless_next=True)
        with self.assertRaisesRegex(RuntimeError, "did not reach the final edit page"):
            replay.run_journeys()
        self.assertEqual(replay.events.count(("tap", "Next step")), 4)
        self.assertNotIn(("tap", "Save entry"), replay.events)
        self.assertNotIn(("text", "-edited"), replay.events)

    def test_missing_notes_stops_at_existing_scroll_limit_without_save(self):
        replay = self.replay(missing_notes=True)
        with self.assertRaisesRegex(RuntimeError, "Native scroll limit"):
            replay.run_journeys()
        self.assertEqual(replay.events.count(("scroll",)), 8)
        self.assertNotIn(("tap", "Save entry"), replay.events)
        self.assertNotIn(("tap", "entry-notes"), replay.events)

    def test_cold_value_scale_identity_time_and_other_fields_are_not_waived(self):
        for field, wrong in (("mood", 0), ("mood_scale_json", a.SCALE), ("id", 232),
                             ("timestamp", 1), ("energy", 1), ("utc_offset_minutes", 60),
                             ("based_on_entry_id", 232), ("emotions", "[]"), ("context_tags", "[]")):
            with self.subTest(field=field):
                replay = self.replay(cold_mutation={field: wrong})
                with self.assertRaisesRegex(RuntimeError, "changed mood meaning, metadata or other fields"):
                    replay.run_journeys()
                self.assertEqual(replay.events.count(("tap", "Save entry")), 1)
                self.assertEqual(len([event for event in replay.events if event[0] == "pull"]), 2)
                self.assertEqual(replay.result["scenario_verdicts"], {"legacy-note-only-preserves-meaning": "NOT_RUN"})

    def test_two_cold_reads_must_agree_before_oracle_pass(self):
        replay = self.replay(restart_mood=0)
        with self.assertRaisesRegex(RuntimeError, "Cold restart changed exact saved rows"):
            replay.run_journeys()
        self.assertNotIn("db/legacy-note-only-oracle.json", replay.receipts)
        self.assertEqual(replay.result["scenarios"], [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
