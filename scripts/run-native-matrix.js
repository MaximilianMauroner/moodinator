const { execFileSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

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
const flow = path.join(root, ".maestro/flows/native-visual-matrix.yaml");
const SETTING_TIMEOUT_MS = 10000;
const MAESTRO_TIMEOUT_MS = 120000;
const SCREENSHOT_TIMEOUT_MS = 30000;

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) {
    throw new Error("Use a disposable emulator serial such as emulator-5554.");
  }

  const options = { serial, output: null, fixtureNote: null, fixtureCount: null };
  while (argv.length) {
    const flag = argv.shift();
    const value = argv.shift();
    if (!value) throw new Error(`Missing value for ${flag}.`);
    if (flag === "--out") options.output = value;
    else if (flag === "--fixture-note") options.fixtureNote = value;
    else if (flag === "--fixture-count") options.fixtureCount = Number(value);
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (!options.fixtureNote) throw new Error("--fixture-note is required to prove fabricated data is displayed.");
  if (![100, 1000, 10000].includes(options.fixtureCount)) {
    throw new Error("--fixture-count must be 100, 1000, or 10000.");
  }
  return options;
}

function setting(serial, namespace, key) {
  return runAdb(serial, ["shell", "settings", "get", namespace, key], { timeoutMs: SETTING_TIMEOUT_MS }).trim();
}

function setSetting(serial, namespace, key, value) {
  runAdb(serial, ["shell", "settings", "put", namespace, key, value], { timeoutMs: SETTING_TIMEOUT_MS });
}

function readBackSetting(serial, namespace, key, expected) {
  const actual = setting(serial, namespace, key);
  if (actual !== expected) {
    throw new Error(`Android setting ${namespace}.${key} was ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`);
  }
  return actual;
}

function isAbsentSettingValue(value) {
  return !value || value === "null";
}

function readBackAbsentSetting(serial, namespace, key) {
  const actual = setting(serial, namespace, key);
  if (!isAbsentSettingValue(actual)) {
    throw new Error(`Android setting ${namespace}.${key} remained ${JSON.stringify(actual)} after deletion.`);
  }
  return actual;
}

function themeValueForState(night) {
  if (night === "yes") return "2";
  if (night === "no") return "1";
  throw new Error(`Unknown Android night mode: ${night}.`);
}

function setAndReadTheme(serial, night) {
  runAdb(serial, ["shell", "cmd", "uimode", "night", night], { timeoutMs: SETTING_TIMEOUT_MS });
  return readBackSetting(serial, "secure", "ui_night_mode", themeValueForState(night));
}

function animationValueForState(reducedMotion) {
  return reducedMotion ? "0" : "1";
}

function restoreSetting(serial, namespace, key, value, fallback) {
  if (isAbsentSettingValue(value)) {
    runAdb(serial, ["shell", "settings", "delete", namespace, key], { timeoutMs: SETTING_TIMEOUT_MS });
    return readBackAbsentSetting(serial, namespace, key);
  }
  setSetting(serial, namespace, key, value || fallback);
  readBackSetting(serial, namespace, key, value || fallback);
}

function restoreSettings(serial, original) {
  const operations = [
    ["system", "font_scale", original.fontScale, "1.0"],
    ["secure", "ui_night_mode", original.nightMode, "0"],
    ["global", "window_animation_scale", original.animation.window, "1.0"],
    ["global", "transition_animation_scale", original.animation.transition, "1.0"],
    ["global", "animator_duration_scale", original.animation.animator, "1.0"],
  ];
  let firstError = null;
  for (const [namespace, key, value, fallback] of operations) {
    try {
      restoreSetting(serial, namespace, key, value, fallback);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

function runMaestro(serial) {
  execFileSync("maestro", ["--device", serial, "test", flow], {
    cwd: root,
    stdio: "inherit",
    timeout: MAESTRO_TIMEOUT_MS,
  });
}

function screenshot(serial, filePath) {
  const image = execFileSync("adb", ["-s", serial, "exec-out", "screencap", "-p"], {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
    timeout: SCREENSHOT_TIMEOUT_MS,
  });
  writeFileSync(filePath, image);
}

async function captureMatrixScreens(serial, outputDirectory, stateName) {
  const captures = [];
  const capture = (screen) => {
    const filePath = path.join(outputDirectory, `${stateName}-${screen}.png`);
    screenshot(serial, filePath);
    captures.push({ screen, screenshot: filePath });
  };
  capture("home");
  await waitForNodeAndTap(serial, { contentDescription: "Insights tab, view mood history and summaries" });
  await waitForNode(serial, { text: "These are associations in your entries, not explanations.", contains: true }, { timeoutMs: 15000 });
  capture("findings");
  await waitForNodeAndTap(serial, { text: "Charts view" });
  await waitForNode(serial, { text: "Trend" });
  capture("charts");
  await waitForNodeAndTap(serial, { text: "Calendar view" });
  await waitForNode(serial, { contentDescription: "Calendar legend: a dot marks a day with multiple entries." }, { timeoutMs: 15000 });
  capture("calendar");
  await waitForNodeAndTap(serial, { contentDescription: "Settings tab, customize app preferences" });
  await waitForNode(serial, { text: "Settings" }, { timeoutMs: 10000 });
  capture("settings");
  return captures;
}

async function verifyFabricatedFixture(serial, { fixtureNote, fixtureCount }) {
  await waitForNode(serial, {
    allOf: [
      { testId: "history-count" },
      { text: `${fixtureCount} total` },
    ],
  }, { timeoutMs: 10000 });
  await waitForNode(serial, { text: fixtureNote }, { timeoutMs: 10000 });
  return { count: fixtureCount, note: fixtureNote, observed: true };
}

function writeEvidence(outputDirectory, evidence) {
  writeFileSync(path.join(outputDirectory, "summary.json"), `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const sourceSha = requireSourceSha();
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), "moodinator-native-matrix-"));
  mkdirSync(outputDirectory, { recursive: true });

  const states = [
    { name: "light-large-font", night: "no", reducedMotion: false },
    { name: "dark-large-font", night: "yes", reducedMotion: false },
    { name: "light-large-font-reduced-motion", night: "no", reducedMotion: true },
    { name: "dark-large-font-reduced-motion", night: "yes", reducedMotion: true },
  ];
  const baseEvidence = {
    appId,
    serial: options.serial,
    sourceSha,
    journey: "native-visual-matrix.yaml",
    states,
    fabricatedDataOnly: true,
    fixtureExpectation: {
      note: options.fixtureNote,
      count: options.fixtureCount,
    },
  };
  writeFileSync(path.join(outputDirectory, "metadata.json"), `${JSON.stringify(baseEvidence, null, 2)}\n`);

  let original = null;
  const observations = [];
  let operationalError = null;
  let restoreError = null;
  try {
    await assertInstalledQaBuild(options.serial, sourceSha);
    original = {
      fontScale: setting(options.serial, "system", "font_scale"),
      nightMode: setting(options.serial, "secure", "ui_night_mode"),
      animation: {
        window: setting(options.serial, "global", "window_animation_scale"),
        transition: setting(options.serial, "global", "transition_animation_scale"),
        animator: setting(options.serial, "global", "animator_duration_scale"),
      },
    };

    for (const state of states) {
      setSetting(options.serial, "system", "font_scale", "1.3");
      readBackSetting(options.serial, "system", "font_scale", "1.3");
      const themeReadback = setAndReadTheme(options.serial, state.night);

      // Normal motion is explicit and nonzero. It never inherits an unknown
      // prior value such as 0 from a reduced-motion run.
      const animationValue = animationValueForState(state.reducedMotion);
      const animationReadback = {};
      for (const key of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]) {
        setSetting(options.serial, "global", key, animationValue);
        animationReadback[key] = readBackSetting(options.serial, "global", key, animationValue);
      }

      console.log(`Native matrix state: ${state.name}`);
      runMaestro(options.serial);
      const fabricatedFixtureProof = await verifyFabricatedFixture(options.serial, options);
      const screenshots = await captureMatrixScreens(options.serial, outputDirectory, state.name);
      observations.push({
        name: state.name,
        reducedMotion: state.reducedMotion,
        theme: themeReadback,
        animationScale: animationReadback,
        fabricatedFixtureProof,
        screenshots,
      });
    }
  } catch (error) {
    operationalError = error;
  } finally {
    if (original) {
      try {
        restoreSettings(options.serial, original);
      } catch (error) {
        restoreError = error;
      }
    }
  }

  const finalError = combineOperationalErrors(operationalError, restoreError);
  if (finalError) {
    const status = evidenceStatus({
      routeError: operationalError,
      requiredFailures: restoreError ? [{
        status: isToolUnavailable(restoreError) ? "blocked" : "failed",
      }] : [],
    });
    writeEvidence(outputDirectory, {
      ...baseEvidence,
      status,
      acceptance: evidenceAcceptance(status),
      observations,
      original,
      blocker: finalError.message,
      restorationError: restoreError?.message ?? null,
    });
    throw finalError;
  }

  writeEvidence(outputDirectory, {
    ...baseEvidence,
    status: "passed",
    // Automation proves the requested states and captures screenshots. A still
    // image cannot prove reduced-motion behavior, and layout/readability still
    // require visual review.
    acceptance: "pending-visual-review",
    observations,
    original,
  });
  console.log(`Native matrix evidence: ${outputDirectory}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  animationValueForState,
  captureMatrixScreens,
  isAbsentSettingValue,
  parseOptions,
  readBackSetting,
  themeValueForState,
  verifyFabricatedFixture,
};
