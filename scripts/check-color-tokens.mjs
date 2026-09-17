#!/usr/bin/env node
/**
 * Fails when the same themed colour pair is written inline in more than one
 * file.
 *
 * The problem this guards against is duplication, not hex literals as such. A
 * pair chosen once, in one component, is a local decision. The same pair
 * repeated across screens is a missing token: it escapes src/constants/colors.ts
 * and the contrast tests that guard it, and it has to be found by hand whenever
 * the palette changes.
 *
 * An ESLint rule cannot express this, because it sees one file at a time.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = path.join(ROOT, "src");
const PALETTE = path.join(SOURCE_DIR, "constants", "colors.ts");
const PAIR = /isDark\s*\?\s*"(#[0-9A-Fa-f]{3,8})"\s*:\s*"(#[0-9A-Fa-f]{3,8})"/g;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(full) && full !== PALETTE ? [full] : [];
  });
}

const usage = new Map();

for (const file of sourceFiles(SOURCE_DIR)) {
  const text = fs.readFileSync(file, "utf8");
  for (const [, dark, light] of text.matchAll(PAIR)) {
    const key = `${light.toUpperCase()} light / ${dark.toUpperCase()} dark`;
    if (!usage.has(key)) usage.set(key, new Set());
    usage.get(key).add(path.relative(ROOT, file));
  }
}

const duplicated = [...usage]
  .filter(([, files]) => files.size > 1)
  .sort((a, b) => b[1].size - a[1].size);

if (duplicated.length === 0) {
  console.log(
    `check-color-tokens: ok, ${usage.size} inline pair(s), none repeated across files`
  );
  process.exit(0);
}

console.error(
  `check-color-tokens: ${duplicated.length} colour pair(s) are inlined in more than one file.\n` +
    `Add each to src/constants/colors.ts and read it with getThemedColor(token, isDark).\n`
);
for (const [pair, files] of duplicated) {
  console.error(`  ${pair}  (${files.size} files)`);
  for (const file of [...files].sort()) console.error(`      ${file}`);
}
process.exit(1);
