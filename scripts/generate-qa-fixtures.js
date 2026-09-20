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

function nativeStressEditNote(entryIndex, originalNote) {
  if (!originalNote) throw new Error(`Native stress edit ${entryIndex} requires its original note.`);
  return `${originalNote} Edited for QA cycle ${entryIndex}.`;
}

/**
 * Generate only fabricated records. The reference time is intentionally
 * relative to execution so Last 90 days remains a meaningful native filter for
 * every run, including runs in a later year.
 */
function createQaFixture(count, options) {
  const { now } = normalizeFixtureOptions(options);
  const latest = Math.floor(now / HOUR_MS) * HOUR_MS - HOUR_MS;

  const dateNearMissIndex = count > 1081 ? 1081 : count - 1;
  return Array.from({ length: count }, (_, index) => {
    const positive = isPositiveFixtureEntry(index);
    const nearMiss = index >= 1 && index <= 4
      ? ["mood", "emotion", "context", "note"][index - 1]
      : index === dateNearMissIndex ? "date" : null;
    const otherwiseMatching = positive || nearMiss !== null;
    const entry = {
      timestamp: latest - index * 2 * HOUR_MS,
      utcOffsetMinutes: 0,
      mood: otherwiseMatching ? 6 : index % 11,
      note: fixtureNote(index, otherwiseMatching),
      emotions: [{
        name: otherwiseMatching ? "Tired" : "Calm",
        category: otherwiseMatching ? "negative" : "positive",
      }],
      contextTags: [otherwiseMatching ? "Home" : "Work"],
      energy: otherwiseMatching ? 6 : index % 11,
      moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
      basedOnEntryId: null,
    };
    if (nearMiss === "mood") entry.mood = 5;
    if (nearMiss === "emotion") entry.emotions = [{ name: "Calm", category: "positive" }];
    if (nearMiss === "context") entry.contextTags = ["Work"];
    if (nearMiss === "note") entry.note = fixtureNote(index, false);
    if (nearMiss === "date") entry.timestamp = latest - 91 * 24 * HOUR_MS;
    return entry;
  });
}

function matchesCombinedFilter(entry, { start, end }) {
  return (
    entry.timestamp >= start
    && entry.timestamp <= end
    && entry.mood === 6
    && entry.note?.startsWith("QA match ")
    && entry.emotions?.some((emotion) => emotion.name === "Tired")
    && entry.contextTags?.includes("Home")
  );
}

function combinedFilterExpectation(entries, { now = Date.now() } = {}) {
  const start = now - 90 * 24 * HOUR_MS;
  const end = now;
  const matchingEntryIndexes = entries.reduce((indexes, entry, index) => {
    if (matchesCombinedFilter(entry, { start, end })) indexes.push(index + 1);
    return indexes;
  }, []);

  return {
    text: "QA match",
    minMood: 6,
    maxMood: 6,
    emotion: "Tired",
    context: "Home",
    datePreset: "Last 90 days",
    count: matchingEntryIndexes.length,
    matchingEntryIndexes,
  };
}

function applyFixtureNoteEdits(entries, edits) {
  const notesByEntryIndex = new Map();
  for (const edit of edits) {
    if (!Number.isInteger(edit?.entryIndex) || edit.entryIndex < 1 || edit.entryIndex > entries.length) {
      throw new Error(`Fixture edit index is outside the generated dataset: ${edit?.entryIndex}.`);
    }
    if (typeof edit.note !== "string" || !edit.note) {
      throw new Error(`Fixture edit ${edit.entryIndex} must provide a non-empty note.`);
    }
    if (notesByEntryIndex.has(edit.entryIndex)) {
      throw new Error(`Fixture entry ${edit.entryIndex} has more than one note edit.`);
    }
    notesByEntryIndex.set(edit.entryIndex, edit.note);
  }

  return entries.map((entry, index) => {
    const note = notesByEntryIndex.get(index + 1);
    return note === undefined ? entry : { ...entry, note };
  });
}

function applyNativeStressEditMutations(entries, entryIndexes) {
  if (!Array.isArray(entryIndexes)) throw new Error("Native stress edit indexes must be an array.");
  return applyFixtureNoteEdits(
    entries,
    entryIndexes.map((entryIndex) => ({
      entryIndex,
      note: nativeStressEditNote(entryIndex, entries[entryIndex - 1]?.note),
    })),
  );
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
  applyFixtureNoteEdits,
  applyNativeStressEditMutations,
  MATCH_WINDOW_ENTRIES,
  combinedFilterExpectation,
  createQaFixture,
  fixtureIdentity,
  fixtureNote,
  isPositiveFixtureEntry,
  matchesCombinedFilter,
  nativeStressEditNote,
  writeQaFixture,
};
