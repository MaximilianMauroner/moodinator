const { execFileSync } = require("node:child_process");
const { Buffer } = require("node:buffer");
const { readPreparedSourceSha } = require("./qa-source-provenance");

const QA_APP_ID = "com.lab4code.moodinator.qa";

function requirePreparedSourceSha(workspace, env = process.env) {
  return readPreparedSourceSha(workspace, env);
}

function isToolUnavailable(error) {
  const message = error instanceof Error ? error.message : String(error);
  const adbOutput = error && typeof error === "object"
    ? [error.stderr, error.stdout]
      .filter((value) => typeof value === "string" || Buffer.isBuffer(value))
      .map(String)
      .join("\n")
    : "";
  const diagnostic = `${message}\n${adbOutput}`;
  return /\bENOENT\b|\bcommand not found\b|\bexecutable not found\b|\bno such file\b|\b(?:adb|maestro) (?:is )?not installed\b/i.test(diagnostic)
    || /(?:^|\n)\s*(?:\/system\/bin\/sh:\s*)?atrace:\s*inaccessible or not found\s*(?:\r?$)/im.test(diagnostic)
    || /\bdevice(?: [^\r\n]*)? offline\b/i.test(diagnostic)
    || /\bdevice unauthorized\b/i.test(diagnostic)
    || /\bno devices\/emulators found\b/i.test(diagnostic)
    || /\bdevice ['"][^'"\r\n]+['"] not found\b/i.test(diagnostic)
    || /\b(?:adb|spawn(?:Sync)? adb)\b[^\r\n]*(?:ETIMEDOUT|timed out|timeout)/i.test(diagnostic);
}

function evidenceStatus({ routeError = null, requiredFailures = [] } = {}) {
  if (routeError && !isToolUnavailable(routeError)) return "failed";
  if (requiredFailures.some((failure) => failure.status !== "blocked")) return "failed";
  if (routeError || requiredFailures.length > 0) return "blocked";
  return "passed";
}

function combineOperationalErrors(operationalError, restorationError) {
  if (!restorationError) return operationalError;
  if (!operationalError) return restorationError;
  return new AggregateError(
    [operationalError, restorationError],
    `${operationalError.message} Restoration also failed: ${restorationError.message}`,
  );
}

function packageIsDebuggable(packageDump) {
  return /(?:^|\n)\s*(?:pkgFlags|flags)=\[[^\]\n]*\bDEBUGGABLE\b[^\]\n]*\]/m.test(packageDump);
}

// `monkey -p` aborts on API 36 emulators without physical keys ("SYS_KEYS has
// no physical keys") and may inject a random UI event. Start the resolved
// launcher activity instead and wait until Android reports the launch.
function launchQaApp(serial, { appId = QA_APP_ID, execFile = execFileSync } = {}) {
  const resolved = String(execFile("adb", [
    "-s", serial, "shell", "cmd", "package", "resolve-activity", "--brief",
    "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER", appId,
  ], { encoding: "utf8", timeout: 15000 })).trim();
  const component = resolved.split(/\r?\n/).at(-1)?.trim() ?? "";
  if (!component.startsWith(`${appId}/`)) {
    throw new Error(`Could not resolve the launcher activity of ${appId}: ${resolved || "no output"}`);
  }
  const started = String(execFile("adb", ["-s", serial, "shell", "am", "start", "-W", "-n", component], {
    encoding: "utf8",
    timeout: 30000,
  })).trim();
  if (!/^Status: ok$/m.test(started) || /^Error/m.test(started)) {
    throw new Error(`Could not launch ${component}: ${started || "no output"}`);
  }
  return component;
}

async function assertInstalledQaBuild(serial, sourceSha, {
  appId = QA_APP_ID,
  execFile = execFileSync,
  waitForNodeImpl,
} = {}) {
  const installed = execFile("adb", ["-s", serial, "shell", "pm", "path", appId], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (!installed.trim().startsWith("package:")) {
    throw new Error(`The QA package ${appId} is not installed on ${serial}.`);
  }
  const packageDump = execFile("adb", ["-s", serial, "shell", "dumpsys", "package", appId], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (packageIsDebuggable(packageDump)) {
    throw new Error(`The installed QA package ${appId} is debuggable; native acceptance requires a non-debuggable release build.`);
  }
  execFile("adb", ["-s", serial, "shell", "am", "force-stop", appId], { timeout: 15000 });
  launchQaApp(serial, { appId, execFile });
  const waitForSource = waitForNodeImpl ?? require("./native-ui").waitForNode;
  await waitForSource(serial, { testId: `qa-source-sha-${sourceSha}` }, { timeoutMs: 10000 });
  return { appId, sourceSha };
}

function evidenceAcceptance(status) {
  return status === "passed" ? "accepted" : "not-accepted";
}

module.exports = {
  assertInstalledQaBuild,
  combineOperationalErrors,
  evidenceAcceptance,
  evidenceStatus,
  isToolUnavailable,
  launchQaApp,
  packageIsDebuggable,
  requirePreparedSourceSha,
};
