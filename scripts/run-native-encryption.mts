import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import startup from "../db/encryption/startup";
const { STARTUP_PHASES } = startup;

const require = createRequire(import.meta.url);
const { requirePreparedSourceSha, packageIsDebuggable } = require("./native-qa-common.js");
const { waitForNode } = require("./native-ui.js");
const QA_ID = "com.lab4code.moodinator.qa";
const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Use --name=value arguments: ${argument}`);
  return [match[1], match[2]];
}));
for (const name of ["avd-root", "avd", "port", "apk", "out"]) assert.ok(options[name], `Missing --${name}`);
const sourceSha: string = requirePreparedSourceSha(process.cwd());
const sdk = process.env.ANDROID_HOME;
assert.ok(sdk, "Set ANDROID_HOME to the owned local SDK");
const adb = path.join(sdk, "platform-tools/adb");
const emulator = path.join(sdk, "emulator/emulator");
assert.ok(existsSync(adb) && existsSync(emulator), "Local SDK native tools are required");
const avdRoot = realpathSync(options["avd-root"]);
assert.ok(avdRoot.startsWith(`${realpathSync(tmpdir())}${path.sep}`), "Only a disposable temporary AVD root is allowed");
assert.equal(options.avd, "moodinator-issue45", "This runner owns only its issue45 disposable AVD");
const avdPath = realpathSync(path.join(avdRoot, `${options.avd}.avd`));
assert.equal(path.dirname(avdPath), avdRoot);
const ini = readFileSync(path.join(avdRoot, `${options.avd}.ini`), "utf8");
assert.ok(ini.split(/\r?\n/).includes(`path=${avdPath}`), "AVD definition must point inside the owned temporary root");
const port = Number(options.port);
assert.ok(Number.isInteger(port) && port >= 5554 && port <= 5682 && port % 2 === 0, "Use an explicit valid emulator port");
const serial = `emulator-${port}`;
const runAdb = (args: string[], timeout = 15000) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", timeout });
const shellQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
assert.ok(!execFileSync(adb, ["devices"], { encoding: "utf8", timeout: 15000 }).split(/\r?\n/).some((line) => line.startsWith(`${serial}\t`)), "Refusing to use an already running emulator");
const output = path.resolve(options.out);
mkdirSync(output, { recursive: true });
const apk = realpathSync(options.apk);
const badging = execFileSync(path.join(sdk, "build-tools/36.0.0/aapt2"), ["dump", "badging", apk], { encoding: "utf8", timeout: 15000 });
assert.ok(badging.includes(`package: name='${QA_ID}'`), "Refusing to install an APK outside the separate QA package");
assert.ok(!badging.includes("application-debuggable"), "The supplied QA APK must be a non-debuggable release");
const archive = execFileSync("unzip", ["-Z1", apk], { encoding: "utf8", timeout: 15000 }).split(/\r?\n/);
assert.ok(archive.includes("lib/x86_64/libcrypto.so"), "QA APK is missing native x86_64 OpenSSL");
assert.ok(archive.includes("lib/x86_64/libexpo-sqlite.so"), "QA APK is missing native x86_64 Expo SQLite");
writeFileSync(path.join(output, "apk-badging.txt"), badging);
const evidence: { sourceSha: string; apkSha256: string; serial: string; status: string; results: unknown[]; failure?: string } = {
  sourceSha, apkSha256: createHash("sha256").update(readFileSync(apk)).digest("hex"), serial, status: "running", results: [],
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = openSync(path.join(output, "emulator.log"), "w");
const owned = spawn(emulator, ["-avd", options.avd, "-port", String(port), "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot", "-gpu", "swiftshader", "-memory", "1024", "-cores", "2"], {
  env: { ...process.env, ANDROID_AVD_HOME: avdRoot, ANDROID_USER_HOME: path.join(avdRoot, "android-user") },
  stdio: ["ignore", log, log],
});
let emulatorExited = false;
let appDataDirectory = "";
let appUid = "";
owned.on("exit", () => { emulatorExited = true; });
owned.on("error", (error) => { evidence.failure = error.message; emulatorExited = true; });

async function launch(params: Record<string, string>) {
  runAdb(["shell", "am", "force-stop", QA_ID]);
  const runId = randomUUID();
  const url = `moodinator-qa:///?${new URLSearchParams({ ...params, runId })}`;
  runAdb(["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", shellQuote(url), QA_ID]);
  await waitForNode(serial, { testId: `qa-source-sha-${sourceSha}` }, { adbPath: adb, timeoutMs: 45000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
  return runId;
}
async function result(params: Record<string, string>) {
  const runId = await launch(params);
  const node = await waitForNode(serial, { testId: "encryption-proof-result" }, { adbPath: adb, timeoutMs: 60000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
  const prefix = "encryption-proof-result:";
  assert.ok(node["content-desc"].startsWith(prefix));
  const report = JSON.parse(node["content-desc"].slice(prefix.length));
  assert.equal(report.sourceSha, sourceSha);
  evidence.results.push({ action: params, runId, report });
  assert.equal(report.result.status, "passed", JSON.stringify(report));
  writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Passed native ${params.proof}${params.case ? `:${params.case}` : ""}`);
  return report;
}

type ProofStatus = { sourceSha: unknown; runId: unknown; progress: string; result?: unknown };
function commandErrorText(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const output = "stderr" in error ? String(error.stderr) : "";
  return `${error.message}\n${output}`;
}
function readProofStatus(runId: string): ProofStatus | null {
  const statusFile = path.posix.join(appDataDirectory, "files/encryption-proof-status.json");
  try {
    const status = JSON.parse(runAdb(["exec-out", "cat", statusFile], 3000)) as ProofStatus;
    if (status.runId !== runId) return null;
    assert.equal(status.sourceSha, sourceSha, "Installed app does not match prepared source");
    assert.notEqual(status.progress, "failed", JSON.stringify(status));
    return status;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    if (/No such file|does not exist/i.test(commandErrorText(error))) return null;
    throw error;
  }
}

function appPidValue() {
  try { return runAdb(["shell", "pidof", QA_ID], 3000).trim(); }
  catch (error) {
    if (error instanceof Error && "status" in error && error.status === 1) return "";
    throw error;
  }
}

async function abruptlyStopOwnedApp(beforeStop: () => unknown) {
  assert.match(appPidValue(), /^\d+$/, "Could not identify one owned QA process");
  const before = beforeStop();
  runAdb(["shell", "am", "force-stop", QA_ID], 3000);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const current = appPidValue();
    if (!current) return { before, after: beforeStop() };
    await delay(100);
  }
  throw new Error("Owned QA process did not exit after package-scoped force-stop");
}

async function interruptNativeExport(shape: "many-rows" | "single-cell") {
  const caseName = `native-export-interruption-${shape}`;
  const runId = await launch({ proof: "export-interruption", shape });
  const caseDirectory = path.posix.join(appDataDirectory, "files/encryption-proof", caseName);
  const target = path.posix.join(caseDirectory, "moodinator.encrypted-v2.db");
  const source = path.posix.join(caseDirectory, "moodinator.db");
  const partialExport = () => {
    const status = readProofStatus(runId);
    assert.equal(status?.progress, `running:${caseName}:export-started`);
    const bytes = Number(runAdb(["shell", "stat", "-c", "%s", target], 3000).trim());
    assert.ok(bytes > 256 * 1024 && bytes < 32 * 1024 * 1024, `Export is not demonstrably partial: ${bytes} bytes`);
    return { bytes, observedAt: new Date().toISOString(), progress: status.progress };
  };
  const deadline = Date.now() + 180000;
  let proof: { first: ReturnType<typeof partialExport>; beforeStop: ReturnType<typeof partialExport>; afterStop: ReturnType<typeof partialExport> } | null = null;
  while (Date.now() < deadline) {
    const status = readProofStatus(runId);
    if (status) {
      assert.notEqual(status.progress, `running:${caseName}:export-closed`, "Export completed before package-scoped termination");
      if (status.progress === `running:${caseName}:export-started`) {
        let first: ReturnType<typeof partialExport>;
        try {
          first = partialExport();
        } catch (error) {
          if (!/No such file|not demonstrably partial/.test(commandErrorText(error))) throw error;
          await delay(20);
          continue;
        }
        const stopped = await abruptlyStopOwnedApp(partialExport) as { before: ReturnType<typeof partialExport>; after: ReturnType<typeof partialExport> };
        proof = { first, beforeStop: stopped.before, afterStop: stopped.after };
        break;
      }
    }
    await delay(20);
  }
  assert.ok(proof, `No partial ${shape} native export was observed before interruption timeout`);
  runAdb(["shell", "test", "-f", source], 3000);
  evidence.results.push({
    action: { proof: "export-interruption", shape },
    runId,
    report: { status: "passed", ...proof, termination: "package-scoped force-stop", sourceRetained: true,
      evidence: "partial native target remained incomplete after actual owned-package termination; cold recovery required" },
  });
  writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  await result({ proof: "resume", case: caseName });
  await result({ proof: "resume", case: caseName });
}

try {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    assert.ok(!emulatorExited, evidence.failure || "Owned emulator exited before boot");
    try { if (runAdb(["shell", "getprop", "sys.boot_completed"], 5000).trim() === "1") break; }
    catch { /* The owned emulator has not attached to ADB yet. */ }
    await delay(1000);
  }
  assert.equal(runAdb(["shell", "getprop", "sys.boot_completed"]).trim(), "1", "Owned emulator did not finish booting");
  execFileSync(adb, ["-s", serial, "root"], { encoding: "utf8", timeout: 15000 });
  execFileSync(adb, ["-s", serial, "wait-for-device"], { encoding: "utf8", timeout: 15000 });
  runAdb(["install", "--no-streaming", apk], 60000);
  const packageDump = runAdb(["shell", "dumpsys", "package", QA_ID]);
  assert.equal(packageIsDebuggable(packageDump), false, "Native acceptance needs a non-debuggable QA release");
  appDataDirectory = packageDump.match(/\bdataDir=(\/\S+)/)?.[1] ?? "";
  appUid = packageDump.match(/\buserId=(\d+)/)?.[1] ?? "";
  assert.equal(appDataDirectory, `/data/user/0/${QA_ID}`, "Unexpected owned QA data directory");
  assert.match(appUid, /^\d+$/, "Installed QA package UID is missing");
  assert.equal(runAdb(["shell", "pm", "clear", QA_ID]).trim(), "Success");
  const preferencesDirectory = path.posix.join(appDataDirectory, "shared_prefs");
  runAdb(["shell", "mkdir", "-p", preferencesDirectory]);
  runAdb(["shell", "chown", `${appUid}:${appUid}`, preferencesDirectory]);
  runAdb(["shell", "restorecon", "-RF", preferencesDirectory]);
  assert.equal(runAdb(["shell", "ls", "-A", preferencesDirectory]).trim(), "", "Durability proof requires empty QA preferences");
  runAdb(["shell", "chmod", "0555", preferencesDirectory]);
  assert.equal(runAdb(["shell", "stat", "-c", "%a", preferencesDirectory]).trim(), "555");
  try {
    const report = await result({ proof: "durable-write-failure" });
    evidence.results.push({ action: { host: "durable-write-failure" }, report: {
      preferencesMode: "0555",
      preferencesFilesAfterFailure: runAdb(["shell", "ls", "-A", preferencesDirectory]).trim(),
      result: report.result,
    } });
  } finally {
    runAdb(["shell", "am", "force-stop", QA_ID]);
    runAdb(["shell", "chmod", "0700", preferencesDirectory]);
  }
  assert.equal(runAdb(["shell", "stat", "-c", "%a", preferencesDirectory]).trim(), "700");
  await result({ proof: "resume", case: "native-durable-write-failure" });
  await result({ proof: "resume", case: "native-durable-write-failure" });
  await result({ proof: "suite" });
  // Cold process restarts also read native SecureStore instead of a JS cache.
  await result({ proof: "resume", case: "plaintext" });
  await result({ proof: "resume", case: "legacy-passphrase" });
  await result({ proof: "resume", case: "legacy-orphans" });
  await result({ proof: "resume", case: "fresh" });
  await result({ proof: "lose-key" });
  await result({ proof: "verify-lost-key" });
  await launch({ proof: "wal-crash" });
  await waitForNode(serial, { contentDescription: "encryption-proof:paused:wal-source:committed-wal" }, { adbPath: adb, timeoutMs: 60000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
  runAdb(["shell", "am", "force-stop", QA_ID]);
  await result({ proof: "resume", case: "wal-source" });
  for (const [index, phase] of STARTUP_PHASES.entries()) {
    const caseName = `crash-${index}`;
    await launch({ proof: "crash", case: caseName, phase });
    await waitForNode(serial, { contentDescription: `encryption-proof:paused:${caseName}:${phase}` }, { adbPath: adb, timeoutMs: 60000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
    runAdb(["shell", "am", "force-stop", QA_ID]);
    await result({ proof: "resume", case: caseName });
    await result({ proof: "resume", case: caseName });
  }
  await result({ proof: "write-failure" });
  await result({ proof: "verify-write-failure" });
  await result({ proof: "resume", case: "native-write-failure" });
  await interruptNativeExport("many-rows");
  await interruptNativeExport("single-cell");
  await result({ proof: "prepare-app" });
  await result({ proof: "verify-app" });
  await result({ proof: "verify-app" });
  await launch({ proof: "journey" });
  execFileSync(adb, ["-s", serial, "exec-out", "screencap", "-p"], { timeout: 15000, stdio: ["ignore", openSync(path.join(output, "app-first-open.png"), "w"), "pipe"] });
  evidence.status = "passed";
  console.log("Native SQLCipher/Expo lifecycle proof passed. Product UI journeys and iOS evidence are separate.");
} catch (error) {
  evidence.status = "failed";
  evidence.failure = error instanceof Error ? error.message : String(error);
  try { writeFileSync(path.join(output, "logcat.txt"), runAdb(["logcat", "-d", "-t", "1200"])); } catch { /* Keep the original diagnostic. */ }
  throw error;
} finally {
  try {
    try { if (!emulatorExited) runAdb(["emu", "kill"]); } catch { /* Terminate only this runner's child below. */ }
    const deadline = Date.now() + 15000;
    while (!emulatorExited && Date.now() < deadline) await delay(200);
    if (!emulatorExited) { owned.kill("SIGTERM"); await delay(1000); }
    if (!emulatorExited) owned.kill("SIGKILL");
  } finally {
    writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
}
