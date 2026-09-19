import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createQaFixture } = require("../scripts/generate-qa-fixtures.js");
const {
  findNodeByContentDescription,
  findNodeByTestId,
  findNodeByTestIdPrefix,
  findNodeByText,
  nodeCenter,
  parseGfxInfo,
  parseMemInfo,
  parseUiHierarchy,
} = require("../scripts/native-ui.js");

const hierarchy = `
  <hierarchy rotation="0">
    <node index="0" text="Undo" resource-id="com.lab4code.moodinator.qa:id/undo-delete"
      content-desc="Undo delete" class="android.widget.Button" clickable="true"
      enabled="true" visible-to-user="true" bounds="[10,20][110,80]" />
    <node index="1" text="QA &amp; synthetic" resource-id="com.lab4code.moodinator.qa:id/mood-entry-actions-51"
      content-desc="Actions for Neutral entry" enabled="true" visible-to-user="true"
      bounds="[100,200][200,300]" />
  </hierarchy>`;

test("parses native nodes and resolves a testID without assuming the package prefix", () => {
  const nodes = parseUiHierarchy(hierarchy);
  assert.equal(nodes.length, 2);
  assert.equal(findNodeByTestId(nodes, "undo-delete")?.text, "Undo");
  assert.equal(findNodeByTestIdPrefix(nodes, "mood-entry-actions-")?.text, "QA & synthetic");
  assert.equal(findNodeByContentDescription(nodes, "Undo delete")?.text, "Undo");
  assert.equal(findNodeByText(nodes, "synthetic", { contains: true })?.text, "QA & synthetic");
});

test("derives the tap point from the inspected bounds", () => {
  const node = parseUiHierarchy(hierarchy)[0];
  assert.deepEqual(nodeCenter(node), { x: 60, y: 50 });
  assert.equal(nodeCenter({ bounds: "[0,0][0,10]" }), null);
});

test("extracts comparable frame and memory counters from Android diagnostics", () => {
  const gfx = parseGfxInfo(`
Total frames rendered: 120
Janky frames: 9 (7.50%)
Missed Vsync: 2
High input latency: 1
Slow UI thread: 3
Slow bitmap uploads: 4
Slow issue draw commands: 5
`);
  assert.deepEqual(gfx, {
    totalFrames: 120,
    jankyFrames: 9,
    missedVsync: 2,
    highInputLatency: 1,
    slowUIThread: 3,
    slowBitmapUploads: 4,
    slowDraw: 5,
    jankyPercent: 7.5,
  });

  const memory = parseMemInfo(`
 Dalvik Heap:                   12,288       8,000
 Native Heap:                   34,560      20,000
 Java Heap:                     46,848      28,000
 TOTAL PSS:                    123,456      98,765
 TOTAL                         123456 kB
`);
  assert.deepEqual(memory, {
    totalPssKb: 123456,
    dalvikHeapKb: 12288,
    nativeHeapKb: 34560,
    javaHeapKb: 46848,
  });
});

test("creates deterministic fabricated entries with a recorded timezone", () => {
  const entries = createQaFixture(100);
  assert.equal(entries.length, 100);
  assert.deepEqual(entries[0], {
    timestamp: Date.UTC(2026, 8, 1, 12),
    utcOffsetMinutes: 0,
    mood: 0,
    note: "QA fixture 1: synthetic mood history for performance checks.",
    emotions: [{ name: "Tired", category: "negative" }],
    contextTags: ["Home"],
    energy: 0,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    basedOnEntryId: null,
  });
  assert.equal(entries[1].timestamp - entries[0].timestamp, -6 * 60 * 60 * 1000);
});
