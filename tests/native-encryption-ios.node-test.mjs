import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { runIosProofLifecycle, runOwnedBuild, selectSimulatorProfile } = require("../scripts/native-encryption-ios.js");

function assertExited(pid) {
  let state;
  try { state = execFileSync("ps", ["-p", String(pid), "-o", "stat="], { encoding: "utf8", stdio: "pipe" }).trim(); }
  catch (error) { if (error.status !== 1) throw error; }
  assert.ok(!state || state.startsWith("Z"), `Owned fixture ${pid} is still running (${state}).`);
}

async function buildFixture(mode, trigger, expected) {
  const directory = mkdtempSync(join(tmpdir(), "moodinator-owned-build-test-"));
  const pidFile = join(directory, "pids.json");
  const exitFile = join(directory, "leader-exit.txt");
  const script = join(directory, "fixture.cjs");
  writeFileSync(script, `
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const child = spawn(process.execPath, ['-e',
      "process.on('SIGTERM', () => {}); process.send('ready'); setInterval(() => {}, 1000);"
    ], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const exit = () => { writeFileSync(${JSON.stringify(exitFile)}, '0'); process.exit(0); };
    process.on('SIGTERM', ${mode === "resistant" ? "() => {}" : "exit"});
    child.once('message', () => {
      writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.pid, child.pid]));
      ${mode === "close" ? "exit();" : ""}
    });
    setInterval(() => {}, 1000);
  `);
  const cancellation = new AbortController();
  let triggered = false;
  try {
    await assert.rejects(runOwnedBuild(process.execPath, [script], {
      signal: cancellation.signal, timeoutMs: 800, monitorIntervalMs: 20,
      termGraceMs: 50, killGraceMs: 1500,
      sample() {
        if (!existsSync(pidFile) || triggered) return;
        triggered = true;
        if (trigger === "monitor") throw new Error("synthetic monitor failure");
        if (trigger === "abort") cancellation.abort(new Error("synthetic cancellation"));
      },
    }), expected);
    assert.ok(existsSync(pidFile), "Both fixture processes must start before the failure.");
    for (const pid of JSON.parse(readFileSync(pidFile, "utf8"))) assertExited(pid);
    if (mode !== "resistant") assert.equal(readFileSync(exitFile, "utf8"), "0", "Leader must have exited zero.");
  } finally {
    if (existsSync(pidFile)) {
      const [leader] = JSON.parse(readFileSync(pidFile, "utf8"));
      try { process.kill(-leader, "SIGKILL"); }
      catch (error) {
        if (error.code !== "ESRCH") {
          // macOS can return EPERM for an already exited process group.
          if (error.code !== "EPERM") throw error;
          for (const pid of JSON.parse(readFileSync(pidFile, "utf8"))) assertExited(pid);
        }
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

test("owned build cancellation escalates a resistant detached group", { skip: process.platform === "win32" }, async () => {
  await buildFixture("resistant", "abort", /synthetic cancellation/);
});

test("owned build cleans resistant descendants after its leader exits zero", { skip: process.platform === "win32" }, async () => {
  await buildFixture("close", "none", /leader exited while descendants/);
});

test("owned build monitoring failure stays fatal when TERM exits the leader zero", { skip: process.platform === "win32" }, async () => {
  await buildFixture("graceful", "monitor", /Resource monitoring failed: synthetic monitor failure/);
});

test("owned build timeout stays fatal when TERM exits the leader zero", { skip: process.platform === "win32" }, async () => {
  await buildFixture("graceful", "none", /Owned Xcode build exceeded/);
});

test("owned build accepts a clean exit and rejects a failed final resource sample", async () => {
  assert.equal((await runOwnedBuild(process.execPath, ["-e", ""], { sample() {} })).code, 0);
  let samples = 0;
  await assert.rejects(runOwnedBuild(process.execPath, ["-e", ""], {
    sample() { if (++samples === 2) throw new Error("final sample failure"); },
  }), /final sample failure/);
});

const SIMULATOR = "11111111-2222-3333-4444-555555555555";
function lifecycleFixture(overrides = {}) {
  const evidence = { status: "running", results: [] };
  const calls = [];
  const signals = new EventEmitter();
  const options = {
    evidence, signals,
    run: async () => { evidence.simulator = { id: SIMULATOR }; calls.push("proof"); },
    save: () => calls.push("save"),
    shutdown: (id) => calls.push(["shutdown", id]),
    deleteSimulator: (id) => calls.push(["delete", id]),
    openSimulator: (id) => calls.push(["open", id]),
    ...overrides,
  };
  return { evidence, calls, signals, options };
}

test("proof and report failures preserve the proof error and still dispose the simulator", async () => {
  const fixture = lifecycleFixture();
  const proofError = new Error("original proof failure");
  const reportError = new Error("EACCES report");
  fixture.options.run = async () => { fixture.evidence.simulator = { id: SIMULATOR }; throw proofError; };
  fixture.options.save = () => { throw reportError; };
  await assert.rejects(runIosProofLifecycle(fixture.options), (error) => {
    assert.deepEqual(error.errors, [proofError, reportError]);
    assert.match(error.message, /original proof failure.*EACCES report/);
    return true;
  });
  assert.deepEqual(fixture.calls, [["shutdown", SIMULATOR], ["delete", SIMULATOR]]);
  assert.equal(fixture.evidence.failure, "original proof failure");
  assert.equal(fixture.signals.listenerCount("SIGTERM"), 0);
});

test("owned simulator is disposed after a successful non-retained proof", async () => {
  const fixture = lifecycleFixture();
  await runIosProofLifecycle(fixture.options);
  assert.equal(fixture.evidence.status, "passed");
  assert.deepEqual(fixture.calls, ["proof", ["shutdown", SIMULATOR], ["delete", SIMULATOR], "save"]);
});

test("simulator retention requires successful proof, GUI open and report write", async () => {
  const fixture = lifecycleFixture({ keepSimulator: true });
  await runIosProofLifecycle(fixture.options);
  assert.equal(fixture.evidence.simulatorRetained, true);
  assert.deepEqual(fixture.calls, ["proof", ["open", SIMULATOR], "save"]);
  for (const failingAction of ["openSimulator", "save"]) {
    const failed = lifecycleFixture({ keepSimulator: true });
    failed.options[failingAction] = () => { throw new Error(`${failingAction} failure`); };
    await assert.rejects(runIosProofLifecycle(failed.options), new RegExp(`${failingAction} failure`));
    assert.equal(failed.evidence.status, "failed");
    assert.equal(failed.evidence.simulatorRetained, false);
    assert.ok(failed.calls.some((call) => Array.isArray(call) && call[0] === "delete"));
  }
});

test("SIGINT and SIGTERM stay fatal during proof and GUI handoff and release the owned simulator", async () => {
  for (const signalName of ["SIGINT", "SIGTERM"]) {
    for (const action of ["run", "openSimulator"]) {
      const fixture = lifecycleFixture({ keepSimulator: true });
      fixture.options[action] = async () => {
        fixture.evidence.simulator = { id: SIMULATOR };
        fixture.signals.emit(signalName);
      };
      await assert.rejects(runIosProofLifecycle(fixture.options), new RegExp(`cancelled by ${signalName}`));
      assert.equal(fixture.evidence.simulatorRetained, false);
      assert.ok(fixture.calls.some((call) => Array.isArray(call) && call[0] === "delete"));
      assert.equal(fixture.signals.listenerCount(signalName), 0);
    }
  }
});

test("late pre-handoff cancellation disposes once before writing failed evidence", async () => {
  for (const turn of [1, 2]) {
    for (const deletionFails of [false, true]) {
      const fixture = lifecycleFixture({ keepSimulator: true });
      const reports = [];
      fixture.options.save = () => {
        fixture.calls.push("save");
        reports.push(structuredClone(fixture.evidence));
        if (reports.length !== 1) return;
        const cancel = () => fixture.signals.emit("SIGTERM");
        if (turn === 1) setImmediate(cancel);
        else setImmediate(() => setImmediate(cancel));
      };
      if (deletionFails) {
        fixture.options.deleteSimulator = (id) => {
          fixture.calls.push(["delete", id]);
          throw new Error("synthetic deletion failure");
        };
      }
      await assert.rejects(runIosProofLifecycle(fixture.options), (error) => {
        assert.match(error.message, /^iOS proof cancelled by SIGTERM/);
        if (deletionFails) {
          assert.equal(error.errors[0].message, "iOS proof cancelled by SIGTERM");
          assert.ok(error.errors[1].message.includes(SIMULATOR));
        }
        return true;
      });
      assert.deepEqual(fixture.calls, ["proof", ["open", SIMULATOR], "save", ["shutdown", SIMULATOR], ["delete", SIMULATOR], "save"]);
      assert.equal(reports[0].status, "passed");
      assert.equal(reports.at(-1).status, "failed");
      assert.equal(reports.at(-1).simulatorRetained, false);
      assert.equal(fixture.signals.listenerCount("SIGTERM"), 0);
    }
  }
});

test("OS cancellation during synchronous proof, GUI, report and cleanup calls fails and disposes", { skip: process.platform === "win32" }, async () => {
  for (const action of ["run", "open", "save", "shutdown", "delete", "proof-error"]) {
    const directory = mkdtempSync(join(tmpdir(), "moodinator-ios-signal-test-"));
    const report = join(directory, "report.json");
    const outcome = join(directory, "outcome.json");
    const script = join(directory, "fixture.cjs");
    const helper = require.resolve("../scripts/native-encryption-ios.js");
    writeFileSync(script, `
      const { execFileSync } = require('node:child_process');
      const { writeFileSync } = require('node:fs');
      const { runIosProofLifecycle } = require(${JSON.stringify(helper)});
      const evidence = { status: 'running' };
      const calls = [];
      let blocked = false;
      const block = (action) => {
        if (action !== ${JSON.stringify(action)} || blocked) return;
        blocked = true;
        process.stdout.write('blocked\\n');
        execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 600)']);
      };
      runIosProofLifecycle({
        evidence, keepSimulator: ${!["shutdown", "delete"].includes(action)},
        run() {
          evidence.simulator = { id: ${JSON.stringify(SIMULATOR)} };
          block('run'); block('proof-error');
          ${action === "proof-error" ? "throw new Error('original proof failure');" : ""}
        },
        openSimulator() { calls.push('open'); block('open'); },
        shutdown() { calls.push('shutdown'); block('shutdown'); },
        deleteSimulator() { calls.push('delete'); block('delete'); },
        save() { calls.push('save'); block('save'); writeFileSync(${JSON.stringify(report)}, JSON.stringify(evidence)); },
      }).then(() => {
        writeFileSync(${JSON.stringify(outcome)}, JSON.stringify({ calls, evidence }));
      }, (error) => {
        writeFileSync(${JSON.stringify(outcome)}, JSON.stringify({ calls, evidence, error: error.message }));
        process.exitCode = 1;
      });
    `);
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errors = "";
    let signalSent = false;
    let signalTimer;
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (!signalSent && output.includes("blocked\n")) {
        signalSent = true;
        signalTimer = setTimeout(() => child.kill("SIGTERM"), 50);
      }
    });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    const deadline = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
      const exit = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      assert.equal(signalSent, true, `${action}: fixture never reached its synchronous call`);
      assert.deepEqual(exit, { code: 1, signal: null }, `${action}: ${errors}`);
      const result = JSON.parse(readFileSync(outcome, "utf8"));
      assert.match(result.error, /cancelled by SIGTERM/, action);
      if (action === "proof-error") assert.match(result.error, /^original proof failure/, action);
      assert.ok(result.calls.includes("shutdown"), `${action}: ${JSON.stringify(result)}`);
      assert.ok(result.calls.includes("delete"), `${action}: ${JSON.stringify(result)}`);
      const saved = JSON.parse(readFileSync(report, "utf8"));
      assert.equal(saved.status, "failed", action);
      assert.equal(saved.simulatorRetained, false, action);
      if (action === "save") assert.equal(result.calls.filter((call) => call === "save").length, 2, "Reconcile a report saved before signal delivery.");
    } finally {
      clearTimeout(deadline);
      clearTimeout(signalTimer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("disposal errors include the owned UUID and retain the first proof failure", async () => {
  const fixture = lifecycleFixture();
  fixture.options.run = async () => { fixture.evidence.simulator = { id: SIMULATOR }; throw new Error("proof failure"); };
  fixture.options.shutdown = () => { throw new Error("shutdown failed"); };
  fixture.options.deleteSimulator = () => { throw new Error("delete failed"); };
  await assert.rejects(runIosProofLifecycle(fixture.options), (error) => {
    assert.match(error.message, /proof failure/);
    assert.ok(error.message.includes(SIMULATOR));
    assert.equal(error.errors[0].message, "proof failure");
    return true;
  });
  assert.equal(fixture.evidence.status, "failed");
});

const runtime = (version, extra = {}) => ({ identifier: `com.apple.CoreSimulator.SimRuntime.iOS-${version.replaceAll(".", "-")}`, name: `iOS ${version}`, version, isAvailable: true, ...extra });
const phone = (name, extra = {}) => ({ identifier: `com.apple.CoreSimulator.SimDeviceType.${name}`, name, ...extra });
const bounds = (minimum, maximum = 4294967295) => ({ minRuntimeVersion: minimum, maxRuntimeVersion: maximum });

test("simulator selection uses packed min/max bounds without existing simulator instances", () => {
  const oldPhone = phone("iPhone15", bounds(17 * 65536));
  const newPhone = phone("iPhone16", bounds(18 * 65536));
  const inventory = { runtimes: [runtime("17.5")], devicetypes: [oldPhone, newPhone], devices: {} };
  assert.equal(selectSimulatorProfile(inventory).deviceType, oldPhone);
  inventory.runtimes.push(runtime("18.0"));
  assert.equal(selectSimulatorProfile(inventory).deviceType, newPhone);
  inventory.devicetypes = [phone("iPhone14", bounds(16 * 65536, 17 * 65536 + 5 * 256))];
  assert.equal(selectSimulatorProfile(inventory).runtime.version, "17.5");
});

test("simulator selection accepts reported supported types or string bounds and rejects unavailable runtimes", () => {
  const compatible = phone("iPhone15");
  const unsupportedNewer = phone("iPhone16");
  const reported = runtime("17.5", { supportedDeviceTypes: [{ identifier: compatible.identifier }] });
  assert.equal(selectSimulatorProfile({ runtimes: [reported], devicetypes: [compatible, unsupportedNewer] }).deviceType, compatible);
  const stringBound = phone("iPhone14", { minRuntimeVersionString: "16.0.0", maxRuntimeVersionString: "17.5.0" });
  const profile = selectSimulatorProfile({ runtimes: [runtime("17.5"), runtime("18.0", { isAvailable: false })], devicetypes: [stringBound] });
  assert.equal(profile.runtime.version, "17.5");
});

test("simulator selection fails closed for missing, conflicting and malformed support metadata", () => {
  const knownRuntime = runtime("17.5");
  for (const deviceType of [
    phone("iPhone16"),
    phone("iPhone16", bounds(18 * 65536)),
    phone("iPhone15", { ...bounds(17 * 65536), minRuntimeVersionString: "18.0.0" }),
    phone("iPhone15", { minRuntimeVersionString: "unknown", maxRuntimeVersionString: "18.0.0" }),
  ]) {
    assert.throws(() => selectSimulatorProfile({ runtimes: [knownRuntime], devicetypes: [deviceType] }), /reported compatible metadata/);
  }
  const type = phone("iPhone15", bounds(17 * 65536));
  for (const supportedDeviceTypes of [[], [{}], "unsupported-shape"]) {
    assert.throws(() => selectSimulatorProfile({ runtimes: [{ ...knownRuntime, supportedDeviceTypes }], devicetypes: [type] }), /reported compatible metadata/);
  }
});
