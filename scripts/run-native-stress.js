const { execFileSync } = require("node:child_process");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const {
  combinedFilterExpectation,
  createQaFixture,
  fixtureIdentity,
} = require("./generate-qa-fixtures");
const {
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
  required = false,
  runAdbImpl = runAdb,
  label = args.join(" "),
} = {}) {
  try {
    const output = runAdbImpl(serial, args, { timeoutMs });
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

function installGuard(serial) {
  execFileSync("maestro", ["--version"], { stdio: "pipe", timeout: 15000 });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (!installed.trim().startsWith("package:")) {
    throw new Error(`The QA package ${appId} is not installed on ${serial}.`);
  }
}

function materializeCycle(outputDirectory, identity, runNumber) {
  const template = readFileSync(cycleTemplatePath, "utf8");
  const flow = template
    .replaceAll("${ENTRY_ID}", String(identity.entryIndex))
    .replaceAll("${ENTRY_TIMESTAMP}", String(identity.timestamp))
    .replaceAll("${ORIGINAL_NOTE}", identity.originalNote);
  const flowPath = path.join(outputDirectory, `run-${runNumber}-cycle-${identity.entryIndex}.yaml`);
  writeFileSync(flowPath, flow);
  return flowPath;
}

function materializeFilter(outputDirectory, entries, size, referenceNow) {
  const expectation = combinedFilterExpectation(entries, { now: referenceNow });
  const firstMatch = fixtureIdentity(entries, 1);
  const firstNonMatch = fixtureIdentity(entries, 2);
  const template = readFileSync(filterTemplatePath, "utf8");
  const flow = template
    .replaceAll("${FILTER_NOTE}", expectation.text)
    .replaceAll("${FILTER_COUNT}", String(expectation.count))
    .replaceAll("${TOTAL_COUNT}", String(size))
    .replaceAll("${FIRST_MATCH_TIMESTAMP}", String(firstMatch.timestamp))
    .replaceAll("${FIRST_MATCH_NOTE}", firstMatch.note)
    .replaceAll("${FIRST_NON_MATCH_TIMESTAMP}", String(firstNonMatch.timestamp))
    .replaceAll("${FIRST_NON_MATCH_NOTE}", firstNonMatch.note);
  const flowPath = path.join(outputDirectory, "native-stress-filters-materialized.yaml");
  writeFileSync(flowPath, flow);
  return { flowPath, expectation, firstMatch, firstNonMatch };
}

async function importFixture(serial, fixtureName) {
  await runMaestro(serial, importFlow, { cwd: root });

  try {
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 3500 });
  } catch (error) {
    await waitForNodeAndTap(serial, { text: "Downloads", contains: true }, { timeoutMs: 2500 });
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 5000 });
  }

  await waitForNodeAndTap(serial, { text: "Replace Data" }, { timeoutMs: 5000 });
  await waitForNode(serial, { text: "Import Successful", contains: true }, { timeoutMs: 15000 });
  await waitForNodeAndTap(serial, { text: "OK" }, { timeoutMs: 5000 });
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
  checkCapture("gfxinfo", gfx, parseGfxInfo(gfx?.output ?? ""), ["totalFrames", "jankyFrames"]);
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
  const filter = combinedFilterExpectation(entries, { now: referenceNow });
  return {
    appId,
    label: options.label,
    datasetSize: options.size,
    runCount: options.runs,
    pageBoundaryIds: pageBoundaryIds(options.size),
    sourceSha,
    fixtureReferenceNow: referenceNow,
    command: `bun run qa:stress -- ${options.serial} --size ${options.size} --label ${options.label} --runs ${options.runs} --out ${outputDirectory}`,
    fabricatedFixture: fixturePath,
    fabricatedDataOnly: true,
    fabricatedDataProof: {
      entryCount: entries.length,
      combinedFilter: filter,
      firstMatchNote: entries[0].note,
      firstNonMatchNote: entries[1].note,
    },
    measurementPolicy: "Comparable evidence only; no performance improvement is inferred by this runner.",
  };
}

function pageBoundaryIds(size) {
  return size === 1000 ? [51, 501, 951] : [51, 5001, 9951];
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const sourceSha = requireSourceSha();
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), `moodinator-native-stress-${options.label}-${options.size}-`));
  mkdirSync(outputDirectory, { recursive: true });

  const fixtureReferenceNow = Date.now();
  const entries = createQaFixture(options.size, { now: fixtureReferenceNow });
  const fixtureName = `moodinator-qa-${options.size}.json`;
  const fixturePath = path.join(outputDirectory, fixtureName);
  const metadata = baseMetadata(options, sourceSha, entries, fixturePath, outputDirectory, fixtureReferenceNow);
  captureJson(outputDirectory, "metadata.json", metadata);
  const runSummaries = [];
  let finalStatus = null;

  try {
    installGuard(options.serial);
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
      thermal: { ok: thermal.ok, error: thermal.error ?? null },
    };
    captureJson(outputDirectory, "metadata.json", metadata);

    for (let runNumber = 1; runNumber <= options.runs; runNumber++) {
      console.log(`Importing ${options.size} fabricated entries for route ${runNumber}/${options.runs}.`);
      await importFixture(options.serial, fixtureName);

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
            editedNote: `QA stress edit ${entryId}`,
          });
          console.log(`Stress route ${runNumber}: scrolling to recycled entry ${entryId}.`);
          const result = await runDeleteUndoAcceptance(
            options.serial,
            materializeCycle(outputDirectory, identity, runNumber),
            {
              cwd: root,
              target: identity,
              waitOptions: {
                dumpTimeoutMs: 300,
                undoDumpTimeoutMs: 300,
                undoPollIntervalMs: 35,
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
            afterDelete: { exactIdentityAbsent: true },
            undo: {
              observedResourceId: result.undo.node["resource-id"] ?? null,
              tapPoint: result.undo.point,
            },
            restored: {
              exactIdentity: result.identity,
              exactlyOne: true,
            },
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
      : runSummaries.some((summary) => summary.status === "blocked") ? "blocked" : "failed";
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
      ?? (runSummaries.some((summary) => summary.status === "blocked") || isToolUnavailable(error)
        ? "blocked"
        : "failed");
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
  captureText,
  materializeCycle,
  materializeFilter,
  pageBoundaryIds,
  parseOptions,
  startTrace,
  stopTrace,
  summarizeRunEvidence,
};
