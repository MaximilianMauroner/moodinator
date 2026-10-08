import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { STARTUP_PHASES } from "../db/encryption/startup";

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
owned.on("exit", () => { emulatorExited = true; });
owned.on("error", (error) => { evidence.failure = error.message; emulatorExited = true; });

async function launch(params: Record<string, string>) {
  runAdb(["shell", "am", "force-stop", QA_ID]);
  const url = `moodinator-qa:///?${new URLSearchParams(params)}`;
  runAdb(["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", url, QA_ID]);
  await waitForNode(serial, { testId: `qa-source-sha-${sourceSha}` }, { adbPath: adb, timeoutMs: 45000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
}
async function result(params: Record<string, string>) {
  await launch(params);
  const node = await waitForNode(serial, { testId: "encryption-proof-result" }, { adbPath: adb, timeoutMs: 60000, dumpTimeoutMs: 5000, pollIntervalMs: 500 });
  const prefix = "encryption-proof-result:";
  assert.ok(node["content-desc"].startsWith(prefix));
  const report = JSON.parse(node["content-desc"].slice(prefix.length));
  assert.equal(report.sourceSha, sourceSha);
  evidence.results.push({ action: params, report });
  assert.equal(report.result.status, "passed", JSON.stringify(report));
  writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Passed native ${params.proof}${params.case ? `:${params.case}` : ""}`);
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
  runAdb(["install", "--no-streaming", apk], 60000);
  assert.equal(packageIsDebuggable(runAdb(["shell", "dumpsys", "package", QA_ID])), false, "Native acceptance needs a non-debuggable QA release");
  assert.equal(runAdb(["shell", "pm", "clear", QA_ID]).trim(), "Success");
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
  writeFileSync(path.join(output, "report.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  try { if (!emulatorExited) runAdb(["emu", "kill"]); } catch { /* Terminate only this runner's child below. */ }
  const deadline = Date.now() + 15000;
  while (!emulatorExited && Date.now() < deadline) await delay(200);
  if (!emulatorExited) { owned.kill("SIGTERM"); await delay(1000); }
  if (!emulatorExited) owned.kill("SIGKILL");
}
