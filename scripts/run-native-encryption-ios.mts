import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { freemem, loadavg, totalmem } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import startup from "../db/encryption/startup";
const { STARTUP_PHASES } = startup;

// Max runs this locally. It cannot select an existing simulator or a device.
assert.equal(process.platform, "darwin", "Run this handoff on Max's Mac with Xcode; Linux cannot establish iOS proof.");
assert.equal(process.env.MOODINATOR_VARIANT, "qa");
assert.equal(process.env.MOODINATOR_QA_ENCRYPTION_PROOF, "1");
const require = createRequire(import.meta.url);
const { readPreparedSourceSha } = require("./qa-source-provenance.js");
const { runIosProofLifecycle, runOwnedBuild, selectSimulatorProfile } = require("./native-encryption-ios.js");
const sourceSha: string = readPreparedSourceSha(process.cwd(), process.env, "ios");
const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--out="));
assert.ok(outputArg, "Use --out=/absolute/fresh/evidence-directory [--keep-simulator]");
assert.ok(args.every((arg) => arg === "--keep-simulator" || arg === outputArg), "Unknown or duplicate iOS proof argument");
const output = path.resolve(outputArg.slice("--out=".length));
assert.ok(path.isAbsolute(outputArg.slice("--out=".length)));
assert.ok(output !== process.cwd() && !output.startsWith(`${process.cwd()}${path.sep}`), "Evidence must be outside prepared source");
assert.ok(!existsSync(output), "Evidence directory already exists; retain it and choose a fresh directory");
const QA_ID = "com.lab4code.moodinator.qa";
let cancellationSignal: AbortSignal | undefined;
const rawXcrun = (arguments_: string[], timeout = 15000) => execFileSync("xcrun", arguments_, { encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024 });
const xcrun = (arguments_: string[], timeout?: number) => {
  cancellationSignal?.throwIfAborted();
  return rawXcrun(arguments_, timeout);
};
const plist = (file: string, key: string) => execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, file], { encoding: "utf8", timeout: 5000 }).trim();
const workspaceNames = readdirSync("ios").filter((name) => name.endsWith(".xcworkspace"));
assert.equal(workspaceNames.length, 1, "Expected one CocoaPods-generated iOS workspace");
const workspace = path.resolve("ios", workspaceNames[0]);
const scheme = path.basename(workspace, ".xcworkspace");
mkdirSync(output, { recursive: true });
const cacheDirectory = path.resolve(".expo", "ios-encryption-derived-data");
mkdirSync(cacheDirectory, { recursive: true });
const derivedData = realpathSync(cacheDirectory);
const evidence: {
  sourceSha: string; status: string; xcode: string; macOS: string;
  simulator?: { id: string; runtime: string; deviceType: string };
  appExecutableSha256?: string; bundleSha256?: string; simulatorSigning?: string; derivedDataPath?: string; simulatorInterface?: string;
  results: unknown[]; failure?: string; simulatorRetained?: boolean;
} = {
  sourceSha, status: "running", results: [], derivedDataPath: derivedData,
  xcode: execFileSync("xcodebuild", ["-version"], { encoding: "utf8", timeout: 15000 }).trim(),
  macOS: execFileSync("sw_vers", [], { encoding: "utf8", timeout: 5000 }).trim(),
};
const save = () => writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);

function resourceSample() {
  appendFileSync(path.join(output, "resources.jsonl"), `${JSON.stringify({
    time: new Date().toISOString(), freeBytes: freemem(), totalBytes: totalmem(), load: loadavg(),
    pages: execFileSync("vm_stat", [], { encoding: "utf8", timeout: 5000 }),
    pressure: execFileSync("memory_pressure", ["-Q"], { encoding: "utf8", timeout: 5000 }),
    disk: execFileSync("df", ["-k", output], { encoding: "utf8", timeout: 5000 }),
  })}\n`);
}

async function build(signal: AbortSignal) {
  const log = openSync(path.join(output, "xcodebuild.log"), "w");
  try {
    await runOwnedBuild("/usr/bin/time", ["-l", "xcodebuild", "-workspace", workspace, "-scheme", scheme,
      "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator",
      "-derivedDataPath", derivedData, "-jobs", "1", "CODE_SIGNING_ALLOWED=YES", "CODE_SIGN_IDENTITY=-", "DEVELOPMENT_TEAM=", "IPHONEOS_DEPLOYMENT_TARGET=15.1",
      `ARCHS=${process.arch === "arm64" ? "arm64" : "x86_64"}`, "build"],
    { stdio: ["ignore", log, log], sample: resourceSample, signal });
  } finally {
    closeSync(log);
  }
  readPreparedSourceSha(process.cwd(), process.env, "ios");
  const products = path.join(derivedData, "Build/Products/Release-iphonesimulator");
  const apps = readdirSync(products).filter((name) => name.endsWith(".app"));
  assert.equal(apps.length, 1, "Expected one owned simulator Release app");
  const app = path.join(products, apps[0]);
  assert.equal(plist(path.join(app, "Info.plist"), "CFBundleIdentifier"), QA_ID, "Refusing a non-QA app");
  assert.equal(plist(path.join(app, "Info.plist"), "DTPlatformName"), "iphonesimulator");
  evidence.simulatorSigning = "Xcode ad hoc, no development team or credentials";
  const executable = plist(path.join(app, "Info.plist"), "CFBundleExecutable");
  assert.equal(path.basename(executable), executable);
  evidence.appExecutableSha256 = createHash("sha256").update(readFileSync(path.join(app, executable))).digest("hex");
  evidence.bundleSha256 = createHash("sha256").update(readFileSync(path.join(app, "main.jsbundle"))).digest("hex");
  return { app, executable };
}

let simulator: string | undefined;
let launched = false;
let container = "";
let installedExecutable = "";
const simctl = (arguments_: string[], timeout?: number) => {
  assert.ok(simulator, "This runner has not created its simulator");
  return xcrun(["simctl", ...arguments_.slice(0, 1), simulator, ...arguments_.slice(1)], timeout);
};
const terminate = () => { if (launched) { simctl(["terminate", QA_ID]); launched = false; } };

async function launch(parameters: Record<string, string>) {
  terminate();
  const runId = randomUUID();
  // iOS 26 confirms custom-scheme links even when opened by simctl. Stage a
  // one-use request in this owned QA container before each real cold launch.
  writeFileSync(path.join(container, "Documents/encryption-proof-launch.txt"),
    `moodinator-qa:///?${new URLSearchParams({ ...parameters, runId })}`);
  simctl(["launch", QA_ID], 60000);
  launched = true;
  return runId;
}

type ProofStatus = { sourceSha: unknown; runId: unknown; progress: string; result?: { status: string } };
async function wait(runId: string, predicate: (status: ProofStatus) => boolean) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    cancellationSignal?.throwIfAborted();
    const statusFile = path.join(container, "Documents/encryption-proof-status.json");
    if (existsSync(statusFile)) {
      let status: ProofStatus;
      try { status = JSON.parse(readFileSync(statusFile, "utf8")); }
      catch { await delay(150); continue; } // A native write may still be in progress.
      if (status.runId === runId) {
        assert.equal(status.sourceSha, sourceSha, "Installed app does not match prepared source");
        assert.notEqual(status.progress, "failed", JSON.stringify(status));
        if (predicate(status)) return status;
      }
    }
    await delay(150);
  }
  throw new Error("Native proof timed out; retain report and Simulator error screen");
}

async function result(parameters: Record<string, string>) {
  const runId = await launch(parameters);
  const status = await wait(runId, (value) => value.progress === "complete");
  assert.equal(status.result?.status, "passed", JSON.stringify(status));
  evidence.results.push({ action: parameters, report: status });
  save();
  console.log(`Passed iOS ${parameters.proof}${parameters.case ? `:${parameters.case}` : ""}`);
}

function ownedProcess() {
  // Resolve only this QA app inside this freshly created simulator, then check
  // its full installed executable path before sending an actual SIGKILL.
  const jobs = simctl(["spawn", "launchctl", "list"]).split(/\r?\n/);
  const job = jobs.find((line) => line.includes(`UIKitApplication:${QA_ID}[`));
  assert.ok(job, "Could not identify the owned QA process for abrupt interruption");
  const pid = Number(job.trim().split(/\s+/)[0]);
  assert.ok(Number.isSafeInteger(pid) && pid > 1);
  requireOwnedProcess(pid);
  return pid;
}

function requireOwnedProcess(pid: number) {
  const command = execFileSync("ps", ["-ww", "-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 5000 }).trim();
  assert.ok(command === installedExecutable || command.startsWith(`${installedExecutable} `), "QA process ownership does not match; no signal sent");
}

async function abruptStop(beforeKill?: () => void, pid = ownedProcess()) {
  requireOwnedProcess(pid);
  beforeKill?.();
  process.kill(pid, "SIGKILL");
  const alive = () => {
    try { process.kill(pid, 0); return true; }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
      throw error;
    }
  };
  const deadline = Date.now() + 10000;
  while (alive() && Date.now() < deadline) {
    cancellationSignal?.throwIfAborted();
    await delay(100);
  }
  assert.equal(alive(), false, "Owned QA process did not exit after SIGKILL");
  launched = false;
}

async function runProof(signal: AbortSignal) {
  cancellationSignal = signal;
  const { app, executable } = await build(signal); // Compilation and simulator never overlap.
  const { runtime, deviceType } = selectSimulatorProfile(JSON.parse(xcrun(["simctl", "list", "--json"])));
  simulator = xcrun(["simctl", "create", `Moodinator-118-${sourceSha.slice(0, 8)}-${Date.now()}`, deviceType.identifier, runtime.identifier]).trim();
  assert.match(simulator, /^[0-9A-F-]{36}$/i);
  evidence.simulator = { id: simulator, runtime: runtime.name, deviceType: deviceType.name };
  simctl(["boot"]);
  simctl(["bootstatus", "-b"], 180000);
  simctl(["install", app], 60000);
  container = simctl(["get_app_container", QA_ID, "data"]).trim();
  const installedApp = simctl(["get_app_container", QA_ID, "app"]).trim();
  assert.ok(container.includes(`/${simulator}/data/Containers/Data/Application/`));
  assert.ok(installedApp.includes(`/${simulator}/data/Containers/Bundle/Application/`));
  installedExecutable = path.join(installedApp, executable);
  await result({ proof: "suite" });
  for (const caseName of ["plaintext", "legacy-passphrase", "legacy-orphans", "fresh"]) await result({ proof: "resume", case: caseName });
  await result({ proof: "lose-key" });
  await result({ proof: "verify-lost-key" });
  const walRun = await launch({ proof: "wal-crash" });
  await wait(walRun, (value) => value.progress === "paused:wal-source:committed-wal");
  await abruptStop();
  await result({ proof: "resume", case: "wal-source" });
  for (const [index, phase] of STARTUP_PHASES.entries()) {
    const caseName = `crash-${index}`;
    const runId = await launch({ proof: "crash", case: caseName, phase });
    await wait(runId, (value) => value.progress === `paused:${caseName}:${phase}`);
    await abruptStop();
    await result({ proof: "resume", case: caseName });
    await result({ proof: "resume", case: caseName });
  }
  await result({ proof: "write-failure" });
  await result({ proof: "verify-write-failure" });
  await result({ proof: "resume", case: "native-write-failure" });
  const exportRun = await launch({ proof: "export-interruption" });
  const exportPid = ownedProcess();
  const exportTarget = path.join(container, "Documents/encryption-proof/native-export-interruption/moodinator.encrypted-v2.db");
  const exportStatusFile = path.join(container, "Documents/encryption-proof-status.json");
  const partialExport = () => {
    const status: ProofStatus = JSON.parse(readFileSync(exportStatusFile, "utf8"));
    assert.equal(status.sourceSha, sourceSha);
    assert.equal(status.runId, exportRun);
    assert.equal(status.progress, "running:native-export-interruption:export-started");
    const bytes = statSync(exportTarget).size;
    assert.ok(bytes > 256 * 1024 && bytes < 32 * 1024 * 1024, `Export is not demonstrably partial: ${bytes} bytes`);
    return { bytes, observedAt: new Date().toISOString(), progress: status.progress };
  };
  const exportDeadline = Date.now() + 180000;
  let observedPartial = false;
  while (Date.now() < exportDeadline) {
    signal.throwIfAborted();
    if (existsSync(exportStatusFile) && existsSync(exportTarget)) {
      let status: ProofStatus | undefined;
      try { status = JSON.parse(readFileSync(exportStatusFile, "utf8")); } catch { /* Native status write in progress. */ }
      if (status?.runId === exportRun) {
        assert.equal(status.sourceSha, sourceSha);
        assert.notEqual(status.progress, "failed", JSON.stringify(status));
        assert.notEqual(status.progress, "running:native-export-interruption:export-closed", "Export completed before SIGKILL");
        if (status.progress === "running:native-export-interruption:export-started" && statSync(exportTarget).size > 256 * 1024) {
          const first = partialExport();
          let atKill: ReturnType<typeof partialExport> | undefined;
          await abruptStop(() => { atKill = partialExport(); }, exportPid);
          assert.ok(atKill);
          assert.ok(existsSync(path.join(path.dirname(exportTarget), "moodinator.db")), "Interrupted source must remain");
          evidence.results.push({ action: { proof: "export-interruption" }, runId: exportRun,
            report: { status: "passed", first, atKill, signal: "SIGKILL", evidence: "partial native target below half payload size immediately before actual owned-process kill; cold recovery required" } });
          save();
          observedPartial = true;
          break;
        }
      }
    }
    await delay(10);
  }
  assert.ok(observedPartial, "No partial native export was observed before interruption timeout");
  await result({ proof: "resume", case: "native-export-interruption" });
  await result({ proof: "resume", case: "native-export-interruption" });
  await result({ proof: "prepare-app" });
  await result({ proof: "verify-app" });
  await result({ proof: "verify-app" });
  const journeyRun = await launch({ proof: "journey" });
  await wait(journeyRun, (value) => value.progress === "launch");
  simctl(["io", "screenshot", path.join(output, "initial-launch.png")]);
  console.log("iOS Expo lifecycle cases passed. Native partial-export interruption and destination SQLITE_FULL recovery passed. Manual app journey and host-volume disk exhaustion remain separate.");
}

await runIosProofLifecycle({
  evidence, save, run: runProof, keepSimulator: args.includes("--keep-simulator"),
  shutdown: (id: string) => rawXcrun(["simctl", "shutdown", id]),
  deleteSimulator: (id: string) => rawXcrun(["simctl", "delete", id]),
  openSimulator: (id: string) => {
    const developerDirectory = execFileSync("xcode-select", ["-p"], { encoding: "utf8", timeout: 5000 }).trim();
    const simulatorApp = path.join(developerDirectory, "Applications/Simulator.app");
    if (existsSync(simulatorApp)) {
      execFileSync("open", ["-a", simulatorApp, "--args", "-CurrentDeviceUDID", id], { timeout: 15000 });
      evidence.simulatorInterface = "Xcode Simulator window";
    } else {
      evidence.simulatorInterface = "Device panel; Simulator.app is not installed";
      console.log(`Normal QA app is running on owned simulator ${id}. Open it in the T3 Code Device panel for the visible journey.`);
    }
  },
});
if (evidence.simulatorRetained) {
  console.log(`Owned simulator: ${simulator}\nEvidence: ${output}/report.json\nComplete the fabricated-data UI journey, then shutdown/delete only this simulator.`);
}
