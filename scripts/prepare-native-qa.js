const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { writePreparedSourceMetadata } = require("./qa-source-provenance");

function prepareNativeQa(root, temporaryRoot = tmpdir()) {
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error(`Originating checkout did not provide a full source SHA: ${sourceSha}`);
  }
  const worktreeStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (worktreeStatus) {
    throw new Error("Native QA preparation requires a clean checkout so evidence matches the printed source SHA.");
  }
  const destination = mkdtempSync(path.join(temporaryRoot, "moodinator-qa-"));
  const tracked = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", "HEAD"], { cwd: root })
    .toString().split("\0");
  const copiedTracked = [];
  for (const file of tracked) {
    if (!file || /^(android|ios|node_modules|\.git|\.agents|credentials)\//.test(file)
      || /(^|\/)\.env|credentials|\.(jks|p12|key|pem)$/.test(file)) continue;
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    const committedBlob = execFileSync("git", ["cat-file", "blob", `${sourceSha}:${file}`], {
      cwd: root,
      maxBuffer: 100 * 1024 * 1024,
    });
    writeFileSync(target, committedBlob);
    copiedTracked.push(file);
  }
  const sourceMetadata = writePreparedSourceMetadata(destination, sourceSha, copiedTracked);
  return { destination, sourceMetadata, sourceSha };
}

if (require.main === module) {
  const result = prepareNativeQa(path.resolve(__dirname, ".."));
  console.log(`QA workspace: ${result.destination}`);
  console.log(`QA source metadata: ${result.sourceMetadata}`);
  console.log(`export MOODINATOR_SOURCE_SHA=${result.sourceSha}`);
  console.log("In that directory: bun install --frozen-lockfile");
  console.log("Then: MOODINATOR_VARIANT=qa MOODINATOR_QA_PREPARE_NATIVE=1 bunx expo prebuild --platform android --clean");
  console.log("Then: bun run qa:seal-native");
  console.log("Then: MOODINATOR_VARIANT=qa bunx expo run:android --variant release --device");
  console.log("Select a disposable emulator. The QA package has separate local storage.");
}

module.exports = { prepareNativeQa };
