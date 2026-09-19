const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const { createQaFixture } = require("./generate-qa-fixtures");
const { runAdb, waitForNode, waitForNodeAndTap } = require("./native-ui");

const appId = "com.lab4code.moodinator.qa";
const root = path.resolve(__dirname, "..");
const importFlow = path.join(root, ".maestro/flows/native-stress-import.yaml");

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: bun run qa:timezone -- emulator-5554 [--out /tmp/evidence]");
  process.exit(1);
}

function parseOptions(argv) {
  const serial = argv.shift();
  if (!serial || !/^emulator-\d+$/.test(serial)) usage("Use a disposable emulator serial such as emulator-5554.");
  let output = null;
  while (argv.length) {
    if (argv.shift() !== "--out") usage("Only --out is supported.");
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

function restoreSetting(serial, namespace, key, value) {
  if (!value || value === "null") {
    runAdb(serial, ["shell", "settings", "delete", namespace, key]);
    return;
  }
  setSetting(serial, namespace, key, value);
}

function runMaestro(serial) {
  execFileSync("maestro", ["--device", serial, "test", importFlow], {
    cwd: root,
    stdio: "inherit",
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
  } catch {
    await waitForNodeAndTap(serial, { text: "Downloads", contains: true }, { timeoutMs: 2500 });
    await waitForNodeAndTap(serial, { text: fixtureName }, { timeoutMs: 5000 });
  }
  await waitForNodeAndTap(serial, { text: "Replace Data" }, { timeoutMs: 5000 });
  await waitForNode(serial, { text: "Import Successful", contains: true }, { timeoutMs: 15000 });
  await waitForNodeAndTap(serial, { text: "OK" }, { timeoutMs: 5000 });
}

function installGuard(serial) {
  execFileSync("maestro", ["--version"], { stdio: "pipe" });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], { encoding: "utf8" });
  if (!installed.trim().startsWith("package:")) throw new Error(`The QA package ${appId} is not installed on ${serial}.`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  installGuard(options.serial);
  const outputDirectory = options.output
    ? path.resolve(options.output)
    : mkdtempSync(path.join(tmpdir(), "moodinator-native-timezone-"));
  mkdirSync(outputDirectory, { recursive: true });

  const entries = createQaFixture(100);
  const fixtureName = "moodinator-qa-timezone.json";
  const fixturePath = path.join(outputDirectory, fixtureName);
  writeFileSync(fixturePath, JSON.stringify(entries), { flag: "wx" });
  runAdb(options.serial, ["push", fixturePath, `/sdcard/Download/${fixtureName}`], { timeoutMs: 30000 });

  const original = {
    autoTimeZone: setting(options.serial, "global", "auto_time_zone"),
    timeZone: setting(options.serial, "global", "time_zone"),
  };
  const observations = [];

  try {
    await importFixture(options.serial, fixtureName);
    for (const timeZone of ["UTC", "Pacific/Auckland"]) {
      setSetting(options.serial, "global", "auto_time_zone", "0");
      setSetting(options.serial, "global", "time_zone", timeZone);
      restartApp(options.serial);
      const node = await waitForNode(options.serial, { testId: "mood-entry-1" }, { timeoutMs: 10000 });
      observations.push({ timeZone, contentDescription: node["content-desc"] ?? null });
    }
  } finally {
    restoreSetting(options.serial, "global", "time_zone", original.timeZone);
    restoreSetting(options.serial, "global", "auto_time_zone", original.autoTimeZone);
  }

  const stable = observations.length === 2 && observations[0].contentDescription === observations[1].contentDescription;
  const evidence = {
    appId,
    serial: options.serial,
    sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    fixture: fixturePath,
    recordedOffsetMinutes: entries[0].utcOffsetMinutes,
    observations,
    stableRecordedLabel: stable,
  };
  writeFileSync(path.join(outputDirectory, "timezone.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  if (!stable) throw new Error(`Recorded date/time label changed during timezone travel. Evidence: ${path.join(outputDirectory, "timezone.json")}`);
  console.log(`Native timezone evidence: ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
