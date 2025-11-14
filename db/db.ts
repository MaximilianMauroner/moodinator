import * as SQLite from "expo-sqlite";
import type { MoodEntry, MoodEntryInput } from "./types";

let db: SQLite.SQLiteDatabase | null = null;
/**
 * Opens the database if not already open.
 */
async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("moodinator.db", {
      useNewConnection: true,
      finalizeUnusedStatementsBeforeClosing: true,
    });
  }
  return db;
}

/**
 * Creates the 'moods' table if it does not exist.
 */
export async function createMoodTable() {
  const db = await getDb();
  await db.execAsync(`
        CREATE TABLE IF NOT EXISTS moods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mood INTEGER NOT NULL,
            note TEXT,
            timestamp DATETIME,
            emotions TEXT DEFAULT '[]',
            context_tags TEXT DEFAULT '[]',
            energy INTEGER
        );
    `);
  await ensureMoodTableColumns(db);
}

async function ensureMoodTableColumns(database: SQLite.SQLiteDatabase) {
  const columns = await database.getAllAsync("PRAGMA table_info(moods);");
  const existing = new Set(columns.map((col: any) => col.name));

  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: "emotions",
      sql: "ALTER TABLE moods ADD COLUMN emotions TEXT DEFAULT '[]';",
    },
    {
      name: "context_tags",
      sql: "ALTER TABLE moods ADD COLUMN context_tags TEXT DEFAULT '[]';",
    },
    {
      name: "energy",
      sql: "ALTER TABLE moods ADD COLUMN energy INTEGER;",
    },
  ];

  for (const migration of migrations) {
    if (!existing.has(migration.name)) {
      await database.execAsync(migration.sql);
    }
  }
}

function serializeArray(value?: string[]): string {
  if (!value || value.length === 0) {
    return "[]";
  }
  return JSON.stringify(value.slice(0, 50));
}

function deserializeArray(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function parseTimestamp(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function toMoodEntry(row: any): MoodEntry {
  return {
    id: row.id,
    mood: row.mood,
    note: row.note ?? null,
    timestamp: parseTimestamp(row.timestamp),
    emotions: deserializeArray(row.emotions),
    contextTags: deserializeArray(row.context_tags),
    energy:
      row.energy === null || row.energy === undefined
        ? null
        : Number(row.energy),
  };
}

function normalizeInput(entry: MoodEntryInput) {
  return {
    note: entry.note ?? null,
    emotions: entry.emotions ? entry.emotions.slice(0, 50) : [],
    contextTags: entry.contextTags ? entry.contextTags.slice(0, 50) : [],
    energy:
      entry.energy === null || entry.energy === undefined
        ? null
        : Math.min(10, Math.max(0, Math.round(entry.energy))),
    timestamp: entry.timestamp ?? Date.now(),
  };
}

function sanitizeImportedArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 50);
}

function sanitizeEnergy(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

/**
 * Inserts a new mood entry into the database.
 * @param mood - Mood value (integer)
 * @param note - Optional note
 * @returns Promise with the SQLite result
 */
export async function insertMood(
  mood: number,
  note?: string,
  metadata?: Omit<MoodEntryInput, "mood" | "note">
): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput({
    mood,
    note: note ?? null,
    ...metadata,
  });
  const result = await db.runAsync(
    "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
    mood,
    normalized.note,
    normalized.timestamp,
    serializeArray(normalized.emotions),
    serializeArray(normalized.contextTags),
    normalized.energy
  );
  const inserted = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    result.lastInsertRowId
  );
  return toMoodEntry(inserted);
}

/**
 * Inserts a new mood entry with all its fields into the database.
 * @param entry - MoodEntry object containing all fields
 * @returns Promise with the inserted MoodEntry
 */
export async function insertMoodEntry(
  entry: MoodEntryInput
): Promise<MoodEntry> {
  const db = await getDb();
  const normalized = normalizeInput(entry);
  const result = await db.runAsync(
    "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
    entry.mood,
    normalized.note,
    normalized.timestamp,
    serializeArray(normalized.emotions),
    serializeArray(normalized.contextTags),
    normalized.energy
  );
  const inserted = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    result.lastInsertRowId
  );
  return toMoodEntry(inserted);
}

/**
 * Checks if a mood has been logged today.
 * @returns Promise resolving to boolean
 */
export async function hasMoodBeenLoggedToday(): Promise<boolean> {
  const db = await getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const result = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM moods WHERE timestamp >= ? AND timestamp <= ?;",
    todayStart.getTime(),
    todayEnd.getTime()
  );

  return (result as any).count > 0;
}

/**
 * Updates only the note of a mood entry by its ID and returns the updated mood entry.
 * @param id - The ID of the mood entry to update
 * @param note - The new note
 * @returns Promise resolving to the updated MoodEntry
 */
export async function updateMoodNote(
  id: number,
  note: string
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync("UPDATE moods SET note = ? WHERE id = ?;", note, id);
  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

/**
 * Updates the timestamp of a mood entry by its ID and returns the updated mood entry.
 * @param id - The ID of the mood entry to update
 * @param timestamp - The new timestamp
 * @returns Promise resolving to the updated MoodEntry
 */
export async function updateMoodTimestamp(
  id: number,
  timestamp: number
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE moods SET timestamp = ? WHERE id = ?;",
    timestamp,
    id
  );
  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

export async function updateMoodEntry(
  id: number,
  updates: Partial<MoodEntryInput & { mood: number }>
): Promise<MoodEntry | undefined> {
  const db = await getDb();
  const fields: string[] = [];
  const params: any[] = [];

  if (typeof updates.mood === "number") {
    fields.push("mood = ?");
    params.push(updates.mood);
  }
  if (updates.note !== undefined) {
    fields.push("note = ?");
    params.push(updates.note);
  }
  if (updates.timestamp !== undefined) {
    fields.push("timestamp = ?");
    params.push(updates.timestamp);
  }
  if (updates.emotions !== undefined) {
    fields.push("emotions = ?");
    params.push(serializeArray(updates.emotions));
  }
  if (updates.contextTags !== undefined) {
    fields.push("context_tags = ?");
    params.push(serializeArray(updates.contextTags));
  }
  if (updates.energy !== undefined) {
    fields.push("energy = ?");
    params.push(
      updates.energy === null
        ? null
        : Math.min(10, Math.max(0, Math.round(updates.energy)))
    );
  }

  if (!fields.length) {
    const current = await db.getFirstAsync(
      "SELECT * FROM moods WHERE id = ?;",
      id
    );
    return current ? toMoodEntry(current) : undefined;
  }

  await db.runAsync(
    `UPDATE moods SET ${fields.join(", ")} WHERE id = ?;`,
    ...params,
    id
  );
  const updated = await db.getFirstAsync(
    "SELECT * FROM moods WHERE id = ?;",
    id
  );
  return updated ? toMoodEntry(updated) : undefined;
}

/**
 * Retrieves all mood entries, ordered by timestamp descending.
 * @returns Promise resolving to an array of MoodEntry
 */
export async function getAllMoods(): Promise<MoodEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM moods ORDER BY timestamp DESC;"
  );
  return rows.map(toMoodEntry);
}

/**
 * Deletes a mood entry by its ID.
 * @param id - The ID of the mood entry to delete
 * @returns Promise with the SQLite result
 */
export async function deleteMood(id: number) {
  const db = await getDb();
  const res = await db.runAsync("DELETE FROM moods WHERE id = ?;", id);
  return res;
}

/**
 * Seeds the database with random mood entries (DEV only)
 */
export async function seedMoods() {
  const db = await getDb();
  const days = 60;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  let totalEntries = 0;

  for (let i = 0; i < days; i++) {
    // Random number of entries per day (0-3, more realistic)
    const entriesCount = Math.floor(Math.random() * 4);

    for (let j = 0; j < entriesCount; j++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // Random time during the day
      currentDate.setHours(Math.floor(Math.random() * 24));
      currentDate.setMinutes(Math.floor(Math.random() * 60));

      // More realistic mood distribution (3-8 most common, with occasional extremes)
      let mood: number;
      const rand = Math.random();
      if (rand < 0.7) {
        // 70% chance for moderate moods (4-6)
        mood = Math.floor(Math.random() * 3) + 4;
      } else if (rand < 0.9) {
        // 20% chance for good moods (7-8)
        mood = Math.floor(Math.random() * 2) + 7;
      } else if (rand < 0.95) {
        // 5% chance for low moods (2-3)
        mood = Math.floor(Math.random() * 2) + 2;
      } else {
        // 5% chance for extreme moods (0-1, 9-10)
        mood =
          Math.random() < 0.5
            ? Math.floor(Math.random() * 2)
            : Math.floor(Math.random() * 2) + 9;
      }

      // Occasionally add notes (10% chance)
      const note = Math.random() < 0.1 ? "Random seed entry" : null;

      await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood,
        note,
        currentDate.getTime(),
        serializeArray([]),
        serializeArray([]),
        Math.floor(Math.random() * 11)
      );
      totalEntries++;
    }
  }
  return totalEntries;
}

/**
 * Clears all mood entries from the database (DEV only)
 */
export async function clearMoods() {
  if (!__DEV__) return;
  const db = await getDb();
  await db.runAsync("DELETE FROM moods;");
}

// Ensure the moods table exists as soon as this module is loaded
void createMoodTable();

/**
 * Gets the total count of mood entries efficiently without loading all data.
 * @returns Promise resolving to the number of mood entries
 */
export async function getMoodCount(): Promise<number> {
  const db = await getDb();
  // Prefer cached count when available
  const result = await db.getFirstAsync("SELECT COUNT(*) as count FROM moods");
  const count = (result as any)?.count || 0;
  return count;
}

/**
 * Exports all mood entries to a JSON string
 * @returns Promise resolving to a JSON string of all mood entries
 */
export type MoodRangePreset = "week" | "twoWeeks" | "month";

export type MoodDateRange =
  | { preset: MoodRangePreset }
  | { startDate: number; endDate: number };

function resolveDateRange(range?: MoodDateRange) {
  if (!range) {
    return {};
  }
  if ("preset" in range) {
    const now = Date.now();
    const days =
      range.preset === "week" ? 7 : range.preset === "twoWeeks" ? 14 : 30;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    return { startDate: startDate.getTime(), endDate: now };
  }
  return {
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export async function getMoodsWithinRange(
  range?: MoodDateRange
): Promise<MoodEntry[]> {
  const db = await getDb();
  const { startDate, endDate } = resolveDateRange(range);
  const conditions: string[] = [];
  const params: any[] = [];

  if (typeof startDate === "number") {
    conditions.push("timestamp >= ?");
    params.push(startDate);
  }
  if (typeof endDate === "number") {
    conditions.push("timestamp <= ?");
    params.push(endDate);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const rows = await db.getAllAsync(
    `SELECT * FROM moods ${whereClause} ORDER BY timestamp DESC;`,
    ...params
  );
  return rows.map(toMoodEntry);
}

export async function exportMoods(range?: MoodDateRange): Promise<string> {
  const moods = await getMoodsWithinRange(range);
  return JSON.stringify(
    moods.map((entry) => ({
      timestamp: entry.timestamp,
      mood: entry.mood,
      emotions: entry.emotions,
      context: entry.contextTags,
      energy: entry.energy,
      notes: entry.note,
    }))
  );
}

/**
 * Imports mood entries from a JSON string
 * @param jsonData - JSON string containing mood entries
 * @returns Promise resolving to the number of imported entries
 */
export async function importMoods(jsonData: string): Promise<number> {
  try {
    const moods = JSON.parse(jsonData) as MoodEntry[];
    const db = await getDb();

    for (const mood of moods) {
      const note = (mood as any)?.notes ?? (mood as any)?.note ?? null;
      const timestamp = parseTimestamp((mood as any)?.timestamp);
      const emotions = sanitizeImportedArray((mood as any)?.emotions);
      const contextSource =
        (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy((mood as any)?.energy);
      await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeArray(emotions),
        serializeArray(contextTags),
        energy
      );
    }
    return moods.length;
  } catch (error) {
    console.error("Error importing moods:", error);
    throw new Error("Invalid mood data format");
  }
}

/**
 * Seeds the database from a JSON file or with random data based on environment
 */
export async function seedMoodsFromFile(): Promise<{
  source: "file" | "random";
  count: number;
}> {
  // First clear existing data
  await clearMoods();

  if (__DEV__) {
    // In development mode, try to load from JSON file
    try {
      const jsonData = require("./export.json");

      if (Array.isArray(jsonData) && jsonData.length > 0) {
        const db = await getDb();

        for (const mood of jsonData) {
          const note = (mood as any)?.notes ?? (mood as any)?.note ?? null;
          const emotions = sanitizeImportedArray((mood as any)?.emotions);
          const contextSource =
            (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
          const contextTags = sanitizeImportedArray(contextSource);
          const energy = sanitizeEnergy((mood as any)?.energy);
          const timestamp = parseTimestamp((mood as any)?.timestamp);
          await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            mood.mood,
            note,
            timestamp,
            serializeArray(emotions),
            serializeArray(contextTags),
            energy
          );
        }

        return { source: "file", count: jsonData.length };
      }
    } catch (error) {
      console.log(
        "JSON file not found or invalid in dev mode, falling back to random seed"
      );
    }
  }

  // In production mode or if file loading fails in dev mode, use random seeding
  const totalEntries = await seedMoods();
  return { source: "random", count: totalEntries };
}
