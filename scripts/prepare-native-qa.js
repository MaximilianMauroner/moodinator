const { execFileSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { writePreparedSourceMetadata } = require("./qa-source-provenance");

// Exact-SHA native evidence must come from a clean checkout. Otherwise the
// copied bytes could differ from the SHA printed below.
const root = path.resolve(__dirname, "..");
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
const destination = mkdtempSync(path.join(tmpdir(), "moodinator-qa-"));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString().split("\0");
const copiedTracked = [];
for (const file of tracked) {
  if (!file || /^(android|ios|node_modules|\.git|\.agents|credentials)\//.test(file)
    || /(^|\/)\.env|credentials|\.(jks|p12|key|pem)$/.test(file)) continue;
  const source = path.join(root, file);
  if (!existsSync(source)) continue; // Deleted tracked file in the working tree.
  const target = path.join(destination, file);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  copiedTracked.push(file);
}
const sourceMetadata = writePreparedSourceMetadata(destination, sourceSha, copiedTracked);
console.log(`QA workspace: ${destination}`);
console.log(`QA source metadata: ${sourceMetadata}`);
console.log(`export MOODINATOR_SOURCE_SHA=${sourceSha}`);
console.log("In that directory: bun install --frozen-lockfile");
console.log("Then: MOODINATOR_VARIANT=qa MOODINATOR_QA_PREPARE_NATIVE=1 bunx expo prebuild --platform android --clean");
console.log("Then: bun run qa:seal-native");
console.log("Then: MOODINATOR_VARIANT=qa bunx expo run:android --variant release --device");
console.log("Select a disposable emulator. The QA package has separate local storage.");
