const { execFileSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdirSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

// Copy the working tree, including current edits, without native build folders,
// credentials, personal scratch files, or a dependency tree shared with another run.
const root = path.resolve(__dirname, "..");
const destination = mkdtempSync(path.join(tmpdir(), "moodinator-qa-"));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString().split("\0");
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root })
  .toString().split("\0")
  .filter((file) => /^(src\/|db\/|domain\/|assets\/|scripts\/|__tests__\/|docs\/|\.maestro\/|app\.config\.js$|\.node-version$)/.test(file));
for (const file of new Set([...tracked, ...untracked])) {
  if (!file || /^(android|ios|node_modules|\.git|\.agents|credentials)\//.test(file)
    || /(^|\/)\.env|credentials|\.(jks|p12|key|pem)$/.test(file)) continue;
  const source = path.join(root, file);
  if (!existsSync(source)) continue; // Deleted tracked file in the working tree.
  const target = path.join(destination, file);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}
console.log(`QA workspace: ${destination}`);
console.log("In that directory: bun install --frozen-lockfile");
console.log("Then: MOODINATOR_VARIANT=qa bunx expo run:android --variant release --device");
console.log("Select a disposable emulator. The QA package has separate local storage.");
