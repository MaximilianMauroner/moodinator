const { writeFileSync } = require("node:fs");

const HOUR_MS = 60 * 60 * 1000;
const MATCH_WINDOW_ENTRIES = 600;
const MATCH_STRIDE = 10;

function normalizeFixtureOptions(options) {
  if (typeof options === "number") return { now: options };
  const now = options?.now ?? Date.now();
  if (!Number.isFinite(now)) throw new Error("Fixture reference time must be a finite timestamp.");
  return { now };
}

function isPositiveFixtureEntry(index) {
  return index < MATCH_WINDOW_ENTRIES && index % MATCH_STRIDE === 0;
}

function fixtureNote(index, positive) {
  return `${positive ? "QA match" : "QA other"} ${String(index + 1).padStart(4, "0")}: fabricated native stress record.`;
}

/**
 * Generate only fabricated records. The reference time is intentionally
 * relative to execution so Last 90 days remains a meaningful native filter for
 * every run, including runs in a later year.
 */
function createQaFixture(count, options) {
  const { now } = normalizeFixtureOptions(options);
  const latest = Math.floor(now / HOUR_MS) * HOUR_MS - HOUR_MS;

  return Array.from({ length: count }, (_, index) => {
    const positive = isPositiveFixtureEntry(index);
    return {
      timestamp: latest - index * 2 * HOUR_MS,
      utcOffsetMinutes: 0,
      mood: positive ? 6 : index % 11,
      note: fixtureNote(index, positive),
      emotions: [{
        name: positive ? "Tired" : "Calm",
        category: positive ? "negative" : "positive",
      }],
      contextTags: [positive ? "Home" : "Work"],
      energy: positive ? 6 : index % 11,
      moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
      basedOnEntryId: null,
    };
  });
}

function combinedFilterExpectation(entries, { now = Date.now() } = {}) {
  const start = now - 90 * 24 * HOUR_MS;
  return {
    text: "QA match",
    minMood: 6,
    maxMood: 6,
    emotion: "Tired",
    context: "Home",
    datePreset: "Last 90 days",
    count: entries.filter((entry) => (
      entry.timestamp >= start
      && entry.timestamp <= now
      && entry.mood === 6
      && entry.note.startsWith("QA match ")
      && entry.emotions?.some((emotion) => emotion.name === "Tired")
      && entry.contextTags?.includes("Home")
    )).length,
  };
}

function fixtureIdentity(entries, index, { editedNote = null } = {}) {
  const entry = entries[index - 1];
  if (!entry) throw new Error(`Fixture does not contain entry ${index}.`);
  return {
    entryIndex: index,
    timestamp: entry.timestamp,
    mood: entry.mood,
    note: editedNote ?? entry.note,
    originalNote: entry.note,
  };
}

function writeQaFixture(count, output, options) {
  if (![100, 1000, 10000].includes(count) || !output) {
    throw new Error("Usage: bun run qa:fixtures -- <100|1000|10000> <output.json>");
  }

  const entries = createQaFixture(count, options);
  writeFileSync(output, JSON.stringify(entries), { flag: "wx" });
  return entries;
}

if (require.main === module) {
  const count = Number(process.argv[2] ?? 1000);
  const output = process.argv[3];

  try {
    writeQaFixture(count, output);
    console.log(`Wrote ${count} fabricated entries to ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  HOUR_MS,
  MATCH_STRIDE,
  MATCH_WINDOW_ENTRIES,
  combinedFilterExpectation,
  createQaFixture,
  fixtureIdentity,
  fixtureNote,
  isPositiveFixtureEntry,
  writeQaFixture,
};
