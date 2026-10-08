import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { freemem, loadavg, totalmem } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { STARTUP_PHASES } from "../db/encryption/startup";

// Max runs this locally. It cannot select an existing simulator or a device.
assert.equal(process.platform, "darwin", "Run this handoff on Max's Mac with Xcode; Linux cannot establish iOS proof.");
assert.equal(process.env.MOODINATOR_VARIANT, "qa");
assert.equal(process.env.MOODINATOR_QA_ENCRYPTION_PROOF, "1");
const require = createRequire(import.meta.url);
const { readPreparedSourceSha } = require("./qa-source-provenance.js");
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
const xcrun = (arguments_: string[], timeout = 15000) => execFileSync("xcrun", arguments_, { encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024 });
const plist = (file: string, key: string) => execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, file], { encoding: "utf8", timeout: 5000 }).trim();
const workspaceNames = readdirSync("ios").filter((name) => name.endsWith(".xcworkspace"));
assert.equal(workspaceNames.length, 1, "Expected one CocoaPods-generated iOS workspace");
const workspace = path.resolve("ios", workspaceNames[0]);
const scheme = path.basename(workspace, ".xcworkspace");
mkdirSync(output, { recursive: true });
const evidence: {
  sourceSha: string; status: string; xcode: string; macOS: string;
  simulator?: { id: string; runtime: string; deviceType: string };
  appExecutableSha256?: string; bundleSha256?: string;
  results: unknown[]; failure?: string; simulatorRetained?: boolean;
} = {
  sourceSha, status: "running", results: [],
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

async function build() {
  resourceSample();
  const log = openSync(path.join(output, "xcodebuild.log"), "w");
  const child = spawn("/usr/bin/time", ["-l", "xcodebuild", "-workspace", workspace, "-scheme", scheme,
    "-configuration", "Release", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator",
    "-derivedDataPath", path.join(output, "DerivedData"), "-jobs", "1", "CODE_SIGNING_ALLOWED=NO", "build"],
  { detached: true, stdio: ["ignore", log, log] });
  const stopOwnedBuild = () => { if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ } } };
  const timer = setInterval(() => {
    try { resourceSample(); }
    catch (error) { evidence.failure = `Resource monitoring failed: ${String(error)}`; stopOwnedBuild(); }
  }, 15000);
  const timeout = setTimeout(() => { evidence.failure = "Owned Xcode build exceeded 45 minutes"; stopOwnedBuild(); }, 45 * 60000);
  process.once("SIGINT", stopOwnedBuild);
  process.once("SIGTERM", stopOwnedBuild);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(code, 0, evidence.failure || `Xcode build failed (${code}); return the first error from xcodebuild.log`);
    resourceSample();
  } finally {
    clearInterval(timer); clearTimeout(timeout);
    process.removeListener("SIGINT", stopOwnedBuild); process.removeListener("SIGTERM", stopOwnedBuild);
    closeSync(log);
  }
  readPreparedSourceSha(process.cwd(), process.env, "ios");
  const products = path.join(output, "DerivedData/Build/Products/Release-iphonesimulator");
  const apps = readdirSync(products).filter((name) => name.endsWith(".app"));
  assert.equal(apps.length, 1, "Expected one owned simulator Release app");
  const app = path.join(products, apps[0]);
  assert.equal(plist(path.join(app, "Info.plist"), "CFBundleIdentifier"), QA_ID, "Refusing a non-QA app");
  assert.equal(plist(path.join(app, "Info.plist"), "DTPlatformName"), "iphonesimulator");
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
  simctl(["openurl", `moodinator-qa:///?${new URLSearchParams({ ...parameters, runId })}`]);
  launched = true;
  return runId;
}

type ProofStatus = { sourceSha: unknown; runId: unknown; progress: string; result?: { status: string } };
async function wait(runId: string, predicate: (status: ProofStatus) => boolean) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
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

async function abruptStop() {
  // Resolve only this QA app inside this freshly created simulator, then check
  // its full installed executable path before sending an actual SIGKILL.
  const jobs = simctl(["spawn", "launchctl", "list"]).split(/\r?\n/);
  const job = jobs.find((line) => line.includes(`UIKitApplication:${QA_ID}[`));
  assert.ok(job, "Could not identify the owned QA process for abrupt interruption");
  const pid = Number(job.trim().split(/\s+/)[0]);
  assert.ok(Number.isSafeInteger(pid) && pid > 1);
  const command = execFileSync("ps", ["-ww", "-p", String(pid), "-o", "command="], { encoding: "utf8", timeout: 5000 }).trim();
  assert.ok(command === installedExecutable || command.startsWith(`${installedExecutable} `), "QA process ownership does not match; no signal sent");
  process.kill(pid, "SIGKILL");
  const alive = () => {
    try { process.kill(pid, 0); return true; }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
      throw error;
    }
  };
  const deadline = Date.now() + 10000;
  while (alive() && Date.now() < deadline) await delay(100);
  assert.equal(alive(), false, "Owned QA process did not exit after SIGKILL");
  launched = false;
}

try {
  const { app, executable } = await build(); // Compilation and simulator never overlap.
  const inventory: {
    runtimes: { identifier: string; name: string; version: string; isAvailable: boolean }[];
    devicetypes: { identifier: string; name: string }[];
    devices: Record<string, { deviceTypeIdentifier?: string; isAvailable: boolean }[]>;
  } = JSON.parse(xcrun(["simctl", "list", "--json"]));
  const runtime = inventory.runtimes.filter((item) => item.isAvailable && item.identifier.includes(".iOS-"))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  assert.ok(runtime, "An installed available iOS Simulator runtime is required; no runtime is installed by this runner");
  const compatibleTypes = (inventory.devices[runtime.identifier] ?? []).filter((item) => item.isAvailable).map((item) => item.deviceTypeIdentifier);
  const deviceType = [...inventory.devicetypes].reverse().find((item) => item.name.startsWith("iPhone") && compatibleTypes.includes(item.identifier))
    ?? [...inventory.devicetypes].reverse().find((item) => item.name.startsWith("iPhone"));
  assert.ok(deviceType, "An installed iPhone simulator device type is required");
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
  await result({ proof: "prepare-app" });
  await result({ proof: "verify-app" });
  await result({ proof: "verify-app" });
  const journeyRun = await launch({ proof: "journey" });
  await wait(journeyRun, (value) => value.progress === "launch");
  simctl(["io", "screenshot", path.join(output, "initial-launch.png")]);
  evidence.status = "passed";
  console.log("iOS Expo lifecycle cases passed. Manual app journey, inside-export interruption and disk/write-failure proof remain separate.");
  if (args.includes("--keep-simulator")) {
    evidence.simulatorRetained = true;
    console.log(`Owned simulator: ${simulator}\nEvidence: ${output}/report.json\nComplete the fabricated-data UI journey, then shutdown/delete only this simulator.`);
    execFileSync("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", simulator], { timeout: 15000 });
  }
} catch (error) {
  evidence.status = "failed";
  evidence.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  save();
  if (simulator && !evidence.simulatorRetained) {
    try { simctl(["shutdown"]); } catch { /* This runner owns only this UUID. */ }
    simctl(["delete"]);
  }
}
