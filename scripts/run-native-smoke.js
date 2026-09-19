const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { waitForNode } = require("./native-ui");
const { runMaestroAndTapUndo } = require("./native-qa-runner");

const appId = "com.lab4code.moodinator.qa";
const serial = process.argv[2];
if (!serial || !/^emulator-\d+$/.test(serial)) {
  console.error("Usage: bun run qa:smoke -- emulator-5554 (disposable Android emulator only)");
  process.exit(1);
}
async function main() {
  execFileSync("maestro", ["--version"], { stdio: "pipe" });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], { encoding: "utf8" });
  if (!installed.trim().startsWith("package:")) throw new Error("Moodinator QA is not installed on this emulator.");
  // The smoke flow intentionally ends immediately after Delete entry. ADB
  // inspects the live accessibility tree and taps the reported bounds before
  // the five-second product toast expires. This keeps the acceptance check
  // deterministic without changing production toast duration or using a
  // device-specific coordinate.
  const undo = await runMaestroAndTapUndo(
    serial,
    ".maestro/smoke.yaml",
    { cwd: path.resolve(__dirname, "..") },
  );
  const restoredRow = await waitForNode(serial, {
    testIdPrefix: "mood-entry-actions-",
    description: "a restored mood entry action control",
  }, { timeoutMs: 2500 });

  console.log(
    `Undo restored a row via ${undo.node["resource-id"] ?? "the inspected control"} ` +
      `at (${undo.point.x},${undo.point.y}); row=${restoredRow["resource-id"] ?? "unknown"}`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
