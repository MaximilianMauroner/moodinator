const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function sdkFromLocalProperties() {
  const localPropertiesPath = path.join(root, "android", "local.properties");
  if (!existsSync(localPropertiesPath)) return undefined;

  const sdkLine = readFileSync(localPropertiesPath, "utf8")
    .split(/\r?\n/)
    .find((line) => /^\s*sdk\.dir\s*=/.test(line));

  return sdkLine?.replace(/^\s*sdk\.dir\s*=\s*/, "").replace(/\\:/g, ":").trim();
}

function sdkFromAdbPath() {
  const adbPath = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((directory) => path.join(directory, process.platform === "win32" ? "adb.exe" : "adb"))
    .find((adbPath) => existsSync(adbPath));

  return adbPath ? path.dirname(path.dirname(adbPath)) : undefined;
}

const sdkPath =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  sdkFromLocalProperties() ||
  sdkFromAdbPath();

if (!sdkPath) {
  console.error(
    "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or configure android/local.properties."
  );
  process.exit(1);
}

process.env.ANDROID_HOME = sdkPath;
process.env.ANDROID_SDK_ROOT = sdkPath;

const easCommand = process.platform === "win32" ? "eas.cmd" : "eas";
const result = spawnSync(
  easCommand,
  ["build", "--platform", "android", "--profile", "local-apk", "--local", ...process.argv.slice(2)],
  { cwd: root, env: process.env, stdio: "inherit" }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
