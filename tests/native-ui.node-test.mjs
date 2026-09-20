import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  QA_SOURCE_METADATA,
  readPreparedSourceSha,
  sealPreparedNativeSource,
  writePreparedSourceMetadata,
} = require("../scripts/qa-source-provenance.js");
const { prepareNativeQa } = require("../scripts/prepare-native-qa.js");
const {
  applyNativeStressEditMutations,
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
const {
  assertInstalledQaBuild,
  combineOperationalErrors,
  evidenceStatus,
  isToolUnavailable,
  packageIsDebuggable,
  requireSourceSha,
} = require("../scripts/native-qa-common.js");
const {
  assertCoordinationPassed,
  entryIdentityCounts,
  entrySelectors,
  isExactlyOneRestoredEntry,
  waitForEntryIdentity,
  waitForExactEntry,
  waitForRestorationEvidence,
} = require("../scripts/native-qa-runner.js");
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
  assertInstalledQaBuild: stressInstalledBuildGuard,
  captureText,
  importCompletionTimeoutMs,
  materializeCycle,
  materializeFilter,
  pageBoundaryIds,
  prepareEvidenceDirectory: prepareStressEvidenceDirectory,
  settleImportedHistory,
  startTrace,
  stopTrace,
  summarizeRunEvidence,
  validateStressComparison,
} = require("../scripts/run-native-stress.js");
const {
  animationValueForState,
  isAbsentSettingValue,
  prepareEvidenceDirectory: prepareMatrixEvidenceDirectory,
  restoreTheme,
  themeValueForState,
} = require("../scripts/run-native-matrix.js");
const {
  createTimezoneFixture,
  evaluateTimezoneObservations,
  labelContainsRecordedDateTime,
  prepareEvidenceDirectory: prepareTimezoneEvidenceDirectory,
  recordedLabelFromNode,
  recordedDateTimeExpectation,
  requestRuntimeTimeZone,
  selectRuntimeTimeZone,
  setRuntimeTimeZone,
  timezoneEntryMatcher,
  timezoneEntryTestId,
  verifyRequestedTimeZone,
} = require("../scripts/run-native-timezone.js");
const {
  prepareEvidenceDirectory: prepareSmokeEvidenceDirectory,
} = require("../scripts/run-native-smoke.js");

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

const timezoneHierarchy = `
  <hierarchy rotation="0">
    <node index="0" resource-id="com.lab4code.moodinator.qa:id/mood-entry-stable-1700000000000"
      class="android.view.View" enabled="true" visible-to-user="true" bounds="[0,0][400,240]" />
    <node index="1" text="6" resource-id="com.lab4code.moodinator.qa:id/mood-entry-1700000000000"
      content-desc="Mood 6, November 14, 2023 at 10:13 PM" class="android.widget.Button"
      clickable="true" enabled="true" visible-to-user="true" bounds="[10,20][390,220]" />
  </hierarchy>`;

function exactEntryHierarchy({ hiddenDuplicate = false, visible = true } = {}) {
  const nodes = [];
  const append = (visibility, enabled = true) => {
    const attributes = `enabled="${enabled}" visible-to-user="${visibility}"`;
    nodes.push(`<node index="${nodes.length}" resource-id="com.lab4code.moodinator.qa:id/mood-entry-stable-123" ${attributes} bounds="[0,0][400,240]" />`);
    nodes.push(`<node index="${nodes.length}" text="QA exact" resource-id="com.lab4code.moodinator.qa:id/mood-entry-note-123" ${attributes} bounds="[0,0][300,80]" />`);
    nodes.push(`<node index="${nodes.length}" text="6" resource-id="com.lab4code.moodinator.qa:id/mood-entry-rating-123" ${attributes} bounds="[0,0][80,80]" />`);
  };
  if (visible) append("true");
  if (hiddenDuplicate) append("false");
  return `<hierarchy>${nodes.join("")}</hierarchy>`;
}

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

test("restoration rejects hidden duplicates and hidden-only stale rows", () => {
  const identity = {
    timestamp: 123,
    note: "QA exact",
    mood: 6,
    selectors: entrySelectors({ timestamp: 123, note: "QA exact", mood: 6 }),
  };
  const visiblePlusHidden = parseUiHierarchy(exactEntryHierarchy({ hiddenDuplicate: true }));
  assert.deepEqual(entryIdentityCounts(visiblePlusHidden, identity), {
    visible: [1, 1, 1],
    hierarchy: [2, 2, 2],
  });
  assert.equal(isExactlyOneRestoredEntry(visiblePlusHidden, identity), false);

  const hiddenOnly = parseUiHierarchy(exactEntryHierarchy({ hiddenDuplicate: true, visible: false }));
  assert.deepEqual(entryIdentityCounts(hiddenOnly, identity), {
    visible: [0, 0, 0],
    hierarchy: [1, 1, 1],
  });
  assert.equal(isExactlyOneRestoredEntry(hiddenOnly, identity), false);
});

test("timezone observation targets the labeled nested entry Pressable", () => {
  const timestamp = 1700000000000;
  const nodes = parseUiHierarchy(timezoneHierarchy);
  const node = findNodeByTestId(nodes, timezoneEntryTestId(timestamp));
  assert.deepEqual(timezoneEntryMatcher(timestamp), { testId: "mood-entry-1700000000000" });
  assert.equal(recordedLabelFromNode(node), "Mood 6, November 14, 2023 at 10:13 PM");
  assert.equal(findNodeByTestId(nodes, "mood-entry-stable-1700000000000")?.["content-desc"], undefined);
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

  let lateTap = createUndoCoordination({ now: 0, undoWindowMs: 5000 });
  lateTap = transitionUndoCoordination(lateTap, "maestro-complete", 0);
  lateTap = transitionUndoCoordination(lateTap, "target-captured", 1);
  lateTap = transitionUndoCoordination(lateTap, "delete-requested", 2);
  lateTap = transitionUndoCoordination(lateTap, "target-absent", 3);
  lateTap = transitionUndoCoordination(lateTap, "undo-visible", 4999);
  lateTap = transitionUndoCoordination(lateTap, "undo-tapped", 5003);
  assert.equal(lateTap.phase, COORDINATION_PHASES.FAILED);
  assert.match(lateTap.failure, /tapped after/);
});

test("exact restoration retries transient hierarchy failures", async () => {
  const identity = {
    timestamp: 123,
    note: "QA exact",
    mood: 6,
    selectors: entrySelectors({ timestamp: 123, note: "QA exact", mood: 6 }),
  };
  let attempts = 0;
  await waitForExactEntry("emulator-5554", identity, {
    timeoutMs: 100,
    pollIntervalMs: 0,
    readHierarchyImpl: () => {
      attempts += 1;
      if (attempts === 1) throw new Error("transient malformed dump");
      return parseUiHierarchy(exactEntryHierarchy());
    },
  });
  assert.equal(attempts, 2);
});

test("restored toast observation starts concurrently and uses the full restoration deadline", async () => {
  const events = [];
  let finishExactEntry;
  const exactEntry = new Promise((resolve) => {
    finishExactEntry = resolve;
  });

  const observation = waitForRestorationEvidence("emulator-5554", { timestamp: 123 }, {
    observeRestoredToast: true,
    timeoutMs: 5000,
    waitForExactEntryImpl: () => {
      events.push("exact-started");
      return exactEntry.then(() => events.push("exact-finished"));
    },
    waitForNodeImpl: async (_serial, matcher, options) => {
      events.push("toast-observed");
      assert.deepEqual(matcher, { testId: "restored-mood-toast" });
        assert.equal(options.timeoutMs, 5000);
      return { text: "Mood restored" };
    },
  });

  await Promise.resolve();
  assert.deepEqual(events, ["exact-started", "toast-observed"]);
  finishExactEntry();
  assert.deepEqual(await observation, { restoredToast: { text: "Mood restored" } });
  assert.deepEqual(events, ["exact-started", "toast-observed", "exact-finished"]);
});

test("exact restoration bounds every hierarchy dump by its cap and remaining deadline", async () => {
  const identity = {
    timestamp: 123,
    note: "QA exact",
    mood: 6,
    selectors: entrySelectors({ timestamp: 123, note: "QA exact", mood: 6 }),
  };
  const originalNow = Date.now;
  const observedTimeouts = [];
  let now = 100;

  Date.now = () => now;
  try {
    await waitForExactEntry("emulator-5554", identity, {
      timeoutMs: 25,
      dumpTimeoutMs: 20,
      pollIntervalMs: 0,
      readHierarchyImpl: (_serial, options) => {
        observedTimeouts.push(options.timeoutMs);
        if (observedTimeouts.length === 1) {
          now = 120;
          throw new Error("transient hierarchy dump failure");
        }
        return parseUiHierarchy(exactEntryHierarchy());
      },
    });
  } finally {
    Date.now = originalNow;
  }

  assert.deepEqual(observedTimeouts, [20, 5]);
});

test("entry identity capture retries with its own bounded hierarchy budget", async () => {
  let attempts = 0;
  const observedOptions = [];
  const identity = await waitForEntryIdentity("emulator-5554", {
    note: "QA exact",
    mood: 6,
  }, {
    timeoutMs: 3000,
    pollIntervalMs: 0,
    dumpTimeoutMs: 2500,
    readHierarchyImpl: (_serial, options) => {
      attempts += 1;
      observedOptions.push(options);
      if (attempts === 1) throw new Error("transient hierarchy dump failure");
      return parseUiHierarchy(exactEntryHierarchy());
    },
  });

  assert.equal(attempts, 2);
  assert.equal(identity.timestamp, 123);
  assert.deepEqual(observedOptions.map(({ timeoutMs }) => timeoutMs), [2500, 2500]);
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
    assert.equal(entries[5].note.startsWith("QA other"), true);
    assert.equal(entries[0].timestamp - entries[1].timestamp, 2 * 60 * 60 * 1000);
    const [moodMiss, emotionMiss, contextMiss, noteMiss] = entries.slice(1, 5);
    assert.equal(moodMiss.mood, 5);
    assert.equal(moodMiss.emotions[0].name, "Tired");
    assert.equal(emotionMiss.mood, 6);
    assert.equal(emotionMiss.emotions[0].name, "Calm");
    assert.deepEqual(contextMiss.contextTags, ["Work"]);
    assert.match(noteMiss.note, /^QA other /);
    const dateMiss = entries[count > 1081 ? 1081 : count - 1];
    assert.ok(dateMiss.timestamp < now - 90 * 24 * 60 * 60 * 1000);
    assert.equal(dateMiss.mood, 6);
    assert.match(dateMiss.note, /^QA match /);
    assert.equal(dateMiss.emotions[0].name, "Tired");
    assert.deepEqual(dateMiss.contextTags, ["Home"]);
  }
  assert.deepEqual(pageBoundaryIds(1000), [51, 501, 951]);
  assert.deepEqual(pageBoundaryIds(10000), [51, 5001, 9951]);
});

test("filter expectations derive positive membership after the exact 1k/10k edit cycles", () => {
  const now = Date.UTC(2031, 4, 1, 12);
  for (const count of [1000, 10000]) {
    const entries = createQaFixture(count, { now });
    const boundaries = pageBoundaryIds(count);
    const pristine = combinedFilterExpectation(entries, { now });
    const edited = applyNativeStressEditMutations(entries, boundaries);
    const expectation = combinedFilterExpectation(edited, { now });
    const expectedIndexes = pristine.matchingEntryIndexes;

    assert.deepEqual(expectation.matchingEntryIndexes, expectedIndexes);
    assert.equal(expectation.count, 60);
    assert.equal(expectation.matchingEntryIndexes.includes(1), true);
    assert.equal(expectation.matchingEntryIndexes.includes(51), true);
    assert.match(edited[50].note, /Edited for QA cycle 51/);
    assert.equal(edited[5].note.startsWith("QA other"), true);

    const directory = mkdtempSync(join(tmpdir(), "moodinator-filter-materialize-test-"));
    try {
      const materialized = materializeFilter(directory, entries, count, now);
      assert.equal(materialized.expectation.count, expectation.count);
      assert.equal(materialized.refreshedExpectation.count, expectation.count - 1);
      assert.equal(materialized.refreshMutation.entryIndex, 1);
      assert.match(readFileSync(materialized.flowPath, "utf8"), new RegExp(`${materialized.refreshedExpectation.count} total`));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("10k deep identities use a bounded exact-note indexed lookup", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-indexed-cycle-test-"));
  try {
    const entries = createQaFixture(10000, { now: Date.UTC(2031, 4, 1) });
    const entryIndex = 9951;
    const identity = fixtureIdentity(entries, entryIndex, {
      editedNote: `${entries[entryIndex - 1].note} Edited for QA cycle ${entryIndex}.`,
    });
    const flowPath = materializeCycle(directory, identity, 1, { indexedLookup: true });
    const flow = readFileSync(flowPath, "utf8");
    assert.match(flow, /Filter history/);
    assert.match(flow, /Clear filters/);
    assert.match(flow, new RegExp(String(identity.timestamp)));
    assert.match(flow, /QA other 9951: fabricated native stress record\./);
    assert.equal(flow.includes("${TARGET_SETUP}"), false);
    assert.equal(flow.includes("${EDITED_NOTE}"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all deep stress targets use bounded indexed lookup", () => {
  const source = readFileSync(new URL("../scripts/run-native-stress.js", import.meta.url), "utf8");
  assert.match(source, /indexedLookup: entryId > 51/);
});

test("stress comparison allows different revisions with per-build provenance", () => {
  const make = (sourceSha) => ({
    sourceSha,
    installedSourceSha: sourceSha,
    datasetSize: 1000,
    runCount: 2,
    device: { serial: "emulator-5554", api: "35", model: "Pixel", refreshRate: "60" },
    runs: [
      { thermal: { before: { ok: true, snapshot: "nominal" }, after: { ok: true, snapshot: "nominal" } } },
      { thermal: { before: { ok: true, snapshot: "nominal" }, after: { ok: true, snapshot: "nominal" } } },
    ],
  });
  const result = validateStressComparison(make("a".repeat(40)), make("b".repeat(40)));
  assert.notEqual(result.baselineSourceSha, result.currentSourceSha);
  assert.throws(() => validateStressComparison(make("a".repeat(40)), {
    ...make("b".repeat(40)), installedSourceSha: "c".repeat(40),
  }), /installed QA binary/);
  assert.throws(() => validateStressComparison(make("a".repeat(40)), {
    ...make("b".repeat(40)), device: { ...make("b".repeat(40)).device, refreshRate: "120" },
  }), /refreshRate/);
  const changedThermal = make("b".repeat(40));
  changedThermal.runs[1].thermal.after.snapshot = "throttled";
  assert.throws(() => validateStressComparison(make("a".repeat(40)), changedThermal), /run 2/);
});

test("measured stress flows do not relaunch the app process", () => {
  for (const flowPath of [
    "../.maestro/flows/native-stress-cycle.yaml",
    "../.maestro/flows/native-stress-filters.yaml",
  ]) {
    const flow = readFileSync(new URL(flowPath, import.meta.url), "utf8");
    assert.equal(flow.includes("launchApp"), false);
  }
  const start = readFileSync(new URL("../.maestro/flows/native-stress-start.yaml", import.meta.url), "utf8");
  assert.match(start, /launchApp:/);
  assert.match(start, /stopApp: false/);
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

test("stress filter flow applies cleared drafts before asserting the full list", () => {
  const flow = readFileSync(new URL("../.maestro/flows/native-stress-filters.yaml", import.meta.url), "utf8");
  const clearPositions = [...flow.matchAll(/- tapOn: "Clear filters"/g)].map((match) => match.index);
  assert.equal(clearPositions.length, 3);
  const appliedClear = clearPositions[1];
  const emptyStateClear = clearPositions[2];
  const firstShowResults = flow.indexOf('- tapOn: "Show results"', appliedClear);
  assert.ok(firstShowResults > appliedClear && firstShowResults < emptyStateClear);
  const finalAssertion = flow.indexOf("- assertVisible:", emptyStateClear);
  assert.ok(finalAssertion > emptyStateClear);
  assert.equal(flow.indexOf('- tapOn: "Show results"', emptyStateClear), -1);
  const postSave = flow.slice(flow.indexOf('- tapOn: "Save entry"'));
  assert.equal(postSave.includes('${FILTER_COUNT} total'), false);
});

test("stress observes the restored toast concurrently before waiting for removal", () => {
  const source = readFileSync(new URL("../scripts/run-native-stress.js", import.meta.url), "utf8");
  const appeared = source.indexOf("observeRestoredToast: true");
  const removed = source.indexOf('waitForNodeHierarchyGone(options.serial, { testId: "restored-mood-toast" }');
  const memory = source.indexOf("const memory = captureText", appeared);
  assert.ok(appeared >= 0 && removed > appeared && memory > removed);
});

test("visual matrix retains each screen before the next navigation", () => {
  const source = readFileSync(new URL("../scripts/run-native-matrix.js", import.meta.url), "utf8");
  const insightsSource = readFileSync(
    new URL("../src/features/insights/screens/InsightsScreen.tsx", import.meta.url),
    "utf8",
  );
  for (const screen of ["home", "findings", "charts", "calendar", "settings"]) {
    assert.match(source, new RegExp(`capture\\(\"${screen}\"\\)`));
  }
  const flow = readFileSync(new URL("../.maestro/flows/native-visual-matrix.yaml", import.meta.url), "utf8");
  assert.equal(flow.includes("Insights tab"), false);
  const openInsights = source.indexOf("Insights tab, view mood history and summaries");
  const selectAll = source.indexOf('contentDescription: "All history"', openInsights);
  const loadedSummary = source.indexOf('testId: "insights-loaded-summary"', selectAll);
  assert.ok(openInsights >= 0 && selectAll > openInsights && loadedSummary > selectAll);
  const chartsView = source.indexOf('contentDescription: "Charts view"', loadedSummary);
  const calendarView = source.indexOf('contentDescription: "Calendar view"', chartsView);
  assert.ok(chartsView > loadedSummary && calendarView > chartsView);
  assert.doesNotMatch(source, /waitForNodeAndTap\(serial, \{ text: "(?:Charts|Calendar) view" \}\)/);
  assert.match(source, /testId: "insights-loaded-summary"/);
  assert.match(source, /text: `\$\{fixtureCount\} entries`/);
  assert.match(insightsSource, /testID=\{ready \? "insights-loaded-summary" : undefined\}/);
  const hookSource = readFileSync(
    new URL("../src/features/insights/hooks/useInsightsData.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    hookSource,
    /ready: !loading && !summaryLoading && !error && !summaryError/,
  );
  assert.match(source, /Calendar legend: a dot marks a day with multiple entries/);
  assert.match(source, /Local privacy/);
});

test("matrix theme cleanup restores runtime and its independent secure backing value", () => {
  const calls = [];
  restoreTheme(
    "emulator-5554",
    {
      runtimeNightMode: "no",
      nightMode: "null",
    },
    {
      setAndReadTheme: (_serial, value) => calls.push(["runtime", value]),
      restoreSetting: (_serial, namespace, key, value) =>
        calls.push(["setting", namespace, key, value]),
      readRuntimeTheme: () => "no",
    },
  );
  assert.deepEqual(calls, [
    ["runtime", "no"],
    ["setting", "secure", "ui_night_mode", "null"],
  ]);
});

test("matrix theme cleanup rejects backing restoration that changes runtime behavior", () => {
  assert.throws(
    () =>
      restoreTheme(
        "emulator-5554",
        {
          runtimeNightMode: "yes",
          nightMode: "1",
        },
        {
          setAndReadTheme() {},
          restoreSetting() {},
          readRuntimeTheme: () => "no",
        },
      ),
    /runtime night mode was no after backing-value restoration, expected yes/,
  );
});

test("native evidence runners reject nonempty output before overwriting artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-existing-evidence-"));
  const marker = join(directory, "metadata.json");
  const original = "existing evidence\n";
  try {
    writeFileSync(marker, original);
    assert.throws(() => prepareStressEvidenceDirectory(directory), /must be empty/);
    assert.equal(readFileSync(marker, "utf8"), original);
    assert.throws(() => prepareMatrixEvidenceDirectory(directory), /must be empty/);
    assert.equal(readFileSync(marker, "utf8"), original);
    assert.throws(() => prepareTimezoneEvidenceDirectory(directory), /must be empty/);
    assert.equal(readFileSync(marker, "utf8"), original);
    assert.throws(
      () => prepareSmokeEvidenceDirectory(directory),
      /must be empty/,
    );
    assert.equal(readFileSync(marker, "utf8"), original);

    const newDirectory = join(directory, "new-output");
    prepareStressEvidenceDirectory(newDirectory);
    assert.equal(statSync(newDirectory).isDirectory(), true);
    const emptyDirectory = join(directory, "empty-output");
    mkdirSync(emptyDirectory);
    prepareMatrixEvidenceDirectory(emptyDirectory);
    const timezoneDirectory = join(directory, "timezone-output");
    prepareTimezoneEvidenceDirectory(timezoneDirectory);
    assert.equal(statSync(timezoneDirectory).isDirectory(), true);
    const smokeDirectory = join(directory, "smoke-output");
    prepareSmokeEvidenceDirectory(smokeDirectory);
    assert.equal(statSync(smokeDirectory).isDirectory(), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stress imports use size-aware completion deadlines", () => {
  assert.equal(importCompletionTimeoutMs(1000), 120000);
  assert.equal(importCompletionTimeoutMs(10000), 600000);
  assert.throws(() => importCompletionTimeoutMs(100), /Unsupported stress fixture size/);
});

test("Undo runner captures the row before opening its actions modal", () => {
  const smoke = readFileSync(new URL("../.maestro/smoke.yaml", import.meta.url), "utf8");
  const cycle = readFileSync(new URL("../.maestro/flows/native-stress-cycle.yaml", import.meta.url), "utf8");
  assert.equal(smoke.includes('assertVisible: "Delete entry"'), false);
  assert.equal(cycle.includes('assertVisible: "Delete entry"'), false);
  const source = readFileSync(new URL("../scripts/native-qa-runner.js", import.meta.url), "utf8");
  const capture = source.indexOf("const identity = await waitForEntryIdentity");
  const openActions = source.indexOf("const actionsNode = await waitForNode", capture);
  const deleteAction = source.indexOf("const deleteNode = await waitForNode", openActions);
  assert.ok(capture >= 0 && openActions > capture && deleteAction > openActions);
  assert.match(source.slice(capture, openActions), /dumpTimeoutMs: waitOptions\.identityDumpTimeoutMs/);
  assert.doesNotMatch(source.slice(capture, openActions), /undoDumpTimeoutMs/);
});

test("stress settles imported Home history before performance reset", () => {
  assert.equal(typeof settleImportedHistory, "function");
  const source = readFileSync(new URL("../scripts/run-native-stress.js", import.meta.url), "utf8");
  const imported = source.indexOf("await importFixture(options.serial, fixtureName, options.size)");
  const launched = source.indexOf("await runMaestro(options.serial, measuredStartFlow", imported);
  const settled = source.indexOf("await settleImportedHistory(options.serial, options.size)", launched);
  const reset = source.indexOf("const gfxReset = captureText", settled);
  const baseline = source.indexOf("const beforeMemory = captureText", settled);
  assert.ok(imported >= 0 && launched > imported && settled > launched && reset > settled && baseline > settled);
  assert.match(source, /testId: "history-count"/);
  assert.match(source, /text: `\$\{expectedCount\} total`/);
});

test("delete timing starts before the synchronous ADB tap", () => {
  const source = readFileSync(new URL("../scripts/native-qa-runner.js", import.meta.url), "utf8");
  const transition = source.indexOf('transition(coordination, "delete-requested")');
  const tap = source.indexOf("tapNode(serial, deleteNode", transition);
  assert.ok(transition >= 0 && tap > transition);
});

test("functional evidence failures outrank unavailable diagnostics", () => {
  assert.equal(evidenceStatus({
    routeError: new Error("Maestro assertion failed"),
    requiredFailures: [{ status: "blocked" }],
  }), "failed");
  assert.equal(evidenceStatus({
    routeError: new Error("adb not installed"),
    requiredFailures: [{ status: "failed" }],
  }), "failed");
  assert.equal(evidenceStatus({
    routeError: new Error("adb not installed"),
    requiredFailures: [{ status: "blocked" }],
  }), "blocked");
});

test("canonical ADB connectivity failures block native evidence", () => {
  const unavailable = [
    "error: device offline",
    "error: device unauthorized. Please check the confirmation dialog on your device.",
    "error: no devices/emulators found",
    "spawnSync adb ETIMEDOUT",
    "adb -s emulator-5554 shell pm path timed out after 15000ms",
  ];
  for (const message of unavailable) {
    assert.equal(isToolUnavailable(new Error(message)), true, message);
    assert.equal(evidenceStatus({ routeError: new Error(message) }), "blocked", message);
  }

  const stderrError = new Error("Command failed: adb -s emulator-5554 shell pm path app");
  stderrError.stderr = Buffer.from("error: device offline\n");
  assert.equal(isToolUnavailable(stderrError), true);
  assert.equal(evidenceStatus({ routeError: stderrError }), "blocked");
});

test("ADB command and app assertion failures remain failed evidence", () => {
  const failures = [
    "adb shell atrace exited 1: atrace denied",
    "adb shell dumpsys returned malformed output",
    "Expected node not found in the UI hierarchy",
    "Timed out waiting for the source SHA node",
    "Maestro assertion failed",
  ];
  for (const message of failures) {
    assert.equal(isToolUnavailable(new Error(message)), false, message);
    assert.equal(evidenceStatus({ routeError: new Error(message) }), "failed", message);
  }
});

test("installed QA build must expose the requested source SHA", async () => {
  assert.equal(stressInstalledBuildGuard, assertInstalledQaBuild);
  const sourceSha = "b".repeat(40);
  const calls = [];
  const result = await assertInstalledQaBuild("emulator-5554", sourceSha, {
    execFile: (_command, args) => {
      calls.push(args);
      return args.includes("path") ? "package:/data/app/base.apk\n" : "";
    },
    waitForNodeImpl: async (_serial, matcher) => {
      assert.deepEqual(matcher, { testId: `qa-source-sha-${sourceSha}` });
    },
  });
  assert.deepEqual(result, { appId: "com.lab4code.moodinator.qa", sourceSha });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[1], ["-s", "emulator-5554", "shell", "dumpsys", "package", "com.lab4code.moodinator.qa"]);
});

test("installed QA build rejects debuggable packages before collecting evidence", async () => {
  const sourceSha = "b".repeat(40);
  const calls = [];
  let sourceProbeCalled = false;
  await assert.rejects(
    assertInstalledQaBuild("emulator-5554", sourceSha, {
      execFile: (_command, args) => {
        calls.push(args);
        if (args.includes("path")) return "package:/data/app/base.apk\n";
        if (args.includes("dumpsys")) return "  flags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]\n";
        return "";
      },
      waitForNodeImpl: async () => { sourceProbeCalled = true; },
    }),
    /debuggable.*non-debuggable release build/,
  );
  assert.equal(calls.length, 2);
  assert.equal(sourceProbeCalled, false);
  assert.equal(packageIsDebuggable("  pkgFlags=[ HAS_CODE ]\n"), false);
  assert.equal(packageIsDebuggable("  privateFlags=[ PROFILEABLE_BY_SHELL ]\n"), false);
});

test("late restoration and cleanup failures fail closed", () => {
  assert.throws(
    () => assertCoordinationPassed({ phase: COORDINATION_PHASES.FAILED, failure: "restored too late" }),
    /restored too late/,
  );
  const journeyError = new Error("journey failed");
  const restorationError = new Error("restore failed");
  const combined = combineOperationalErrors(journeyError, restorationError);
  assert.match(combined.message, /journey failed/);
  assert.match(combined.message, /Restoration also failed: restore failed/);
  assert.deepEqual(combined.errors, [journeyError, restorationError]);
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

test("zero-frame gfx captures fail required stress evidence", () => {
  const successfulCapture = { ok: true, output: diagnosticMemory };
  const summary = summarizeRunEvidence({
    run: 1,
    beforeMemory: successfulCapture,
    boundaryMemory: [],
    afterMemory: successfulCapture,
    gfxReset: { ok: true, output: "reset" },
    gfx: { ok: true, output: "Total frames rendered: 0\nJanky frames: 0 (0.00%)\n" },
    trace: { ok: true, status: "captured" },
  });
  assert.equal(summary.status, "failed");
  assert.match(summary.requiredEvidenceFailures[0].error, /greater than zero/);
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
    const boilerplate = stopTrace(
      "emulator-5554",
      join(directory, "zero.trace"),
      { status: "started" },
      { capture: () => ({ ok: true, output: "# tracer: nop\n# entries-in-buffer/entries-written: 0/0   #P:8\n" }) },
    );
    assert.equal(boilerplate.status, "failed");
    assert.equal(boilerplate.ok, false);
    const overwritten = stopTrace(
      "emulator-5554",
      join(directory, "overwritten.trace"),
      { status: "started" },
      { capture: () => ({ ok: true, output: "# entries-in-buffer/entries-written: 0/2   #P:8\n" }) },
    );
    assert.equal(overwritten.status, "failed");
    assert.equal(overwritten.ok, false);
    const captured = stopTrace(
      "emulator-5554",
      join(directory, "captured.trace"),
      { status: "started" },
      { capture: () => ({ ok: true, output: "# entries-in-buffer/entries-written: 2/2   #P:8\n" }) },
    );
    assert.equal(captured.status, "captured");
    assert.equal(captured.ok, true);
    let traceOptions = null;
    stopTrace("emulator-5554", join(directory, "large.trace"), { status: "started" }, {
      capture: (_serial, _args, _path, options) => {
        traceOptions = options;
        return { ok: true, output: "# entries-in-buffer/entries-written: 1/1   #P:8\n" };
      },
    });
    assert.equal(traceOptions.maxBuffer, 32 * 1024 * 1024);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("normal-motion matrix values are explicit and nonzero", () => {
  assert.equal(animationValueForState(false), "1");
  assert.equal(animationValueForState(true), "0");
  assert.equal(themeValueForState("no"), "1");
  assert.equal(themeValueForState("yes"), "2");
  assert.equal(themeValueForState("auto"), "0");
  assert.equal(isAbsentSettingValue("null"), true);
  assert.equal(isAbsentSettingValue(""), true);
  assert.equal(isAbsentSettingValue("1"), false);
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

test("prepared QA provenance is authoritative and rejects stale environment SHAs", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-provenance-test-"));
  const preparedSha = "c".repeat(40);
  try {
    writeFileSync(join(directory, "tracked.js"), "original\n");
    const filePath = writePreparedSourceMetadata(directory, preparedSha, ["tracked.js"]);
    assert.equal(filePath, join(directory, QA_SOURCE_METADATA));
    assert.equal(statSync(filePath).mode & 0o777, 0o444);
    assert.throws(() => readPreparedSourceSha(directory, {}), /Android source is not sealed/);
    assert.equal(readPreparedSourceSha(directory, { MOODINATOR_QA_PREPARE_NATIVE: "1" }), preparedSha);
    mkdirSync(join(directory, "android", "app", "src", "main"), { recursive: true });
    writeFileSync(join(directory, "android", "app", "src", "main", "AndroidManifest.xml"), "<manifest />\n");
    sealPreparedNativeSource(directory);
    assert.throws(
      () => readPreparedSourceSha(directory, { MOODINATOR_QA_PREPARE_NATIVE: "1" }),
      /may only be used before Android source is sealed/,
    );
    assert.equal(readPreparedSourceSha(directory, { MOODINATOR_SOURCE_SHA: preparedSha }), preparedSha);
    assert.throws(
      () => readPreparedSourceSha(directory, { MOODINATOR_SOURCE_SHA: "d".repeat(40) }),
      /does not match prepared source/,
    );
    assert.throws(
      () => readPreparedSourceSha(directory, { MOODINATOR_SOURCE_SHA: "mistyped" }),
      /does not match prepared source/,
    );
    writeFileSync(join(directory, "tracked.js"), "edited after prepare\n");
    assert.throws(
      () => readPreparedSourceSha(directory, { MOODINATOR_SOURCE_SHA: preparedSha }),
      /tracked\.js differs from source/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("prepared QA provenance rejects unmanifested Metro and changed native inputs", () => {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-provenance-input-test-"));
  const preparedSha = "e".repeat(40);
  try {
    mkdirSync(join(directory, "src", "services"), { recursive: true });
    writeFileSync(join(directory, "src", "services", "bootstrapService.ts"), "export default 1;\n");
    writePreparedSourceMetadata(directory, preparedSha, ["src/services/bootstrapService.ts"]);
    writeFileSync(join(directory, "src", "services", "bootstrapService.android.ts"), "export default 2;\n");
    assert.throws(
      () => readPreparedSourceSha(directory, { MOODINATOR_QA_PREPARE_NATIVE: "1" }),
      /unexpected input src\/services\/bootstrapService\.android\.ts/,
    );
    rmSync(join(directory, "src", "services", "bootstrapService.android.ts"));
    mkdirSync(join(directory, "node_modules", "dependency"), { recursive: true });
    writeFileSync(join(directory, "node_modules", "dependency", "index.js"), "generated dependency\n");
    writeFileSync(join(directory, "expo-env.d.ts"), "/// generated Expo types\n");
    mkdirSync(join(directory, "android", "app", "src", "main", "java"), { recursive: true });
    const nativeFile = join(directory, "android", "app", "src", "main", "java", "MainApplication.kt");
    writeFileSync(nativeFile, "// generated\n");
    sealPreparedNativeSource(directory);
    mkdirSync(join(directory, "android", "app", "build", "generated"), { recursive: true });
    writeFileSync(join(directory, "android", "app", "build", "generated", "output"), "build output\n");
    mkdirSync(join(directory, "android", "app", ".cxx", "Release", "arm64-v8a"), { recursive: true });
    writeFileSync(join(directory, "android", "app", ".cxx", "Release", "arm64-v8a", "build.ninja"), "build output\n");
    assert.equal(readPreparedSourceSha(directory, {}), preparedSha);
    writeFileSync(nativeFile, "// edited after sealing\n");
    assert.throws(() => readPreparedSourceSha(directory, {}), /MainApplication\.kt differs from source/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("QA preparation copies committed HEAD blobs despite assume-unchanged worktree edits", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "moodinator-prepare-source-test-"),
  );
  const outputs = mkdtempSync(
    join(tmpdir(), "moodinator-prepare-output-test-"),
  );
  try {
    execFileSync("git", ["init", "-q"], { cwd: directory });
    execFileSync("git", ["config", "user.email", "qa@example.invalid"], {
      cwd: directory,
    });
    execFileSync("git", ["config", "user.name", "QA Test"], { cwd: directory });
    writeFileSync(join(directory, "tracked.txt"), "committed bytes\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: directory });
    execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: directory });
    execFileSync("git", ["update-index", "--assume-unchanged", "tracked.txt"], {
      cwd: directory,
    });
    writeFileSync(join(directory, "tracked.txt"), "hidden worktree edit\n");
    assert.equal(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: directory,
        encoding: "utf8",
      }),
      "",
    );

    const { destination } = prepareNativeQa(directory, outputs);
    assert.equal(
      readFileSync(join(destination, "tracked.txt"), "utf8"),
      "committed bytes\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(outputs, { recursive: true, force: true });
  }
});

test("QA config derives its embedded SHA from prepared provenance", () => {
  const configSource = readFileSync(new URL("../app.config.js", import.meta.url), "utf8");
  const metroSource = readFileSync(new URL("../metro.config.js", import.meta.url), "utf8");
  const prepareSource = readFileSync(new URL("../scripts/prepare-native-qa.js", import.meta.url), "utf8");
  assert.match(configSource, /readPreparedSourceSha\(__dirname, process\.env\)/);
  assert.match(metroSource, /MOODINATOR_VARIANT === "qa"/);
  assert.match(metroSource, /readPreparedSourceSha\(__dirname, process\.env\)/);
  assert.match(metroSource, /MOODINATOR_METRO_MAX_WORKERS/);
  assert.match(prepareSource, /writePreparedSourceMetadata\(destination, sourceSha, copiedTracked\)/);
  assert.doesNotMatch(configSource, /const sourceSha = process\.env\.MOODINATOR_SOURCE_SHA/);
});

test("timezone evidence requires accepted, distinct device states", () => {
  const rejected = requestRuntimeTimeZone("emulator-5554", "UTC", {
    runAdbImpl: () => { throw new Error("permission denied"); },
    readDeviceTimeZoneImpl: () => ({ settings: "UTC", property: "UTC", value: "UTC" }),
  });
  assert.equal(rejected.requestError, "permission denied");
  assert.equal(Boolean(!rejected.requestError && verifyRequestedTimeZone("UTC", rejected.value)), false);
  assert.deepEqual(selectRuntimeTimeZone("Pacific/Auckland", "UTC"), {
    settings: "Pacific/Auckland",
    property: "UTC",
    value: "UTC",
  });
  assert.deepEqual(selectRuntimeTimeZone("UTC", ""), {
    settings: "UTC",
    property: null,
    value: null,
  });
  assert.equal(verifyRequestedTimeZone("UTC", "UTC"), true);
  assert.equal(verifyRequestedTimeZone("Pacific/Auckland", "UTC"), false);
  const accepted = evaluateTimezoneObservations([
    {
      requestedTimeZone: "UTC",
      actualTimeZone: "UTC",
      accepted: true,
      tested: true,
      contentDescription: "January 1, 2026",
      matchesExpectedRecordedDateTime: true,
    },
    {
      requestedTimeZone: "Pacific/Auckland",
      actualTimeZone: "Pacific/Auckland",
      accepted: true,
      tested: true,
      contentDescription: "January 1, 2026",
      matchesExpectedRecordedDateTime: true,
    },
  ]);
  assert.equal(accepted.status, "passed");
  assert.equal(accepted.stableRecordedLabel, true);

  const missingRecordedDateTime = evaluateTimezoneObservations([
    {
      requestedTimeZone: "UTC",
      actualTimeZone: "UTC",
      accepted: true,
      tested: true,
      contentDescription: "Mood entry: Uncomfortable (6)",
      matchesExpectedRecordedDateTime: false,
    },
    {
      requestedTimeZone: "Pacific/Auckland",
      actualTimeZone: "Pacific/Auckland",
      accepted: true,
      tested: true,
      contentDescription: "Mood entry: Uncomfortable (6)",
      matchesExpectedRecordedDateTime: false,
    },
  ]);
  assert.equal(missingRecordedDateTime.status, "failed");
  assert.equal(missingRecordedDateTime.sameRecordedLabel, true);
  assert.equal(missingRecordedDateTime.expectedRecordedDateTime, false);

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

  const failureBeforeRefusal = evaluateTimezoneObservations([
    {
      requestedTimeZone: "UTC",
      actualTimeZone: "UTC",
      accepted: true,
      tested: true,
      contentDescription: "Mood entry: Uncomfortable (6), logged at the wrong time",
      matchesExpectedRecordedDateTime: false,
    },
    {
      requestedTimeZone: "Pacific/Auckland",
      actualTimeZone: "UTC",
      accepted: false,
      tested: false,
    },
  ]);
  assert.equal(failureBeforeRefusal.status, "failed");
  assert.equal(failureBeforeRefusal.stableRecordedLabel, false);
});

test("timezone restoration accepts an unsupported command when runtime is already original", () => {
  assert.equal(
    setRuntimeTimeZone("emulator-5554", "UTC", {
      runAdbImpl: () => { throw new Error("cmd: Can't find service: alarm"); },
      readDeviceTimeZoneImpl: () => ({ value: "UTC" }),
    }),
    "UTC",
  );
});

test("timezone restoration fails when an unsupported command leaves runtime unrestored", () => {
  assert.throws(
    () => setRuntimeTimeZone("emulator-5554", "UTC", {
      runAdbImpl: () => { throw new Error("cmd: Can't find service: alarm"); },
      readDeviceTimeZoneImpl: () => ({ value: "Pacific/Auckland" }),
    }),
    /Android runtime timezone was Pacific\/Auckland, expected UTC.*Can't find service: alarm/,
  );
});

test("timezone fixture expectation uses its nonzero half-hour recorded offset", () => {
  const entries = createTimezoneFixture();
  assert.equal(entries.length, 100);
  assert.equal(entries[0].utcOffsetMinutes, -330);
  const entry = {
    timestamp: Date.UTC(2026, 0, 2, 4, 15),
    utcOffsetMinutes: -330,
  };
  const expected = recordedDateTimeExpectation(entry);
  assert.deepEqual(expected, {
    dateLabel: "Fri, Jan 2",
    timeLabel: "9:45 AM",
  });
  assert.equal(
    labelContainsRecordedDateTime(
      "Mood entry: Uncomfortable (6), logged on Fri, Jan 2 at 9:45 AM",
      expected,
    ),
    true,
  );
  assert.equal(
    labelContainsRecordedDateTime(
      "Mood entry: Uncomfortable (6), logged on Fri, Jan 2 at 4:15 AM",
      expected,
    ),
    false,
  );

  assert.deepEqual(recordedDateTimeExpectation(entry, "en-GB", false), {
    dateLabel: "Fri 2 Jan",
    timeLabel: "9:45",
  });
  assert.equal(
    labelContainsRecordedDateTime(
      "Mood entry: Uncomfortable (6), logged on Fri 2 Jan at 9:45",
      recordedDateTimeExpectation(entry, "en-GB", false),
    ),
    true,
  );
});
