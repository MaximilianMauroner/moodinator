const {
  execFileSync,
} = require("node:child_process");
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { createQaFixture } = require("./generate-qa-fixtures");
const {
  parseGfxInfo,
  parseMemInfo,
  runAdb,
  waitForNode,
  waitForNodeAndTap,
} = require("./native-ui");
const { runMaestro, runMaestroAndTapUndo } = require("./native-qa-runner");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");
const importFlow = path.join(root, ".maestro/flows/native-stress-import.yaml");
const cycleTemplatePath = path.join(root, ".maestro/flows/native-stress-cycle.yaml");
const filterFlow = path.join(root, ".maestro/flows/native-stress-filters.yaml");

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: bun run qa:stress -- emulator-5554 --size 1000|10000 --label baseline|current [--runs 2] [--out /tmp/evidence]"
  );
  process.exit(1);
}

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) {
    usage("The first argument must be a disposable emulator serial such as emulator-5554.");
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
    if (!value) usage(`Missing value for ${flag}.`);

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
        usage(`Unknown option ${flag}.`);
    }
  }

  if (![1000, 10000].includes(options.size)) usage("--size must be 1000 or 10000.");
  if (!options.label || !/^[\w.-]+$/.test(options.label)) usage("--label must contain only letters, numbers, dot, dash, or underscore.");
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 5) usage("--runs must be an integer from 1 to 5.");

  return options;
}

function captureText(serial, args, outputPath) {
  try {
    const output = runAdb(serial, args, { timeoutMs: 30000 });
    writeFileSync(outputPath, output);
    return { output, ok: true };
  } catch (error) {
    const output = `COMMAND: adb -s ${serial} ${args.join(" ")}\nERROR: ${error.message}\n`;
    writeFileSync(outputPath, output);
    return { output, ok: false, error: error.message };
  }
}

function captureJson(outputDirectory, name, value) {
  writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
}

function installGuard(serial) {
  execFileSync("maestro", ["--version"], { stdio: "pipe" });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], {
    encoding: "utf8",
  });
  if (!installed.trim().startsWith("package:")) {
    throw new Error(`The QA package ${appId} is not installed on ${serial}.`);
  }
}

function materializeCycle(outputDirectory, entryId, runNumber) {
  const template = readFileSync(cycleTemplatePath, "utf8");
  const flow = template.replaceAll("${ENTRY_ID}", String(entryId));
  const flowPath = path.join(outputDirectory, `run-${runNumber}-cycle-${entryId}.yaml`);
  writeFileSync(flowPath, flow);
  return flowPath;
}

async function importFixture(serial, fixtureName) {
  await runMaestro(serial, importFlow, { cwd: root });

  try {
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 3500 });
  } catch (error) {
    // DocumentsUI may open in Recent with the Downloads root collapsed. The
    // root is discovered from the hierarchy as well; neither action assumes a
    // screen coordinate.
    await waitForNodeAndTap(serial, { text: "Downloads", contains: true }, { timeoutMs: 2500 });
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 5000 });
  }

  await waitForNodeAndTap(serial, { text: "Replace Data" }, { timeoutMs: 5000 });
  await waitForNode(serial, { text: "Import Successful", contains: true }, { timeoutMs: 15000 });
  await waitForNodeAndTap(serial, { text: "OK" }, { timeoutMs: 5000 });
}

function startTrace(serial) {
  try {
    runAdb(serial, ["shell", "atrace", "--async_start", "-b", "8192", "gfx", "view", "sched", "freq"], {
      timeoutMs: 5000,
    });
    return { available: true };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

function stopTrace(serial, outputPath, traceState) {
  if (!traceState.available) {
    writeFileSync(outputPath, `atrace unavailable: ${traceState.error}\n`);
    return;
  }

  const result = captureText(serial, ["shell", "atrace", "--async_stop"], outputPath);
  if (!result.ok) return;
}

function pageBoundaryIds(size) {
  return size === 1000 ? [51, 501, 951] : [51, 5001, 9951];
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  installGuard(options.serial);

  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), `moodinator-native-stress-${options.label}-${options.size}-`));
  mkdirSync(outputDirectory, { recursive: true });

  const entries = createQaFixture(options.size);
  const fixtureName = `moodinator-qa-${options.size}.json`;
  const fixturePath = path.join(outputDirectory, fixtureName);
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
  );
  device.thermalCaptureSucceeded = thermal.ok;
  const metadata = {
    appId,
    label: options.label,
    datasetSize: options.size,
    runs: options.runs,
    pageBoundaryIds: pageBoundaryIds(options.size),
    sourceSha: (() => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
      } catch {
        return "unknown";
      }
    })(),
    command: `bun run qa:stress -- ${options.serial} --size ${options.size} --label ${options.label} --runs ${options.runs} --out ${outputDirectory}`,
    device,
    fabricatedFixture: fixturePath,
    measurementPolicy: "Comparable evidence only; no performance improvement is inferred by this runner.",
  };
  captureJson(outputDirectory, "metadata.json", metadata);

  const runSummaries = [];
  for (let runNumber = 1; runNumber <= options.runs; runNumber++) {
    console.log(`Importing ${options.size} fabricated entries for route ${runNumber}/${options.runs}.`);
    await importFixture(options.serial, fixtureName);

    const runPrefix = `run-${runNumber}`;
    const beforeMemoryPath = path.join(outputDirectory, `${runPrefix}-memory-before.txt`);
    const afterMemoryPath = path.join(outputDirectory, `${runPrefix}-memory-after.txt`);
    const gfxPath = path.join(outputDirectory, `${runPrefix}-gfxinfo.txt`);
    const tracePath = path.join(outputDirectory, `${runPrefix}-scroll-trace.txt`);

    captureText(options.serial, ["shell", "dumpsys", "gfxinfo", appId, "reset"], path.join(outputDirectory, `${runPrefix}-gfxinfo-reset.txt`));
    const beforeMemory = captureText(options.serial, ["shell", "dumpsys", "meminfo", appId], beforeMemoryPath);
    const traceState = startTrace(options.serial);

    let afterMemory;
    let gfx;
    try {
      for (const entryId of pageBoundaryIds(options.size)) {
        console.log(`Stress route ${runNumber}: scrolling to recycled entry ${entryId}.`);
        const undoPromise = runMaestroAndTapUndo(
          options.serial,
          materializeCycle(outputDirectory, entryId, runNumber),
          { cwd: root },
        );
        const undo = await undoPromise;

        const timestamp = entries[entryId - 1]?.timestamp;
        if (timestamp === undefined) {
          throw new Error(`Fixture does not contain the expected entry index ${entryId}.`);
        }

        await waitForNode(
          options.serial,
          { testId: `mood-entry-stable-${timestamp}` },
          { timeoutMs: 3000 },
        );
        captureJson(outputDirectory, `${runPrefix}-undo-${entryId}.json`, {
          entryId,
          timestamp,
          observedResourceId: undo.node["resource-id"] ?? null,
          tapPoint: undo.point,
        });
        captureText(
          options.serial,
          ["shell", "dumpsys", "meminfo", appId],
          path.join(outputDirectory, `${runPrefix}-memory-after-entry-${entryId}.txt`),
        );
      }

    await runMaestro(options.serial, filterFlow, { cwd: root });
    } finally {
      stopTrace(options.serial, tracePath, traceState);
      afterMemory = captureText(options.serial, ["shell", "dumpsys", "meminfo", appId], afterMemoryPath);
      gfx = captureText(options.serial, ["shell", "dumpsys", "gfxinfo", appId], gfxPath);
    }

    const summary = {
      run: runNumber,
      trace: traceState.available ? "captured" : `unavailable: ${traceState.error}`,
      memoryBefore: parseMemInfo(beforeMemory.output),
      memoryAfter: parseMemInfo(afterMemory.output),
      frames: parseGfxInfo(gfx.output),
      memoryCaptureSucceeded: beforeMemory.ok && afterMemory.ok,
      gfxCaptureSucceeded: gfx.ok,
    };
    runSummaries.push(summary);
    captureJson(outputDirectory, `${runPrefix}-summary.json`, summary);
  }

  captureJson(outputDirectory, "summary.json", {
    ...metadata,
    runs: runSummaries,
    comparison: null,
  });
  console.log(`Native stress evidence: ${outputDirectory}`);
  console.log("Compare baseline and current summaries under identical device, refresh-rate, thermal, and run conditions; this command makes no improvement claim.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
