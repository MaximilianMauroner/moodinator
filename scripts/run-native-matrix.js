const { execFileSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { runAdb } = require("./native-ui");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");
const flow = path.join(root, ".maestro/flows/native-visual-matrix.yaml");

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: bun run qa:matrix -- emulator-5554 [--out /tmp/evidence]");
  process.exit(1);
}

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) usage("Use a disposable emulator serial such as emulator-5554.");

  let output = null;
  while (argv.length) {
    const flag = argv.shift();
    if (flag !== "--out") usage(`Unknown option ${flag}.`);
    output = argv.shift();
    if (!output) usage("Missing value for --out.");
  }

  return { serial, output };
}

function setting(serial, namespace, key) {
  return runAdb(serial, ["shell", "settings", "get", namespace, key]).trim();
}

function setSetting(serial, namespace, key, value) {
  runAdb(serial, ["shell", "settings", "put", namespace, key, value]);
}

function restoreSetting(serial, namespace, key, value, fallback) {
  if (!value || value === "null") {
    runAdb(serial, ["shell", "settings", "delete", namespace, key]);
    return;
  }
  setSetting(serial, namespace, key, value || fallback);
}

function runMaestro(serial) {
  execFileSync("maestro", ["--device", serial, "test", flow], {
    cwd: root,
    stdio: "inherit",
  });
}

function screenshot(serial, filePath) {
  const image = execFileSync("adb", ["-s", serial, "exec-out", "screencap", "-p"], {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(filePath, image);
}

function installGuard(serial) {
  execFileSync("maestro", ["--version"], { stdio: "pipe" });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], {
    encoding: "utf8",
  });
  if (!installed.trim().startsWith("package:")) {
    throw new Error(`The QA package ${appId} is not installed on ${serial}.`);
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  installGuard(options.serial);
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), "moodinator-native-matrix-"));
  mkdirSync(outputDirectory, { recursive: true });

  const original = {
    fontScale: setting(options.serial, "system", "font_scale"),
    nightMode: setting(options.serial, "secure", "ui_night_mode"),
    animation: {
      window: setting(options.serial, "global", "window_animation_scale"),
      transition: setting(options.serial, "global", "transition_animation_scale"),
      animator: setting(options.serial, "global", "animator_duration_scale"),
    },
  };
  const states = [
    { name: "light-large-font", night: "no", reducedMotion: false },
    { name: "dark-large-font", night: "yes", reducedMotion: false },
    { name: "light-large-font-reduced-motion", night: "no", reducedMotion: true },
    { name: "dark-large-font-reduced-motion", night: "yes", reducedMotion: true },
  ];

  writeFileSync(path.join(outputDirectory, "metadata.json"), `${JSON.stringify({
    appId,
    serial: options.serial,
    sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    journey: "native-visual-matrix.yaml",
    states,
    original,
    fabricatedDataOnly: true,
  }, null, 2)}\n`);

  try {
    for (const state of states) {
      setSetting(options.serial, "system", "font_scale", "1.3");
      runAdb(options.serial, ["shell", "cmd", "uimode", "night", state.night]);
      const animationValue = state.reducedMotion
        ? "0"
        : (/^\d+(\.\d+)?$/.test(original.animation.animator) ? original.animation.animator : "1");
      for (const [key, value] of Object.entries({
        window_animation_scale: animationValue,
        transition_animation_scale: animationValue,
        animator_duration_scale: animationValue,
      })) {
        setSetting(options.serial, "global", key, value);
      }

      console.log(`Native matrix state: ${state.name}`);
      runMaestro(options.serial);
      screenshot(options.serial, path.join(outputDirectory, `${state.name}.png`));
    }
  } finally {
    restoreSetting(options.serial, "system", "font_scale", original.fontScale, "1.0");
    restoreSetting(options.serial, "secure", "ui_night_mode", original.nightMode, "0");
    restoreSetting(options.serial, "global", "window_animation_scale", original.animation.window, "1.0");
    restoreSetting(options.serial, "global", "transition_animation_scale", original.animation.transition, "1.0");
    restoreSetting(options.serial, "global", "animator_duration_scale", original.animation.animator, "1.0");
  }

  console.log(`Native matrix evidence: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
