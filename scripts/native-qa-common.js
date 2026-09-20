const { execFileSync } = require("node:child_process");

const SOURCE_SHA_ENV = "MOODINATOR_SOURCE_SHA";
const QA_APP_ID = "com.lab4code.moodinator.qa";

function requireSourceSha(env = process.env) {
  const value = env[SOURCE_SHA_ENV];
  if (!value || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(
      `${SOURCE_SHA_ENV} is required and must be the full 40-character lowercase source SHA from the originating checkout. ` +
      `Run: export ${SOURCE_SHA_ENV}="$(git rev-parse HEAD)"`,
    );
  }
  return value;
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
  execFile("adb", ["-s", serial, "shell", "monkey", "-p", appId, "1"], {
    stdio: "ignore",
    timeout: 15000,
  });
  const waitForSource = waitForNodeImpl ?? require("./native-ui").waitForNode;
  await waitForSource(serial, { testId: `qa-source-sha-${sourceSha}` }, { timeoutMs: 10000 });
  return { appId, sourceSha };
}

function evidenceAcceptance(status) {
  return status === "passed" ? "accepted" : "not-accepted";
}

module.exports = {
  SOURCE_SHA_ENV,
  assertInstalledQaBuild,
  combineOperationalErrors,
  evidenceAcceptance,
  evidenceStatus,
  isToolUnavailable,
  packageIsDebuggable,
  requireSourceSha,
};
