const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { createQaFixture } = require("./generate-qa-fixtures");
const {
  assertInstalledQaBuild,
  combineOperationalErrors,
  evidenceAcceptance,
  evidenceStatus,
  isToolUnavailable,
  requireSourceSha,
} = require("./native-qa-common");
const { runAdb, waitForNode, waitForNodeAndTap } = require("./native-ui");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");
const importFlow = path.join(root, ".maestro/flows/native-stress-import.yaml");
const MAESTRO_TIMEOUT_MS = 120000;

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) {
    throw new Error("Use a disposable emulator serial such as emulator-5554.");
  }
  let output = null;
  while (argv.length) {
    if (argv.shift() !== "--out") throw new Error("Only --out is supported.");
    output = argv.shift();
    if (!output) throw new Error("Missing value for --out.");
  }
  return { serial, output };
}

function setting(serial, namespace, key) {
  return runAdb(serial, ["shell", "settings", "get", namespace, key]).trim();
}

function setSetting(serial, namespace, key, value) {
  runAdb(serial, ["shell", "settings", "put", namespace, key, value]);
}

function restoreSetting(serial, namespace, key, value) {
  if (!value || value === "null") {
    runAdb(serial, ["shell", "settings", "delete", namespace, key]);
    return;
  }
  setSetting(serial, namespace, key, value);
}

function restoreTimeZoneSettings(serial, original) {
  let firstError = null;
  for (const [namespace, key, value] of [
    ["global", "time_zone", original.timeZone],
  ]) {
    try {
      restoreSetting(serial, namespace, key, value);
    } catch (error) {
      firstError ??= error;
    }
  }
  try {
    setRuntimeTimeZone(serial, original.runtimeTimeZone);
  } catch (error) {
    firstError ??= error;
  }
  try {
    restoreSetting(serial, "global", "auto_time_zone", original.autoTimeZone);
  } catch (error) {
    firstError ??= error;
  }
  if (firstError) throw firstError;
}

function setRuntimeTimeZone(serial, timeZone) {
  if (!timeZone) throw new Error("The original runtime timezone was unavailable and cannot be restored safely.");
  runAdb(serial, ["shell", "cmd", "alarm", "set-timezone", timeZone]);
  const actual = readDeviceTimeZone(serial).value;
  if (actual !== timeZone) {
    throw new Error(`Android runtime timezone was ${actual ?? "unavailable"}, expected ${timeZone}.`);
  }
  return actual;
}

function requestRuntimeTimeZone(serial, timeZone) {
  runAdb(serial, ["shell", "cmd", "alarm", "set-timezone", timeZone]);
  return readDeviceTimeZone(serial);
}

function readDeviceTimeZone(serial) {
  const settingsValue = setting(serial, "global", "time_zone");
  const propertyValue = runAdb(serial, ["shell", "getprop", "persist.sys.timezone"]).trim();
  return selectRuntimeTimeZone(settingsValue, propertyValue);
}

function selectRuntimeTimeZone(settingsValue, propertyValue) {
  return {
    settings: settingsValue && settingsValue !== "null" ? settingsValue : null,
    property: propertyValue || null,
    // persist.sys.timezone is the runtime timezone used by Android. The global
    // setting can echo a requested value even when the runtime rejected it.
    value: propertyValue || null,
  };
}

function verifyRequestedTimeZone(requested, actual) {
  return Boolean(requested && actual && requested === actual);
}

function timezoneEntryTestId(timestamp) {
  return `mood-entry-${timestamp}`;
}

function timezoneEntryMatcher(timestamp) {
  // DisplayMoodItem places the accessibility label on this nested Pressable;
  // mood-entry-stable-* belongs to its non-interactive animated wrapper.
  return { testId: timezoneEntryTestId(timestamp) };
}

function recordedLabelFromNode(node) {
  const label = node?.["content-desc"]?.trim();
  if (!label) throw new Error("The timezone entry Pressable did not expose a stable recorded label.");
  return label;
}

function evaluateTimezoneObservations(observations) {
  const accepted = observations.length === 2 && observations.every((observation) => (
    observation.accepted
    && observation.actualTimeZone === observation.requestedTimeZone
    && observation.tested
  ));
  const distinctStates = new Set(observations.map((observation) => observation.actualTimeZone).filter(Boolean)).size === 2;
  const sameRecordedLabel = observations.length === 2
    && observations.every((observation) => observation.contentDescription)
    && observations[0].contentDescription === observations[1].contentDescription;
  const stableRecordedLabel = accepted && distinctStates && sameRecordedLabel;
  return {
    stableRecordedLabel,
    status: stableRecordedLabel ? "passed" : observations.some((observation) => !observation.accepted) ? "blocked" : "failed",
    accepted,
    distinctStates,
    sameRecordedLabel,
  };
}

function runMaestro(serial) {
  execFileSync("maestro", ["--device", serial, "test", importFlow], {
    cwd: root,
    stdio: "inherit",
    timeout: MAESTRO_TIMEOUT_MS,
  });
}

function restartApp(serial) {
  runAdb(serial, ["shell", "am", "force-stop", appId]);
  runAdb(serial, ["shell", "monkey", "-p", appId, "1"]);
}

async function importFixture(serial, fixtureName) {
  runMaestro(serial);
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

function writeEvidence(outputDirectory, evidence) {
  writeFileSync(path.join(outputDirectory, "timezone.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const sourceSha = requireSourceSha();
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), "moodinator-native-timezone-"));
  mkdirSync(outputDirectory, { recursive: true });

  const entries = createQaFixture(100);
  const fixtureName = "moodinator-qa-timezone.json";
  const fixturePath = path.join(outputDirectory, fixtureName);
  const baseEvidence = {
    appId,
    serial: options.serial,
    sourceSha,
    fixture: fixturePath,
    fabricatedDataOnly: true,
    fixtureProof: {
      entryCount: entries.length,
      firstNote: entries[0].note,
      recordedOffsetMinutes: entries[0].utcOffsetMinutes,
    },
  };
  const observations = [];
  let original = null;
  let operationalError = null;
  let restoreError = null;

  try {
    await assertInstalledQaBuild(options.serial, sourceSha);
    writeFileSync(fixturePath, JSON.stringify(entries), { flag: "wx" });
    runAdb(options.serial, ["push", fixturePath, `/sdcard/Download/${fixtureName}`], { timeoutMs: 30000 });
    original = {
      autoTimeZone: setting(options.serial, "global", "auto_time_zone"),
      timeZone: setting(options.serial, "global", "time_zone"),
      runtimeTimeZone: readDeviceTimeZone(options.serial).value,
    };

    await importFixture(options.serial, fixtureName);
    for (const requestedTimeZone of ["UTC", "Pacific/Auckland"]) {
      setSetting(options.serial, "global", "auto_time_zone", "0");
      setSetting(options.serial, "global", "time_zone", requestedTimeZone);
      const actual = requestRuntimeTimeZone(options.serial, requestedTimeZone);
      const accepted = verifyRequestedTimeZone(requestedTimeZone, actual.value);
      const observation = {
        requestedTimeZone,
        actualTimeZone: actual.value,
        actualReadback: actual,
        accepted,
        tested: false,
      };
      if (!accepted) {
        observation.blockedReason = `The device kept ${actual.value ?? "no timezone"} after requesting ${requestedTimeZone}.`;
        observations.push(observation);
        continue;
      }

      restartApp(options.serial);
      const node = await waitForNode(
        options.serial,
        timezoneEntryMatcher(entries[0].timestamp),
        { timeoutMs: 10000 },
      );
      observation.tested = true;
      observation.contentDescription = recordedLabelFromNode(node);
      observations.push(observation);
    }
  } catch (error) {
    operationalError = error;
  } finally {
    if (original) {
      try {
        restoreTimeZoneSettings(options.serial, original);
      } catch (error) {
        restoreError = error;
      }
    }
  }

  const finalError = combineOperationalErrors(operationalError, restoreError);
  const evaluation = finalError
    ? null
    : evaluateTimezoneObservations(observations);
  const status = finalError
    ? evidenceStatus({
      routeError: operationalError,
      requiredFailures: restoreError ? [{
        status: isToolUnavailable(restoreError) ? "blocked" : "failed",
      }] : [],
    })
    : evaluation.status;
  const evidence = {
    ...baseEvidence,
    status,
    acceptance: evidenceAcceptance(status),
    observations,
    original,
    ...(evaluation ?? { stableRecordedLabel: false }),
    ...(finalError ? { blocker: finalError.message } : {}),
    restorationError: restoreError?.message ?? null,
  };
  writeEvidence(outputDirectory, evidence);

  if (finalError) throw finalError;
  if (status !== "passed") {
    throw new Error(`Timezone journey was ${status}; requested device states were not both verified.`);
  }
  console.log(`Native timezone evidence: ${outputDirectory}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  evaluateTimezoneObservations,
  parseOptions,
  readDeviceTimeZone,
  selectRuntimeTimeZone,
  setRuntimeTimeZone,
  recordedLabelFromNode,
  requestRuntimeTimeZone,
  timezoneEntryMatcher,
  timezoneEntryTestId,
  verifyRequestedTimeZone,
};
