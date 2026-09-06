const { execFileSync } = require("node:child_process");
const path = require("node:path");

const appId = "com.lab4code.moodinator.qa";
const serial = process.argv[2];
if (!serial || !/^emulator-\d+$/.test(serial)) {
  console.error("Usage: bun run qa:smoke -- emulator-5554 (disposable Android emulator only)");
  process.exit(1);
}
try {
  execFileSync("maestro", ["--version"], { stdio: "pipe" });
  const installed = execFileSync("adb", ["-s", serial, "shell", "pm", "path", appId], { encoding: "utf8" });
  if (!installed.trim().startsWith("package:")) throw new Error("Moodinator QA is not installed on this emulator.");
  execFileSync("maestro", ["--device", serial, "test", ".maestro/smoke.yaml"], {
    cwd: path.resolve(__dirname, ".."), stdio: "inherit",
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
