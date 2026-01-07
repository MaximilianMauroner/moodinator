import * as SQLite from "expo-sqlite";
import type { MoodEntry, MoodEntryInput } from "./types";
import { DEFAULT_EMOTIONS, DEFAULT_CONTEXTS } from "../src/lib/entrySettings";

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
 * Note: Mood scale is 0-10 where 0-2 are positive, 5 is neutral, 6-10 are negative
 * Generates thousands of entries over multiple years using batch inserts
 */
export async function seedMoods() {
  const db = await getDb();
  // Generate 3 years of data to create thousands of entries
  const days = 1095; // 3 years
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  let totalEntries = 0;

  // Expanded sample notes for variety
  const sampleNotes = [
    "Feeling good today",
    "Had a nice walk",
    "Busy day at work",
    "Feeling a bit tired",
    "Great conversation with a friend",
    "Struggling with motivation",
    "Feeling overwhelmed",
    "Had a good meal",
    "Need to take a break",
    "Feeling anxious about tomorrow",
    "Enjoyed some quiet time",
    "Feeling stressed",
    "Had a productive morning",
    "Feeling down",
    "Good workout today",
    "Woke up feeling refreshed",
    "Had a difficult conversation",
    "Feeling grateful",
    "Not sleeping well lately",
    "Made progress on a project",
    "Feeling lonely",
    "Had fun with family",
    "Work is getting to me",
    "Feeling hopeful",
    "Need more rest",
    "Had a good therapy session",
    "Feeling disconnected",
    "Enjoyed the weather today",
    "Struggling with anxiety",
    "Feeling proud of myself",
    "Had a rough day",
    "Feeling more balanced",
    "Worried about the future",
    "Appreciating the small things",
    "Feeling stuck",
    "Had a breakthrough moment",
    "Feeling drained",
    "Grateful for support",
    "Feeling uncertain",
    "Had a peaceful moment",
    "Struggling to focus",
    "Feeling accomplished",
    "Need to slow down",
    "Feeling inspired",
    "Having a hard time",
    "Feeling content",
    "Dealing with stress",
    "Feeling optimistic",
    "Need some self-care",
    "Feeling supported",
    "Having mixed feelings",
  ];

  // Prepare all entries first
  const entries: Array<{
    mood: number;
    note: string | null;
    timestamp: number;
    emotions: string;
    contextTags: string;
    energy: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    // Realistic entry frequency: 1-2 entries most common, occasionally 0, 3, or 4
    let entriesCount: number;
    const freqRand = Math.random();
    if (freqRand < 0.03) {
      // 3% chance for 0 entries (missed day)
      entriesCount = 0;
    } else if (freqRand < 0.6) {
      // 57% chance for 1 entry
      entriesCount = 1;
    } else if (freqRand < 0.9) {
      // 30% chance for 2 entries
      entriesCount = 2;
    } else if (freqRand < 0.98) {
      // 8% chance for 3 entries
      entriesCount = 3;
    } else {
      // 2% chance for 4 entries
      entriesCount = 4;
    }

    for (let j = 0; j < entriesCount; j++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // More realistic time distribution: waking hours (7am-11pm)
      // Peak times: morning (7-9am), midday (11am-2pm), evening (5-9pm)
      const hourRand = Math.random();
      let hour: number;
      if (hourRand < 0.25) {
        // 25% morning (7-9am)
        hour = Math.floor(Math.random() * 3) + 7;
      } else if (hourRand < 0.5) {
        // 25% midday (11am-2pm)
        hour = Math.floor(Math.random() * 4) + 11;
      } else if (hourRand < 0.75) {
        // 25% evening (5-9pm)
        hour = Math.floor(Math.random() * 5) + 17;
      } else {
        // 25% other waking hours (9am-11am, 2pm-5pm, 9pm-11pm)
        const otherHours = [
          ...Array.from({ length: 3 }, (_, i) => i + 9), // 9-11am
          ...Array.from({ length: 4 }, (_, i) => i + 14), // 2-5pm
          ...Array.from({ length: 3 }, (_, i) => i + 21), // 9-11pm
        ];
        hour = otherHours[Math.floor(Math.random() * otherHours.length)];
      }
      currentDate.setHours(hour);
      currentDate.setMinutes(Math.floor(Math.random() * 60));

      // Accurate mood distribution based on actual scale:
      // 0-2 = Positive (Elated, Very Happy, Good)
      // 3-4 = Positive/Neutral (Positive, Okay)
      // 5 = Neutral
      // 6-10 = Negative (Low, Struggling, Overwhelmed, Crisis, Emergency)
      let mood: number;
      const moodRand = Math.random();
      if (moodRand < 0.15) {
        // 15% chance for positive moods (0-2)
        mood = Math.floor(Math.random() * 3);
      } else if (moodRand < 0.35) {
        // 20% chance for positive/neutral (3-4)
        mood = Math.floor(Math.random() * 2) + 3;
      } else if (moodRand < 0.5) {
        // 15% chance for neutral (5)
        mood = 5;
      } else if (moodRand < 0.85) {
        // 35% chance for low/struggling (6-7)
        mood = Math.floor(Math.random() * 2) + 6;
      } else if (moodRand < 0.97) {
        // 12% chance for overwhelmed (8)
        mood = 8;
      } else {
        // 3% chance for crisis/emergency (9-10)
        mood = Math.floor(Math.random() * 2) + 9;
      }

      // Energy correlates with mood: better mood (lower number) = higher energy
      // Mood 0-2: energy 7-10, Mood 3-4: energy 5-8, Mood 5: energy 4-7,
      // Mood 6-7: energy 3-6, Mood 8: energy 2-5, Mood 9-10: energy 0-3
      let energy: number;
      if (mood <= 2) {
        energy = Math.floor(Math.random() * 4) + 7; // 7-10
      } else if (mood <= 4) {
        energy = Math.floor(Math.random() * 4) + 5; // 5-8
      } else if (mood === 5) {
        energy = Math.floor(Math.random() * 4) + 4; // 4-7
      } else if (mood <= 7) {
        energy = Math.floor(Math.random() * 4) + 3; // 3-6
      } else if (mood === 8) {
        energy = Math.floor(Math.random() * 4) + 2; // 2-5
      } else {
        energy = Math.floor(Math.random() * 4); // 0-3
      }

      // Add emotions frequently (75% chance, 1-4 emotions)
      let emotions: string[] = [];
      if (Math.random() < 0.75) {
        const emotionRand = Math.random();
        let numEmotions: number;
        if (emotionRand < 0.3) {
          // 30% chance for 1 emotion
          numEmotions = 1;
        } else if (emotionRand < 0.65) {
          // 35% chance for 2 emotions
          numEmotions = 2;
        } else if (emotionRand < 0.9) {
          // 25% chance for 3 emotions
          numEmotions = 3;
        } else {
          // 10% chance for 4 emotions
          numEmotions = 4;
        }
        const shuffled = [...DEFAULT_EMOTIONS].sort(() => Math.random() - 0.5);
        emotions = shuffled.slice(
          0,
          Math.min(numEmotions, DEFAULT_EMOTIONS.length)
        );
      }

      // Add context tags frequently (75% chance, 1-3 contexts)
      let contextTags: string[] = [];
      if (Math.random() < 0.75) {
        const contextRand = Math.random();
        let numContexts: number;
        if (contextRand < 0.4) {
          // 40% chance for 1 context
          numContexts = 1;
        } else if (contextRand < 0.8) {
          // 40% chance for 2 contexts
          numContexts = 2;
        } else {
          // 20% chance for 3 contexts
          numContexts = 3;
        }
        const shuffled = [...DEFAULT_CONTEXTS].sort(() => Math.random() - 0.5);
        contextTags = shuffled.slice(
          0,
          Math.min(numContexts, DEFAULT_CONTEXTS.length)
        );
      }

      // Add notes frequently (60% chance)
      const note =
        Math.random() < 0.6
          ? sampleNotes[Math.floor(Math.random() * sampleNotes.length)]
          : null;

      entries.push({
        mood,
        note,
        timestamp: currentDate.getTime(),
        emotions: serializeArray(emotions),
        contextTags: serializeArray(contextTags),
        energy,
      });
      totalEntries++;
    }
  }

  console.log(
    `Prepared ${totalEntries} entries to insert (${entries.length} in array)`
  );

  // Insert entries in batches to avoid transaction timeouts
  const BATCH_SIZE = 1000;
  let insertedCount = 0;

  try {
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await db.withTransactionAsync(async () => {
        for (const entry of batch) {
          await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            entry.mood,
            entry.note,
            entry.timestamp,
            entry.emotions,
            entry.contextTags,
            entry.energy
          );
          insertedCount++;
        }
      });
      // Log progress for large batches
      if (entries.length > 1000 && (i + BATCH_SIZE) % (BATCH_SIZE * 5) === 0) {
        console.log(
          `Seeding progress: ${insertedCount}/${totalEntries} entries`
        );
      }
    }
  } catch (error) {
    console.error("Error seeding moods:", error);
    console.error(
      `Inserted ${insertedCount} out of ${totalEntries} entries before error`
    );
    throw error;
  }

  if (insertedCount !== totalEntries) {
    console.warn(
      `Warning: Expected to insert ${totalEntries} entries but only inserted ${insertedCount}`
    );
  }

  console.log(`Successfully seeded ${insertedCount} mood entries`);
  return insertedCount;
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

/**
 * Calculates the current logging streak (consecutive days with at least one entry)
 * @returns Promise resolving to the current streak count in days
 */
export async function getCurrentStreak(): Promise<number> {
  const db = await getDb();

  // Helper to format a date in local timezone as YYYY-MM-DD
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get all entries ordered by date
  const rows = await db.getAllAsync(
    "SELECT timestamp FROM moods ORDER BY timestamp DESC;"
  );

  if (rows.length === 0) {
    return 0;
  }

  // Convert timestamps to date strings (YYYY-MM-DD) to check consecutive days
  const dates = new Set<string>();
  for (const row of rows) {
    const timestamp = parseTimestamp((row as any).timestamp);
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    const dateStr = formatLocalDate(date);
    dates.add(dateStr);
  }

  const sortedDates = Array.from(dates).sort().reverse();

  // Check if today has an entry
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatLocalDate(today);

  // Check if yesterday has an entry (to allow for flexibility)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  // Streak starts from today or yesterday
  let currentDate: Date;
  if (sortedDates[0] === todayStr) {
    currentDate = today;
  } else if (sortedDates[0] === yesterdayStr) {
    currentDate = yesterday;
  } else {
    // No entry today or yesterday, streak is broken
    return 0;
  }

  let streak = 0;
  for (const dateStr of sortedDates) {
    const expectedDateStr = formatLocalDate(currentDate);
    if (dateStr === expectedDateStr) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Gets streak statistics including current streak, longest streak, and total days logged
 * @returns Promise resolving to streak statistics
 */
export async function getStreakStats(): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalDaysLogged: number;
}> {
  const db = await getDb();

  // Helper to format a date in local timezone as YYYY-MM-DD
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get all entries ordered by date
  const rows = await db.getAllAsync(
    "SELECT timestamp FROM moods ORDER BY timestamp ASC;"
  );

  if (rows.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDaysLogged: 0,
    };
  }

  // Convert timestamps to date strings (YYYY-MM-DD)
  const dates = new Set<string>();
  for (const row of rows) {
    const timestamp = parseTimestamp((row as any).timestamp);
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    const dateStr = formatLocalDate(date);
    dates.add(dateStr);
  }

  const sortedDates = Array.from(dates).sort();
  const totalDaysLogged = sortedDates.length;

  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.floor(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  const currentStreak = await getCurrentStreak();

  return {
    currentStreak,
    longestStreak,
    totalDaysLogged,
  };
}

export interface PatternInsight {
  type: 'day_of_week' | 'context' | 'emotion' | 'time_of_day';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyzes mood patterns and returns insights
 * @returns Promise resolving to an array of pattern insights
 */
export async function getPatternInsights(): Promise<PatternInsight[]> {
  const moods = await getAllMoods();
  const insights: PatternInsight[] = [];

  if (moods.length < 10) {
    return insights; // Need at least 10 entries for meaningful patterns
  }

  // Analyze day of week patterns
  const dayOfWeekMoods: { [key: number]: number[] } = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const entry of moods) {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay();
    if (!dayOfWeekMoods[dayOfWeek]) {
      dayOfWeekMoods[dayOfWeek] = [];
    }
    dayOfWeekMoods[dayOfWeek].push(entry.mood);
  }

  // Find best and worst days
  let bestDay = -1;
  let worstDay = -1;
  let bestAvg = Infinity; // Use Infinity to find minimum
  let worstAvg = -Infinity; // Use -Infinity to find maximum

  for (const [day, moodList] of Object.entries(dayOfWeekMoods)) {
    if (moodList.length >= 3) { // At least 3 entries for a day
      const avg = moodList.reduce((sum, m) => sum + m, 0) / moodList.length;
      if (avg < bestAvg) {
        bestAvg = avg;
        bestDay = Number(day);
      }
      if (avg > worstAvg) {
        worstAvg = avg;
        worstDay = Number(day);
      }
    }
  }

  if (bestDay !== -1 && worstDay !== -1 && bestDay !== worstDay && Math.abs(bestAvg - worstAvg) >= 1) {
    insights.push({
      type: 'day_of_week',
      title: `${dayNames[bestDay]}s are your best days`,
      description: `You tend to feel better on ${dayNames[bestDay]}s compared to other days of the week.`,
      confidence: Math.abs(bestAvg - worstAvg) >= 2 ? 'high' : 'medium',
    });
  }

  // Analyze context patterns
  const contextMoods: { [key: string]: number[] } = {};
  for (const entry of moods) {
    for (const context of entry.contextTags) {
      if (!contextMoods[context]) {
        contextMoods[context] = [];
      }
      contextMoods[context].push(entry.mood);
    }
  }

  const overallAvg = moods.reduce((sum, m) => sum + m.mood, 0) / moods.length;

  for (const [context, moodList] of Object.entries(contextMoods)) {
    if (moodList.length >= 5) { // At least 5 entries
      const avg = moodList.reduce((sum, m) => sum + m, 0) / moodList.length;
      const diff = avg - overallAvg;

      if (diff <= -1.5) {
        insights.push({
          type: 'context',
          title: `${context} improves your mood`,
          description: `Your mood is typically better when you're ${context.toLowerCase()}.`,
          confidence: Math.abs(diff) >= 2.5 ? 'high' : 'medium',
        });
      } else if (diff >= 1.5) {
        insights.push({
          type: 'context',
          title: `${context} correlates with lower mood`,
          description: `You tend to feel worse when ${context.toLowerCase()}.`,
          confidence: Math.abs(diff) >= 2.5 ? 'high' : 'medium',
        });
      }
    }
  }

  // Analyze emotion patterns
  const emotionMoods: { [key: string]: number[] } = {};
  for (const entry of moods) {
    for (const emotion of entry.emotions) {
      if (!emotionMoods[emotion]) {
        emotionMoods[emotion] = [];
      }
      emotionMoods[emotion].push(entry.mood);
    }
  }

  for (const [emotion, moodList] of Object.entries(emotionMoods)) {
    if (moodList.length >= 5) {
      const avg = moodList.reduce((sum, m) => sum + m, 0) / moodList.length;
      const diff = avg - overallAvg;

      if (diff >= 1.5) {
        insights.push({
          type: 'emotion',
          title: `${emotion} occurs with worse moods`,
          description: `When you feel ${emotion.toLowerCase()}, your overall mood tends to be lower.`,
          confidence: Math.abs(diff) >= 2.5 ? 'high' : 'medium',
        });
      }
    }
  }

  // Analyze time of day patterns
  const morningMoods: number[] = []; // 6am - 12pm
  const afternoonMoods: number[] = []; // 12pm - 6pm
  const eveningMoods: number[] = []; // 6pm - 12am
  const nightMoods: number[] = []; // 12am - 6am

  for (const entry of moods) {
    const date = new Date(entry.timestamp);
    const hour = date.getHours();

    if (hour >= 6 && hour < 12) {
      morningMoods.push(entry.mood);
    } else if (hour >= 12 && hour < 18) {
      afternoonMoods.push(entry.mood);
    } else if (hour >= 18 && hour < 24) {
      eveningMoods.push(entry.mood);
    } else {
      // hour >= 0 && hour < 6
      nightMoods.push(entry.mood);
    }
  }

  const timeSlots = [
    { name: 'morning', moods: morningMoods, label: 'mornings' },
    { name: 'afternoon', moods: afternoonMoods, label: 'afternoons' },
    { name: 'evening', moods: eveningMoods, label: 'evenings' },
    { name: 'night', moods: nightMoods, label: 'late night/early morning' },
  ];

  let bestTime = '';
  let lowestTimeAvg = Infinity; // Lowest avg mood (best mood)
  let worstTime = '';
  let highestTimeAvg = -Infinity; // Highest avg mood (worst mood)

  for (const slot of timeSlots) {
    if (slot.moods.length >= 5) {
      const avg = slot.moods.reduce((sum, m) => sum + m, 0) / slot.moods.length;
      if (avg < lowestTimeAvg) {
        lowestTimeAvg = avg;
        bestTime = slot.label;
      }
      if (avg > highestTimeAvg) {
        highestTimeAvg = avg;
        worstTime = slot.label;
      }
    }
  }

  if (bestTime && worstTime && bestTime !== worstTime && Math.abs(lowestTimeAvg - highestTimeAvg) >= 1) {
    insights.push({
      type: 'time_of_day',
      title: `You feel better in the ${bestTime}`,
      description: `Your mood is typically higher during ${bestTime} compared to other times of day.`,
      confidence: Math.abs(lowestTimeAvg - highestTimeAvg) >= 2 ? 'high' : 'medium',
    });
  }

  return insights;
}
