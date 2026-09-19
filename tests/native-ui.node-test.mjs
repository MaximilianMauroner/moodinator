import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  combinedFilterExpectation,
  createQaFixture,
  fixtureIdentity,
} = require("../scripts/generate-qa-fixtures.js");
const {
  COORDINATION_PHASES,
  coordinationRemainingMs,
  createUndoCoordination,
  transitionUndoCoordination,
} = require("../scripts/native-qa-coordination.js");
const { requireSourceSha } = require("../scripts/native-qa-common.js");
const {
  findNodes,
  findNodeByContentDescription,
  findNodeByTestId,
  findNodeByTestIdPrefix,
  findNodeByText,
  nodeCenter,
  parseGfxInfo,
  parseMemInfo,
  parseUiHierarchy,
} = require("../scripts/native-ui.js");
const {
  captureText,
  pageBoundaryIds,
  startTrace,
  stopTrace,
  summarizeRunEvidence,
} = require("../scripts/run-native-stress.js");
const { animationValueForState } = require("../scripts/run-native-matrix.js");
const {
  evaluateTimezoneObservations,
  verifyRequestedTimeZone,
} = require("../scripts/run-native-timezone.js");

const hierarchy = `
  <hierarchy rotation="0">
    <node index="0" text="Undo" resource-id="com.lab4code.moodinator.qa:id/undo-delete"
      content-desc="Undo delete" class="android.widget.Button" clickable="true"
      enabled="true" visible-to-user="true" bounds="[10,20][110,80]" />
    <node index="1" text="Undo" resource-id="com.lab4code.moodinator.qa:id/undo-delete-disabled"
      content-desc="Undo delete" class="android.widget.Button" clickable="true"
      enabled="false" visible-to-user="true" bounds="[10,90][110,150]" />
    <node index="2" text="Undo" resource-id="com.lab4code.moodinator.qa:id/undo-delete-hidden"
      content-desc="Undo delete" class="android.widget.Button" clickable="true"
      enabled="true" visible-to-user="false" bounds="[10,160][110,220]" />
    <node index="3" text="QA &amp; synthetic" resource-id="com.lab4code.moodinator.qa:id/mood-entry-actions-51"
      content-desc="Actions for Neutral entry" enabled="true" visible-to-user="true"
      bounds="[100,200][200,300]" />
  </hierarchy>`;

const diagnosticMemory = `
 Dalvik Heap:                   12,288       8,000
 Native Heap:                   34,560      20,000
 Java Heap:                     46,848      28,000
 TOTAL PSS:                    123,456      98,765
 TOTAL                         123456 kB
`;

const diagnosticGfx = `
Total frames rendered: 120
Janky frames: 9 (7.50%)
Missed Vsync: 2
High input latency: 1
Slow UI thread: 3
Slow bitmap uploads: 4
Slow issue draw commands: 5
`;

test("parses native nodes and resolves exact selectors without assuming the package prefix", () => {
  const nodes = parseUiHierarchy(hierarchy);
  assert.equal(nodes.length, 4);
  assert.equal(findNodeByTestId(nodes, "undo-delete")?.text, "Undo");
  assert.equal(findNodeByTestIdPrefix(nodes, "mood-entry-actions-")?.text, "QA & synthetic");
  assert.equal(findNodeByContentDescription(nodes, "Undo delete")?.text, "Undo");
  assert.equal(findNodeByText(nodes, "synthetic", { contains: true })?.text, "QA & synthetic");
  assert.equal(findNodes(nodes, { contentDescription: "Undo delete" }).length, 1);
  assert.equal(findNodes(nodes, { contentDescription: "Undo delete" }, { includeHidden: true }).length, 3);
  assert.equal(findNodes(nodes, {
    allOf: [
      { testId: "mood-entry-actions-51" },
      { text: "QA & synthetic" },
    ],
  }).length, 1);
});

test("derives the tap point from the inspected bounds", () => {
  const node = parseUiHierarchy(hierarchy)[0];
  assert.deepEqual(nodeCenter(node), { x: 60, y: 50 });
  assert.equal(nodeCenter({ bounds: "[0,0][0,10]" }), null);
});

test("coordination starts the Undo deadline at delete, not at Maestro launch", () => {
  let state = createUndoCoordination({
    now: 1000,
    undoWindowMs: 5000,
    deleteAbsenceTimeoutMs: 1000,
  });
  state = transitionUndoCoordination(state, "maestro-complete", 1000);
  state = transitionUndoCoordination(state, "target-captured", 1010);
  assert.throws(
    () => transitionUndoCoordination(state, "undo-visible", 1011),
    /Invalid Undo coordination transition/,
  );
  state = transitionUndoCoordination(state, "delete-requested", 2000);
  assert.equal(state.undoDeadline, 7000);
  assert.equal(coordinationRemainingMs(state, 2000), 1000);
  state = transitionUndoCoordination(state, "target-absent", 2100);
  assert.equal(coordinationRemainingMs(state, 2100), 4900);
  state = transitionUndoCoordination(state, "undo-visible", 6900);
  state = transitionUndoCoordination(state, "undo-tapped", 6910);
  state = transitionUndoCoordination(state, "target-restored", 7000);
  assert.equal(state.phase, COORDINATION_PHASES.PASSED);
  assert.throws(
    () => transitionUndoCoordination(state, "target-restored", 7001),
    /already passed/,
  );
});

test("late or out-of-order transient Undo observations fail closed", () => {
  let state = createUndoCoordination({ now: 0, undoWindowMs: 5000 });
  state = transitionUndoCoordination(state, "maestro-complete", 0);
  state = transitionUndoCoordination(state, "target-captured", 1);
  state = transitionUndoCoordination(state, "delete-requested", 2);
  state = transitionUndoCoordination(state, "target-absent", 3);
  state = transitionUndoCoordination(state, "undo-visible", 5003);
  assert.equal(state.phase, COORDINATION_PHASES.FAILED);
  assert.match(state.failure, /deadline/);
});

test("extracts comparable frame and memory counters from Android diagnostics", () => {
  assert.deepEqual(parseGfxInfo(diagnosticGfx), {
    totalFrames: 120,
    jankyFrames: 9,
    missedVsync: 2,
    highInputLatency: 1,
    slowUIThread: 3,
    slowBitmapUploads: 4,
    slowDraw: 5,
    jankyPercent: 7.5,
  });
  assert.deepEqual(parseMemInfo(diagnosticMemory), {
    totalPssKb: 123456,
    dalvikHeapKb: 12288,
    nativeHeapKb: 34560,
    javaHeapKb: 46848,
  });
});

test("fixture generation covers 1k/10k boundaries with relative positive and negative matches", () => {
  const now = Date.UTC(2031, 4, 1, 12);
  for (const count of [1000, 10000]) {
    const entries = createQaFixture(count, { now });
    assert.equal(entries.length, count);
    assert.equal(entries.every((entry) => entry.timestamp < now), true);
    assert.equal(combinedFilterExpectation(entries, { now }).count, 60);
    assert.equal(entries[0].note.startsWith("QA match"), true);
    assert.equal(entries[1].note.startsWith("QA other"), true);
    assert.equal(entries[0].timestamp - entries[1].timestamp, 2 * 60 * 60 * 1000);
  }
  assert.deepEqual(pageBoundaryIds(1000), [51, 501, 951]);
  assert.deepEqual(pageBoundaryIds(10000), [51, 5001, 9951]);
});

test("fixture identities preserve exact original and edited values", () => {
  const entries = createQaFixture(100, { now: Date.UTC(2031, 4, 1) });
  assert.deepEqual(fixtureIdentity(entries, 51, { editedNote: "QA stress edit 51" }), {
    entryIndex: 51,
    timestamp: entries[50].timestamp,
    mood: 6,
    note: "QA stress edit 51",
    originalNote: entries[50].note,
  });
});

test("required ADB captures and trace finalization cannot produce accepted evidence on failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-qa-test-"));
  try {
    const failedMemory = captureText(
      "emulator-5554",
      ["shell", "dumpsys", "meminfo", "app"],
      join(directory, "memory.txt"),
      { required: true, runAdbImpl: () => { throw new Error("adb exited 1: offline"); } },
    );
    assert.equal(failedMemory.ok, false);
    assert.equal(failedMemory.required, true);
    const failedStart = startTrace("emulator-5554", {
      runAdbImpl: () => { throw new Error("adb exited 1: atrace denied"); },
    });
    assert.equal(failedStart.status, "failed");

    const failedStop = stopTrace(
      "emulator-5554",
      join(directory, "trace.txt"),
      { status: "started" },
      { capture: () => ({ ok: false, output: "", error: "adb exited 1: stop failed" }) },
    );
    assert.equal(failedStop.status, "failed");

    const summary = summarizeRunEvidence({
      run: 1,
      beforeMemory: failedMemory,
      boundaryMemory: [],
      afterMemory: failedMemory,
      gfxReset: failedMemory,
      gfx: failedMemory,
      trace: failedStop,
    });
    assert.equal(summary.status, "failed");
    assert.equal(summary.acceptance, "not-accepted");
    assert.ok(summary.requiredEvidenceFailures.length >= 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("trace evidence is captured only after a successful non-empty stop", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-trace-test-"));
  try {
    const empty = stopTrace(
      "emulator-5554",
      join(directory, "empty.trace"),
      { status: "started" },
      { capture: () => ({ ok: true, output: "   " }) },
    );
    assert.equal(empty.status, "failed");
    assert.equal(empty.ok, false);
    const captured = stopTrace(
      "emulator-5554",
      join(directory, "captured.trace"),
      { status: "started" },
      { capture: () => ({ ok: true, output: "TRACE DATA" }) },
    );
    assert.equal(captured.status, "captured");
    assert.equal(captured.ok, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("normal-motion matrix values are explicit and nonzero", () => {
  assert.equal(animationValueForState(false), "1");
  assert.equal(animationValueForState(true), "0");
});

test("isolated evidence requires the originating full source SHA", () => {
  const sourceSha = "a".repeat(40);
  assert.equal(requireSourceSha({ MOODINATOR_SOURCE_SHA: sourceSha }), sourceSha);
  assert.throws(
    () => requireSourceSha({ MOODINATOR_SOURCE_SHA: "unknown" }),
    /full 40-character lowercase source SHA/,
  );
  assert.throws(
    () => requireSourceSha({}),
    /MOODINATOR_SOURCE_SHA is required/,
  );
});

test("timezone evidence requires accepted, distinct device states", () => {
  assert.equal(verifyRequestedTimeZone("UTC", "UTC"), true);
  assert.equal(verifyRequestedTimeZone("Pacific/Auckland", "UTC"), false);
  const accepted = evaluateTimezoneObservations([
    {
      requestedTimeZone: "UTC",
      actualTimeZone: "UTC",
      accepted: true,
      tested: true,
      contentDescription: "January 1, 2026",
    },
    {
      requestedTimeZone: "Pacific/Auckland",
      actualTimeZone: "Pacific/Auckland",
      accepted: true,
      tested: true,
      contentDescription: "January 1, 2026",
    },
  ]);
  assert.equal(accepted.status, "passed");
  assert.equal(accepted.stableRecordedLabel, true);

  const refused = evaluateTimezoneObservations([
    {
      requestedTimeZone: "UTC",
      actualTimeZone: "UTC",
      accepted: true,
      tested: true,
      contentDescription: "January 1, 2026",
    },
    {
      requestedTimeZone: "Pacific/Auckland",
      actualTimeZone: "UTC",
      accepted: false,
      tested: false,
      contentDescription: null,
    },
  ]);
  assert.equal(refused.status, "blocked");
  assert.equal(refused.stableRecordedLabel, false);
});
