const { execFileSync } = require("node:child_process");
const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const {
  applyFixtureNoteEdits,
  applyNativeStressEditMutations,
  combinedFilterExpectation,
  createQaFixture,
  fixtureIdentity,
  nativeStressEditNote,
} = require("./generate-qa-fixtures");
const {
  assertInstalledQaBuild,
  evidenceAcceptance,
  evidenceStatus,
  isToolUnavailable,
  requireSourceSha,
} = require("./native-qa-common");
const {
  parseGfxInfo,
  parseMemInfo,
  runAdb,
  waitForNode,
  waitForNodeAndTap,
  waitForNodeHierarchyGone,
} = require("./native-ui");
const { runDeleteUndoAcceptance, runMaestro } = require("./native-qa-runner");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");
const importFlow = path.join(root, ".maestro/flows/native-stress-import.yaml");
const cycleTemplatePath = path.join(root, ".maestro/flows/native-stress-cycle.yaml");
const filterTemplatePath = path.join(root, ".maestro/flows/native-stress-filters.yaml");

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) {
    throw new Error("The first argument must be a disposable emulator serial such as emulator-5554.");
  }

  const options = {
    serial,
    size: null,
    label: null,
    runs: 2,
    output: null,
  };

  while (argv.length) {
    const flag = argv.shift();
    const value = argv.shift();
    if (!value) throw new Error(`Missing value for ${flag}.`);

    switch (flag) {
      case "--size":
        options.size = Number(value);
        break;
      case "--label":
        options.label = value;
        break;
      case "--runs":
        options.runs = Number(value);
        break;
      case "--out":
        options.output = value;
        break;
      default:
        throw new Error(`Unknown option ${flag}.`);
    }
  }

  if (![1000, 10000].includes(options.size)) throw new Error("--size must be 1000 or 10000.");
  if (!options.label || !/^[\w.-]+$/.test(options.label)) {
    throw new Error("--label must contain only letters, numbers, dot, dash, or underscore.");
  }
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 5) {
    throw new Error("--runs must be an integer from 1 to 5.");
  }

  return options;
}

function captureText(serial, args, outputPath, {
  timeoutMs = 30000,
  maxBuffer,
  required = false,
  runAdbImpl = runAdb,
  label = args.join(" "),
} = {}) {
  try {
    const output = runAdbImpl(serial, args, { timeoutMs, maxBuffer });
    writeFileSync(outputPath, output);
    return { output, ok: true, required, label };
  } catch (error) {
    const output = `COMMAND: adb -s ${serial} ${args.join(" ")}\nERROR: ${error.message}\n`;
    writeFileSync(outputPath, output);
    return { output, ok: false, required, label, error: error.message };
  }
}

function captureJson(outputDirectory, name, value) {
  writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
}

function prepareEvidenceDirectory(outputDirectory) {
  if (existsSync(outputDirectory)) {
    if (!statSync(outputDirectory).isDirectory()) {
      throw new Error(`Native stress evidence output already exists and is not a directory: ${outputDirectory}`);
    }
    if (readdirSync(outputDirectory).length > 0) {
      throw new Error(`Native stress evidence output must be empty: ${outputDirectory}`);
    }
    return;
  }
  mkdirSync(outputDirectory, { recursive: true });
}

function materializeCycle(outputDirectory, identity, runNumber, { indexedLookup = false } = {}) {
  const template = readFileSync(cycleTemplatePath, "utf8");
  const targetSetup = indexedLookup ? `- tapOn: "Filter history"
- tapOn: "Clear filters"
- scrollUntilVisible:
    element:
      id: "history-filter-note"
    direction: DOWN
- tapOn:
    id: "history-filter-note"
- inputText: "${identity.originalNote}"
- hideKeyboard
- tapOn: "Show results"` : "";
  const flow = template
    .replaceAll("${TARGET_SETUP}", targetSetup)
    .replaceAll("${ENTRY_ID}", String(identity.entryIndex))
    .replaceAll("${ENTRY_TIMESTAMP}", String(identity.timestamp))
    .replaceAll("${ORIGINAL_NOTE}", identity.originalNote)
    .replaceAll("${EDITED_NOTE}", identity.note);
  const flowPath = path.join(outputDirectory, `run-${runNumber}-cycle-${identity.entryIndex}.yaml`);
  writeFileSync(flowPath, flow);
  return flowPath;
}

function materializeFilter(outputDirectory, entries, size, referenceNow) {
  const editedEntries = applyNativeStressEditMutations(entries, pageBoundaryIds(size));
  const expectation = combinedFilterExpectation(editedEntries, { now: referenceNow });
  const firstMatchIndex = expectation.matchingEntryIndexes[0];
  const secondMatchIndex = expectation.matchingEntryIndexes[1];
  if (!firstMatchIndex || !secondMatchIndex) {
    throw new Error("The stress fixture must provide at least two matching identities after edit cycles.");
  }
  const firstMatch = fixtureIdentity(editedEntries, firstMatchIndex);
  const secondMatch = fixtureIdentity(editedEntries, secondMatchIndex);
  const firstNonMatch = fixtureIdentity(editedEntries, 2);
  const refreshNote = `QA refresh edit ${String(firstMatchIndex).padStart(4, "0")}`;
  const refreshedEntries = applyFixtureNoteEdits(editedEntries, [
    { entryIndex: firstMatchIndex, note: refreshNote },
  ]);
  const refreshedExpectation = combinedFilterExpectation(refreshedEntries, { now: referenceNow });
  const template = readFileSync(filterTemplatePath, "utf8");
  const flow = template
    .replaceAll("${FILTER_NOTE}", expectation.text)
    .replaceAll("${FILTER_COUNT}", String(expectation.count))
    .replaceAll("${REFRESH_FILTER_COUNT}", String(refreshedExpectation.count))
    .replaceAll("${TOTAL_COUNT}", String(size))
    .replaceAll("${FIRST_MATCH_TIMESTAMP}", String(firstMatch.timestamp))
    .replaceAll("${FIRST_MATCH_NOTE}", firstMatch.note)
    .replaceAll("${SECOND_MATCH_TIMESTAMP}", String(secondMatch.timestamp))
    .replaceAll("${SECOND_MATCH_NOTE}", secondMatch.note)
    .replaceAll("${FIRST_NON_MATCH_TIMESTAMP}", String(firstNonMatch.timestamp))
    .replaceAll("${FIRST_NON_MATCH_NOTE}", firstNonMatch.note)
    .replaceAll("${REFRESH_EDIT_NOTE}", refreshNote);
  const flowPath = path.join(outputDirectory, "native-stress-filters-materialized.yaml");
  writeFileSync(flowPath, flow);
  return {
    flowPath,
    expectation,
    refreshedExpectation,
    editedEntries,
    firstMatch,
    secondMatch,
    firstNonMatch,
    refreshMutation: { entryIndex: firstMatchIndex, note: refreshNote },
  };
}

function importCompletionTimeoutMs(size) {
  if (size === 1000) return 120000;
  if (size === 10000) return 600000;
  throw new Error(`Unsupported stress fixture size: ${size}.`);
}

async function importFixture(serial, fixtureName, size) {
  await runMaestro(serial, importFlow, { cwd: root });

  try {
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 3500 });
  } catch (error) {
    await waitForNodeAndTap(serial, { text: "Downloads", contains: true }, { timeoutMs: 2500 });
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 5000 });
  }

  await waitForNodeAndTap(serial, { text: "Replace Data" }, { timeoutMs: 5000 });
  await waitForNode(serial, { text: "Import Successful", contains: true }, {
    timeoutMs: importCompletionTimeoutMs(size),
  });
  await waitForNodeAndTap(serial, { text: "OK" }, { timeoutMs: 5000 });
}

async function settleImportedHistory(serial, expectedCount) {
  await waitForNodeAndTap(serial, { contentDescription: "Home tab, log your mood" }, { timeoutMs: 5000 });
  await waitForNode(serial, {
    allOf: [
      { testId: "history-count" },
      { text: `${expectedCount} total` },
    ],
  }, { timeoutMs: 30000 });
}

function startTrace(serial, {
  runAdbImpl = runAdb,
  timeoutMs = 5000,
} = {}) {
  try {
    runAdbImpl(serial, ["shell", "atrace", "--async_start", "-b", "8192", "gfx", "view", "sched", "freq"], {
      timeoutMs,
    });
    return { status: "started", available: true };
  } catch (error) {
    return {
      status: isToolUnavailable(error) ? "blocked" : "failed",
      available: false,
      error: error.message,
    };
  }
}

function stopTrace(serial, outputPath, traceState, {
  capture = captureText,
} = {}) {
  if (!traceState || traceState.status !== "started") {
    const error = traceState?.error ?? "atrace did not start";
    writeFileSync(outputPath, `TRACE NOT CAPTURED: ${error}\n`);
    return {
      ok: false,
      status: traceState?.status === "failed" ? "failed" : "blocked",
      error,
      output: "",
    };
  }

  const result = capture(serial, ["shell", "atrace", "--async_stop"], outputPath, {
    required: true,
    label: "atrace finalization",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!result.ok) {
    return {
      ...result,
      status: isToolUnavailable(result.error) ? "blocked" : "failed",
    };
  }
  if (!result.output.trim()) {
    return {
      ...result,
      ok: false,
      status: "failed",
      error: "atrace --async_stop returned no trace data.",
    };
  }
  return { ...result, status: "captured" };
}

function missingMetricFields(value, fields) {
  return fields.filter((field) => {
    const metric = value?.[field];
    return metric === null || metric === undefined || (typeof metric === "number" && Number.isNaN(metric));
  });
}

function summarizeRunEvidence({
  run,
  routeError = null,
  beforeMemory,
  boundaryMemory = [],
  afterMemory,
  gfxReset,
  gfx,
  trace,
}) {
  const requiredFailures = [];
  const checkCapture = (label, capture, parsed, fields) => {
    if (!capture?.ok) {
      requiredFailures.push({
        label,
        status: isToolUnavailable(capture?.error) ? "blocked" : "failed",
        error: capture?.error ?? "capture did not run",
      });
      return;
    }
    const missing = missingMetricFields(parsed, fields);
    if (missing.length) requiredFailures.push({ label, status: "failed", error: `Missing metrics: ${missing.join(", ")}` });
  };

  checkCapture("memory before", beforeMemory, parseMemInfo(beforeMemory?.output ?? ""), ["totalPssKb"]);
  boundaryMemory.forEach(({ entryId, capture }) => {
    checkCapture(`memory after entry ${entryId}`, capture, parseMemInfo(capture?.output ?? ""), ["totalPssKb"]);
  });
  checkCapture("memory after", afterMemory, parseMemInfo(afterMemory?.output ?? ""), ["totalPssKb"]);
  if (!gfxReset?.ok) {
    requiredFailures.push({
      label: "gfxinfo reset",
      status: isToolUnavailable(gfxReset?.error) ? "blocked" : "failed",
      error: gfxReset?.error ?? "capture did not run",
    });
  }
  const parsedGfx = parseGfxInfo(gfx?.output ?? "");
  checkCapture("gfxinfo", gfx, parsedGfx, ["totalFrames", "jankyFrames"]);
  if (gfx?.ok && !missingMetricFields(parsedGfx, ["totalFrames", "jankyFrames"]).length
      && parsedGfx.totalFrames <= 0) {
    requiredFailures.push({
      label: "gfxinfo",
      status: "failed",
      error: "Total frames rendered must be greater than zero.",
    });
  }
  if (!trace?.ok) requiredFailures.push({
    label: "scroll trace",
    status: trace?.status === "blocked" ? "blocked" : "failed",
    error: trace?.error ?? "trace was not finalized",
  });

  const status = evidenceStatus({ routeError, requiredFailures });
  return {
    run,
    status,
    acceptance: evidenceAcceptance(status),
    routeError: routeError?.message ?? null,
    trace: {
      status: trace?.status ?? "not-run",
      captured: trace?.status === "captured",
      error: trace?.error ?? null,
    },
    memoryBefore: parseMemInfo(beforeMemory?.output ?? ""),
    memoryAfter: parseMemInfo(afterMemory?.output ?? ""),
    memoryAfterBoundaries: boundaryMemory.map(({ entryId, capture }) => ({
      entryId,
      metrics: parseMemInfo(capture?.output ?? ""),
    })),
    frames: parseGfxInfo(gfx?.output ?? ""),
    memoryCaptureSucceeded: Boolean(beforeMemory?.ok && afterMemory?.ok && boundaryMemory.every(({ capture }) => capture.ok)),
    gfxCaptureSucceeded: Boolean(gfxReset?.ok && gfx?.ok),
    requiredEvidenceFailures: requiredFailures,
  };
}

function baseMetadata(options, sourceSha, entries, fixturePath, outputDirectory, referenceNow) {
  const editIndexes = pageBoundaryIds(options.size);
  const editedEntries = applyNativeStressEditMutations(entries, editIndexes);
  const filter = combinedFilterExpectation(editedEntries, { now: referenceNow });
  return {
    appId,
    label: options.label,
    datasetSize: options.size,
    runCount: options.runs,
    pageBoundaryIds: pageBoundaryIds(options.size),
    sourceSha,
    installedSourceSha: sourceSha,
    fixtureReferenceNow: referenceNow,
    command: `bun run qa:stress -- ${options.serial} --size ${options.size} --label ${options.label} --runs ${options.runs} --out ${outputDirectory}`,
    fabricatedFixture: fixturePath,
    fabricatedDataOnly: true,
    fabricatedDataProof: {
      entryCount: entries.length,
      combinedFilter: filter,
      editMutations: editIndexes.map((entryIndex) => ({
        entryIndex,
        note: nativeStressEditNote(entryIndex, entries[entryIndex - 1].note),
      })),
      firstMatchNote: editedEntries[filter.matchingEntryIndexes[0] - 1]?.note ?? null,
      firstNonMatchNote: editedEntries[1]?.note ?? null,
    },
    measurementPolicy: "Comparable evidence only; no performance improvement is inferred by this runner.",
  };
}

function pageBoundaryIds(size) {
  if (size === 1000) return [51, 501, 951];
  if (size === 10000) return [51, 5001, 9951];
  throw new Error(`Unsupported stress fixture size: ${size}.`);
}

function validateStressComparison(baseline, current) {
  for (const [label, summary] of [["baseline", baseline], ["current", current]]) {
    if (!summary?.sourceSha || summary.sourceSha !== summary.installedSourceSha) {
      throw new Error(`${label} source SHA does not match its installed QA binary.`);
    }
  }
  for (const field of ["datasetSize", "runCount"]) {
    if (baseline[field] !== current[field]) throw new Error(`Stress comparison requires equal ${field}.`);
  }
  for (const field of ["serial", "api", "model", "refreshRate"]) {
    if (baseline.device?.[field] !== current.device?.[field]) throw new Error(`Stress comparison requires equal device ${field}.`);
  }
  if (baseline.optionalDiagnostics?.thermal?.snapshot !== current.optionalDiagnostics?.thermal?.snapshot) {
    throw new Error("Stress comparison requires equal thermal conditions.");
  }
  return { baselineSourceSha: baseline.sourceSha, currentSourceSha: current.sourceSha };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const sourceSha = requireSourceSha();
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), `moodinator-native-stress-${options.label}-${options.size}-`));
  prepareEvidenceDirectory(outputDirectory);

  const fixtureReferenceNow = Date.now();
  const entries = createQaFixture(options.size, { now: fixtureReferenceNow });
  const fixtureName = `moodinator-qa-${options.size}.json`;
  const fixturePath = path.join(outputDirectory, fixtureName);
  const metadata = baseMetadata(options, sourceSha, entries, fixturePath, outputDirectory, fixtureReferenceNow);
  captureJson(outputDirectory, "metadata.json", metadata);
  const runSummaries = [];
  let finalStatus = null;

  try {
    await assertInstalledQaBuild(options.serial, sourceSha);
    writeFileSync(fixturePath, JSON.stringify(entries), { flag: "wx" });
    runAdb(options.serial, ["push", fixturePath, `/sdcard/Download/${fixtureName}`], { timeoutMs: 120000 });

    const device = {
      serial: options.serial,
      api: runAdb(options.serial, ["shell", "getprop", "ro.build.version.sdk"]).trim(),
      model: runAdb(options.serial, ["shell", "getprop", "ro.product.model"]).trim(),
      refreshRate: runAdb(options.serial, ["shell", "settings", "get", "system", "peak_refresh_rate"]).trim(),
    };
    const thermal = captureText(
      options.serial,
      ["shell", "dumpsys", "thermalservice"],
      path.join(outputDirectory, "device-thermalservice.txt"),
      { label: "optional thermal diagnostic" },
    );
    metadata.device = device;
    metadata.optionalDiagnostics = {
      thermal: { ok: thermal.ok, error: thermal.error ?? null, snapshot: thermal.output.trim() },
    };
    captureJson(outputDirectory, "metadata.json", metadata);

    for (let runNumber = 1; runNumber <= options.runs; runNumber++) {
      console.log(`Importing ${options.size} fabricated entries for route ${runNumber}/${options.runs}.`);
      await importFixture(options.serial, fixtureName, options.size);
      await settleImportedHistory(options.serial, options.size);

      const runPrefix = `run-${runNumber}`;
      const beforeMemoryPath = path.join(outputDirectory, `${runPrefix}-memory-before.txt`);
      const afterMemoryPath = path.join(outputDirectory, `${runPrefix}-memory-after.txt`);
      const gfxPath = path.join(outputDirectory, `${runPrefix}-gfxinfo.txt`);
      const tracePath = path.join(outputDirectory, `${runPrefix}-scroll-trace.txt`);
      const gfxReset = captureText(
        options.serial,
        ["shell", "dumpsys", "gfxinfo", appId, "reset"],
        path.join(outputDirectory, `${runPrefix}-gfxinfo-reset.txt`),
        { required: true, label: "required gfxinfo reset" },
      );
      const beforeMemory = captureText(
        options.serial,
        ["shell", "dumpsys", "meminfo", appId],
        beforeMemoryPath,
        { required: true, label: "required memory before" },
      );
      const traceState = startTrace(options.serial);
      const boundaryMemory = [];
      let routeError = null;
      let afterMemory;
      let gfx;
      let trace;

      try {
        for (const entryId of pageBoundaryIds(options.size)) {
          const identity = fixtureIdentity(entries, entryId, {
            editedNote: nativeStressEditNote(entryId, entries[entryId - 1].note),
          });
          console.log(`Stress route ${runNumber}: scrolling to recycled entry ${entryId}.`);
          const result = await runDeleteUndoAcceptance(
            options.serial,
            materializeCycle(outputDirectory, identity, runNumber, {
              indexedLookup: entryId > 51,
            }),
            {
              cwd: root,
              target: identity,
              waitOptions: {
                dumpTimeoutMs: 300,
                undoDumpTimeoutMs: 300,
                undoPollIntervalMs: 35,
                observeRestoredToast: true,
              },
            },
          );
          captureJson(outputDirectory, `${runPrefix}-undo-${entryId}.json`, {
            entryId,
            timestamp: identity.timestamp,
            beforeDelete: {
              note: result.identity.note,
              mood: result.identity.mood,
            },
            afterDelete: { visibleActionableExactIdentityAbsent: true },
            undo: {
              observedResourceId: result.undo.node["resource-id"] ?? null,
              tapPoint: result.undo.point,
            },
            restored: {
              exactIdentity: result.identity,
              exactlyOne: true,
            },
          });
          await waitForNodeHierarchyGone(options.serial, { testId: "restored-mood-toast" }, {
            timeoutMs: 5000,
          });
          const memory = captureText(
            options.serial,
            ["shell", "dumpsys", "meminfo", appId],
            path.join(outputDirectory, `${runPrefix}-memory-after-entry-${entryId}.txt`),
            { required: true, label: `required memory after entry ${entryId}` },
          );
          boundaryMemory.push({ entryId, capture: memory });
        }

        const filter = materializeFilter(outputDirectory, entries, options.size, fixtureReferenceNow);
        await runMaestro(options.serial, filter.flowPath, { cwd: root });
      } catch (error) {
        routeError = error;
      } finally {
        trace = stopTrace(options.serial, tracePath, traceState);
        afterMemory = captureText(
          options.serial,
          ["shell", "dumpsys", "meminfo", appId],
          afterMemoryPath,
          { required: true, label: "required memory after" },
        );
        gfx = captureText(
          options.serial,
          ["shell", "dumpsys", "gfxinfo", appId],
          gfxPath,
          { required: true, label: "required gfxinfo" },
        );
      }

      const summary = summarizeRunEvidence({
        run: runNumber,
        routeError,
        beforeMemory,
        boundaryMemory,
        afterMemory,
        gfxReset,
        gfx,
        trace,
      });
      runSummaries.push(summary);
      captureJson(outputDirectory, `${runPrefix}-summary.json`, summary);
      if (summary.status !== "passed") break;
    }

    const status = runSummaries.every((summary) => summary.status === "passed")
      ? "passed"
      : runSummaries.some((summary) => summary.status === "failed") ? "failed" : "blocked";
    finalStatus = status;
    const evidence = {
      ...metadata,
      status,
      acceptance: evidenceAcceptance(status),
      runs: runSummaries,
      comparison: null,
    };
    captureJson(outputDirectory, "summary.json", evidence);
    if (status !== "passed") throw new Error(`Native stress evidence was ${status}; required evidence was not accepted.`);
    console.log(`Native stress evidence: ${outputDirectory}`);
    console.log("Compare baseline and current summaries under identical device, refresh-rate, thermal, and run conditions; this command makes no improvement claim.");
  } catch (error) {
    const status = finalStatus
      ?? (runSummaries.some((summary) => summary.status === "failed") || !isToolUnavailable(error)
        ? "failed"
        : "blocked");
    captureJson(outputDirectory, "summary.json", {
      ...metadata,
      status,
      acceptance: evidenceAcceptance(status),
      runs: runSummaries,
      comparison: null,
      blocker: error.message,
    });
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  assertInstalledQaBuild,
  captureText,
  importCompletionTimeoutMs,
  materializeCycle,
  materializeFilter,
  pageBoundaryIds,
  parseOptions,
  prepareEvidenceDirectory,
  settleImportedHistory,
  startTrace,
  stopTrace,
  summarizeRunEvidence,
  validateStressComparison,
};
