const {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const buildLockPath = path.join(os.tmpdir(), "moodinator-local-android-build.lock");
const maxBuildRamMb = 4096;
const minAvailableRamMb = Number(
  process.env.MOODINATOR_BUILD_MIN_AVAILABLE_MB ?? 384
);
const waitIntervalMs = 5000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readAvailableRamMb() {
  if (process.platform === "linux") {
    try {
      const availableLine = readFileSync("/proc/meminfo", "utf8")
        .split(/\r?\n/)
        .find((line) => line.startsWith("MemAvailable:"));
      const availableKb = Number(availableLine?.match(/\d+/)?.[0]);
      if (Number.isFinite(availableKb)) return availableKb / 1024;
    } catch {
      // Fall back to the portable OS value below.
    }
  }

  return os.freemem() / 1024 / 1024;
}

function getMemorySnapshot() {
  return {
    totalMb: os.totalmem() / 1024 / 1024,
    availableMb: readAvailableRamMb(),
  };
}

function formatMemory(memory) {
  return `${Math.round(memory.availableMb)} MB available / ${Math.round(memory.totalMb)} MB total`;
}

function listBuildProcesses() {
  if (process.platform === "win32") return [];

  const result = spawnSync("ps", ["-eo", "pid=,args="], {
    encoding: "utf8",
  });
  if (result.status !== 0 || typeof result.stdout !== "string") return [];

  const buildCommand =
    /\beas(?:\.cmd)?\s+build\b|\bgradlew?(?:\.bat)?\b.*\bassemble\w*\b|\bexpo(?:\.js)?\s+run:android\b|\bbuild-local-android\.js\b/i;

  return result.stdout
    .split(/\r?\n/)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : null;
    })
    .filter((processInfo) =>
      processInfo &&
      processInfo.pid !== process.pid &&
      buildCommand.test(processInfo.command)
    );
}

function readLockOwner() {
  if (!existsSync(buildLockPath)) return null;

  try {
    const pid = Number(readFileSync(buildLockPath, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0) return pid;
  } catch {
    // Treat an unreadable temporary lock as stale and recover below.
  }

  try {
    unlinkSync(buildLockPath);
  } catch {
    // Another waiter may have recovered the same stale lock.
  }
  return null;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function releaseBuildLock() {
  try {
    unlinkSync(buildLockPath);
  } catch {
    // The lock may already have been removed during shutdown recovery.
  }
}

function acquireBuildLock() {
  const descriptor = openSync(buildLockPath, "wx");
  try {
    writeSync(descriptor, `${process.pid}\n`);
  } finally {
    closeSync(descriptor);
  }
}

async function waitForBuildResources() {
  while (true) {
    const reasons = [];
    const lockOwner = readLockOwner();
    if (lockOwner && lockOwner !== process.pid) {
      if (isProcessAlive(lockOwner)) {
        reasons.push(`local build lock held by PID ${lockOwner}`);
      } else {
        releaseBuildLock();
      }
    }

    const activeBuilds = listBuildProcesses();
    if (activeBuilds.length > 0) {
      reasons.push(
        `another build is running (${activeBuilds
          .map((processInfo) => `PID ${processInfo.pid}`)
          .join(", ")})`
      );
    }

    const memory = getMemorySnapshot();
    if (memory.availableMb < minAvailableRamMb) {
      reasons.push(
        `only ${Math.round(memory.availableMb)} MB is available; reserving ${minAvailableRamMb} MB`
      );
    }

    if (reasons.length > 0) {
      console.log(`Waiting before Android build: ${reasons.join("; ")}. ${formatMemory(memory)}.`);
      await sleep(waitIntervalMs);
      continue;
    }

    try {
      acquireBuildLock();
    } catch (error) {
      if (error?.code === "EEXIST") {
        await sleep(waitIntervalMs);
        continue;
      }
      throw error;
    }

    const postLockBuilds = listBuildProcesses();
    const postLockMemory = getMemorySnapshot();
    if (
      postLockBuilds.length > 0 ||
      postLockMemory.availableMb < minAvailableRamMb
    ) {
      releaseBuildLock();
      await sleep(waitIntervalMs);
      continue;
    }

    console.log(
      `Starting Android build with a ${maxBuildRamMb} MB configured cap. ${formatMemory(postLockMemory)}.`
    );
    return releaseBuildLock;
  }
}

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

waitForBuildResources()
  .then((releaseBuildLock) => {
    const easCommand = process.platform === "win32" ? "eas.cmd" : "eas";
    const result = spawnSync(
      easCommand,
      [
        "build",
        "--platform",
        "android",
        "--profile",
        "local-apk",
        "--local",
        ...process.argv.slice(2),
      ],
      { cwd: root, env: process.env, stdio: "inherit" }
    );

    releaseBuildLock();

    if (result.error) {
      console.error(result.error.message);
      process.exit(1);
    }

    process.exit(result.status ?? 1);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    releaseBuildLock();
    process.exit(1);
  });
