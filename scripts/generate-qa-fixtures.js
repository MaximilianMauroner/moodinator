const { writeFileSync } = require("node:fs");

const count = Number(process.argv[2] ?? 1000);
const output = process.argv[3];
if (![100, 1000, 10000].includes(count) || !output) {
  console.error("Usage: bun run qa:fixtures -- <100|1000|10000> <output.json>");
  process.exit(1);
}
// Fixed timestamps and contents make measurements reproducible. No personal data.
const latest = Date.UTC(2026, 8, 1, 12);
const entries = Array.from({ length: count }, (_, index) => ({
  timestamp: latest - index * 6 * 60 * 60 * 1000,
  mood: index % 11,
  note: `QA fixture ${index + 1}: synthetic mood history for performance checks.`,
  emotions: [{ name: index % 2 ? "Calm" : "Tired", category: index % 2 ? "positive" : "negative" }],
  contextTags: [index % 2 ? "Work" : "Home"],
  energy: index % 11,
  moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
  basedOnEntryId: null,
}));
writeFileSync(output, JSON.stringify(entries), { flag: "wx" });
console.log(`Wrote ${count} synthetic entries to ${output}`);
