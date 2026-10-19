const { execFileSync, spawn } = require("node:child_process");
const { setImmediate: eventLoopCheckpoint, setTimeout: delay } = require("node:timers/promises");

function groupHasLiveMembers(pid) {
  const processes = execFileSync("ps", ["-axo", "pid=,pgid=,stat="], { encoding: "utf8", timeout: 5000 });
  return processes.split(/\r?\n/).some((line) => {
    const [, group, state] = line.trim().split(/\s+/);
    // An exited orphan can remain a zombie until its new parent reaps it.
    return Number(group) === pid && state && !state.startsWith("Z");
  });
}

function signalGroup(pid, signal) {
  try { process.kill(-pid, signal); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
}

async function stopOwnedGroup(pid, termGraceMs, killGraceMs) {
  const waitForExit = async (graceMs) => {
    const deadline = Date.now() + graceMs;
    while (groupHasLiveMembers(pid)) {
      if (Date.now() >= deadline) return false;
      await delay(Math.min(50, graceMs));
    }
    return true;
  };
  signalGroup(pid, "SIGTERM");
  try { if (await waitForExit(termGraceMs)) return; }
  catch { /* If verification fails, still escalate only this owned group. */ }
  signalGroup(pid, "SIGKILL");
  if (!await waitForExit(killGraceMs)) throw new Error(`Owned build process group ${pid} did not exit after SIGKILL.`);
}

async function runOwnedBuild(command, args, {
  stdio = "ignore", sample, signal, timeoutMs = 45 * 60000,
  monitorIntervalMs = 15000, termGraceMs = 2000, killGraceMs = 5000,
}) {
  signal?.throwIfAborted();
  sample();
  signal?.throwIfAborted();
  // Only this newly spawned detached group is ever signalled.
  const child = spawn(command, args, { detached: true, stdio });
  let failure;
  let cleanupError;
  let stopping;
  let announceFailure;
  const failed = new Promise((resolve) => { announceFailure = resolve; });
  const fail = (error) => {
    failure ??= error;
    stopping ??= (child.pid ? stopOwnedGroup(child.pid, termGraceMs, killGraceMs) : Promise.resolve())
      .catch((error) => { cleanupError = error; });
    announceFailure();
  };
  const closed = new Promise((resolve) => {
    child.once("error", fail);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const abort = () => fail(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setInterval(() => {
    try { sample(); }
    catch (error) { fail(new Error(`Resource monitoring failed: ${error.message}`, { cause: error })); }
  }, monitorIntervalMs);
  const timeout = setTimeout(() => fail(new Error(`Owned Xcode build exceeded ${timeoutMs}ms`)), timeoutMs);
  try {
    // A resistant group must not make the cancellation path wait for `close`.
    const completion = await Promise.race([closed, failed.then(async () => { await stopping; return null; })]);
    clearInterval(timer);
    clearTimeout(timeout);
    if (!failure && completion?.code !== 0) {
      fail(new Error(`Xcode build failed (${completion?.code ?? completion?.signal}); return the first error from xcodebuild.log`));
    }
    if (!failure && child.pid) {
      try {
        if (groupHasLiveMembers(child.pid)) fail(new Error("Owned build leader exited while descendants were still running."));
      } catch (error) { fail(error); }
    }
    await stopping;
    if (failure) {
      if (cleanupError) throw new AggregateError([failure, cleanupError], `${failure.message} ${cleanupError.message}`);
      throw failure;
    }
    signal?.throwIfAborted();
    sample();
    signal?.throwIfAborted();
    return completion;
  } finally {
    clearInterval(timer);
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function runIosProofLifecycle({
  evidence, run, save, shutdown, deleteSimulator, openSimulator,
  keepSimulator = false, signals = process,
}) {
  const cancellation = new AbortController();
  const failures = [];
  let disposalAttempted = false;
  const fail = (error) => {
    if (!failures.includes(error)) failures.push(error);
    evidence.status = "failed";
    evidence.failure = failures[0].message;
    evidence.simulatorRetained = false;
  };
  const cancel = (name) => {
    if (cancellation.signal.aborted) return;
    const error = new Error(`iOS proof cancelled by ${name}`);
    fail(error);
    cancellation.abort(error);
  };
  const interrupt = () => cancel("SIGINT");
  const terminate = () => cancel("SIGTERM");
  signals.on("SIGINT", interrupt);
  signals.on("SIGTERM", terminate);
  const dispose = async () => {
    const id = evidence.simulator?.id;
    if (!id || disposalAttempted) return;
    disposalAttempted = true;
    let shutdownError;
    try { await shutdown(id); }
    catch (error) { shutdownError = error; } // Deletion also handles an already-shutdown simulator.
    try { await deleteSimulator(id); }
    catch (error) {
      throw new AggregateError([shutdownError, error].filter(Boolean),
        `Could not dispose owned simulator ${id}; remove only this UUID manually. ${error.message}`);
    }
  };
  try {
    try {
      await run(cancellation.signal);
      // Awaiting a synchronous native command only drains microtasks. Yield to
      // the event loop so queued OS signals run while our handlers are installed.
      await eventLoopCheckpoint();
      cancellation.signal.throwIfAborted();
      if (keepSimulator) {
        await openSimulator(evidence.simulator.id);
        await eventLoopCheckpoint();
        cancellation.signal.throwIfAborted();
        evidence.simulatorRetained = true;
      }
      evidence.status = "passed";
    } catch (error) { fail(error); }
    await eventLoopCheckpoint();
    if (!evidence.simulatorRetained) {
      try { await dispose(); }
      catch (error) { fail(error); }
    }
    await eventLoopCheckpoint();
    const reportStatus = evidence.status;
    try { await save(); }
    catch (error) { fail(error); }
    await eventLoopCheckpoint();
    // A report failure or cancellation must also release a proposed GUI handoff.
    if (!evidence.simulatorRetained) {
      try { await dispose(); }
      catch (error) { fail(error); }
    }
    await eventLoopCheckpoint();
    // A signal queued during a synchronous report write can arrive after that
    // write saved "passed". Reconcile it before handing off or removing handlers.
    if (reportStatus === "passed" && cancellation.signal.aborted) {
      // Cancellation can also arrive at the checkpoint after the earlier guard.
      try { await dispose(); }
      catch (error) { fail(error); }
      try { await save(); }
      catch (error) { fail(error); }
      await eventLoopCheckpoint();
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, failures.map((error) => error.message).join(" "));
  } finally {
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", terminate);
  }
}

function packedVersion(version) {
  if (typeof version !== "string" || !/^\d+(?:\.\d+){0,2}$/.test(version)) return null;
  const [major, minor = 0, patch = 0] = version.split(".").map(Number);
  if (major > 65535 || minor > 255 || patch > 255) return null;
  return major * 65536 + minor * 256 + patch;
}

function runtimeBound(deviceType, key) {
  const numeric = deviceType[key];
  const text = deviceType[`${key}String`];
  if (numeric === undefined) return text === undefined ? undefined : packedVersion(text);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 4294967295) return null;
  if (text !== undefined && packedVersion(text) !== numeric) return null;
  return numeric;
}

function supportsRuntime(runtime, deviceType) {
  let reportedSupport = false;
  if (runtime.supportedDeviceTypes !== undefined) {
    if (!Array.isArray(runtime.supportedDeviceTypes)) return false;
    const identifiers = runtime.supportedDeviceTypes.map((item) => typeof item === "string" ? item : item?.identifier);
    if (identifiers.some((item) => typeof item !== "string" || !item)) return false;
    if (!identifiers.includes(deviceType.identifier)) return false;
    reportedSupport = true;
  }
  const minimum = runtimeBound(deviceType, "minRuntimeVersion");
  const maximum = runtimeBound(deviceType, "maxRuntimeVersion");
  if (minimum === undefined && maximum === undefined) return reportedSupport;
  if (minimum == null || maximum == null || minimum > maximum) return false;
  const version = packedVersion(runtime.version);
  return version !== null && minimum <= version && version <= maximum;
}

function selectSimulatorProfile(inventory) {
  const runtimes = inventory.runtimes.filter((item) => item.isAvailable && item.identifier.includes(".iOS-")
    && packedVersion(item.version) !== null)
    .sort((a, b) => packedVersion(b.version) - packedVersion(a.version));
  const deviceTypes = [...inventory.devicetypes].reverse().filter((item) => item.name.startsWith("iPhone")
    && typeof item.identifier === "string" && item.identifier);
  for (const runtime of runtimes) {
    const deviceType = deviceTypes.find((item) => supportsRuntime(runtime, item));
    if (deviceType) return { runtime, deviceType };
  }
  throw new Error("No available iOS runtime/iPhone type has reported compatible metadata; install a compatible runtime and device type in Xcode. No existing simulator is reused.");
}

module.exports = { runIosProofLifecycle, runOwnedBuild, selectSimulatorProfile };
