import * as SQLite from "expo-sqlite";
import type { MoodEntry, MoodEntryInput, Emotion } from "./types";
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
 * Creates the 'emotions' table if it does not exist.
 */
export async function createEmotionsTable() {
  const db = await getDb();
  await db.execAsync(`
        CREATE TABLE IF NOT EXISTS emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL CHECK(category IN ('positive', 'negative', 'neutral'))
        );
    `);
}

/**
 * Creates the 'mood_emotions' junction table if it does not exist.
 */
export async function createMoodEmotionsTable() {
  const db = await getDb();
  await db.execAsync(`
        CREATE TABLE IF NOT EXISTS mood_emotions (
            mood_id INTEGER NOT NULL,
            emotion_id INTEGER NOT NULL,
            PRIMARY KEY (mood_id, emotion_id),
            FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
            FOREIGN KEY (emotion_id) REFERENCES emotions(id) ON DELETE CASCADE
        );
    `);
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
  await createEmotionsTable();
  await createMoodEmotionsTable();
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

function serializeEmotions(value?: Emotion[]): string {
  if (!value || value.length === 0) {
    return "[]";
  }
  return JSON.stringify(value.slice(0, 50));
}

function deserializeEmotions(value: unknown): Emotion[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Support both old format (strings) and new format (objects)
    return parsed.map((item): Emotion | null => {
      if (typeof item === "string" && item.trim().length > 0) {
        // Migrate old string format to object format with neutral category
        return { name: item.trim(), category: "neutral" };
      } else if (
        typeof item === "object" &&
        item !== null &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        (item.category === "positive" || item.category === "negative" || item.category === "neutral")
      ) {
        return { name: item.name.trim(), category: item.category };
      }
      return null;
    }).filter((item): item is Emotion => item !== null);
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
    emotions: deserializeEmotions(row.emotions),
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

function sanitizeImportedEmotions(value: unknown): Emotion[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): Emotion | null => {
      if (typeof item === "string" && item.trim().length > 0) {
        // Support old string format - default to neutral
        return { name: item.trim(), category: "neutral" };
      } else if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as any).name === "string" &&
        (item as any).name.trim().length > 0 &&
        ((item as any).category === "positive" ||
         (item as any).category === "negative" ||
         (item as any).category === "neutral")
      ) {
        // New object format
        return { name: (item as any).name.trim(), category: (item as any).category };
      }
      return null;
    })
    .filter((item): item is Emotion => item !== null)
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
    serializeEmotions(normalized.emotions),
    serializeArray(normalized.contextTags),
    normalized.energy
  );
  
  // Also store emotions in junction table
  if (normalized.emotions && normalized.emotions.length > 0) {
    await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
  }
  
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
    serializeEmotions(normalized.emotions),
    serializeArray(normalized.contextTags),
    normalized.energy
  );
  
  // Also store emotions in junction table
  if (normalized.emotions && normalized.emotions.length > 0) {
    await linkEmotionsToMood(db, result.lastInsertRowId, normalized.emotions);
  }
  
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
  let updateEmotions = false;
  let emotionsToUpdate: Emotion[] = [];

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
    params.push(serializeEmotions(updates.emotions));
    updateEmotions = true;
    emotionsToUpdate = updates.emotions;
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

  // Wrap updates in a transaction to ensure consistency
  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await db.runAsync(
      `UPDATE moods SET ${fields.join(", ")} WHERE id = ?;`,
      ...params,
      id
    );
    
    // Update junction table if emotions were updated
    if (updateEmotions) {
      await linkEmotionsToMood(db, id, emotionsToUpdate);
    }
    
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
  
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
    emotionsArray: Emotion[];
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
      let emotions: Emotion[] = [];
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
        emotions: serializeEmotions(emotions),
        emotionsArray: emotions,
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
          const result = await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            entry.mood,
            entry.note,
            entry.timestamp,
            entry.emotions,
            entry.contextTags,
            entry.energy
          );
          
          // Also store emotions in junction table
          if (entry.emotionsArray && entry.emotionsArray.length > 0) {
            await linkEmotionsToMood(db, result.lastInsertRowId, entry.emotionsArray);
          }
          
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
 * Gets all emotions from the emotions table
 */
export async function getAllEmotions(): Promise<Emotion[]> {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT name, category FROM emotions ORDER BY name ASC;");
  return rows.map((row: any) => ({
    name: row.name,
    category: row.category as "positive" | "negative" | "neutral"
  }));
}

/**
 * Adds a new emotion to the emotions table
 */
export async function addEmotion(emotion: Emotion): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO emotions (name, category) VALUES (?, ?);",
    emotion.name,
    emotion.category
  );
}

/**
 * Updates an existing emotion in the emotions table
 */
export async function updateEmotion(oldName: string, newEmotion: Emotion): Promise<void> {
  const db = await getDb();
  
  // If name changed, need to handle it carefully
  if (oldName !== newEmotion.name) {
    // Check if new name already exists
    const existing = await db.getFirstAsync(
      "SELECT id FROM emotions WHERE name = ?;",
      newEmotion.name
    );
    if (existing) {
      throw new Error("An emotion with this name already exists");
    }
  }
  
  await db.runAsync(
    "UPDATE emotions SET name = ?, category = ? WHERE name = ?;",
    newEmotion.name,
    newEmotion.category,
    oldName
  );
}

/**
 * Deletes an emotion from the emotions table
 */
export async function deleteEmotion(name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM emotions WHERE name = ?;", name);
}

/**
 * Gets emotion ID by name, creating it if it doesn't exist.
 * If the emotion exists with a different category, the category is updated.
 */
async function getOrCreateEmotionId(db: SQLite.SQLiteDatabase, emotion: Emotion): Promise<number> {
  // Use INSERT OR REPLACE to create or update the emotion
  const result = await db.runAsync(
    "INSERT OR REPLACE INTO emotions (name, category) VALUES (?, ?);",
    emotion.name,
    emotion.category
  );
  
  // Get the ID (either newly inserted or existing)
  const row = await db.getFirstAsync(
    "SELECT id FROM emotions WHERE name = ?;",
    emotion.name
  );
  
  return (row as any).id;
}

/**
 * Links emotions to a mood entry in the junction table
 */
async function linkEmotionsToMood(db: SQLite.SQLiteDatabase, moodId: number, emotions: Emotion[]): Promise<void> {
  // Wrap all operations in a single transaction to avoid per-emotion transaction overhead
  await db.execAsync("BEGIN TRANSACTION;");
  try {
    // First, remove existing links
    await db.runAsync("DELETE FROM mood_emotions WHERE mood_id = ?;", moodId);
    
    // Then add new links
    for (const emotion of emotions) {
      const emotionId = await getOrCreateEmotionId(db, emotion);
      await db.runAsync(
        "INSERT OR IGNORE INTO mood_emotions (mood_id, emotion_id) VALUES (?, ?);",
        moodId,
        emotionId
      );
    }

    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
}

/**
 * Gets emotions for a mood entry from the junction table.
 * Note: Currently unused as emotions are still being read from the TEXT column for backward compatibility.
 * This function is reserved for future use when fully migrating to junction table reads.
 */
async function getEmotionsForMood(db: SQLite.SQLiteDatabase, moodId: number): Promise<Emotion[]> {
  const rows = await db.getAllAsync(`
    SELECT e.name, e.category
    FROM emotions e
    INNER JOIN mood_emotions me ON e.id = me.emotion_id
    WHERE me.mood_id = ?
    ORDER BY e.name ASC;
  `, moodId);
  
  return rows.map((row: any) => ({
    name: row.name,
    category: row.category as "positive" | "negative" | "neutral"
  }));
}

/**
 * Parses an emotion item (string or object) and assigns it a category.
 * Attempts to match against DEFAULT_EMOTIONS for category, defaulting to "neutral".
 */
function parseEmotionItem(item: any): Emotion | null {
  if (typeof item === "string" && item.trim().length > 0) {
    // Old string format - assign category based on default emotions
    const name = item.trim();
    const defaultEmotion = DEFAULT_EMOTIONS.find(e => e.name === name);
    return { 
      name, 
      category: defaultEmotion ? defaultEmotion.category : "neutral" 
    };
  } else if (typeof item === "object" && item !== null && item.name) {
    // Object format
    return {
      name: item.name.trim(),
      category: item.category || "neutral"
    };
  }
  return null;
}

/**
 * Migrates emotions from the old format (stored in moods.emotions column) 
 * to the new format (emotions table + junction table)
 */
export async function migrateEmotionsToTable(): Promise<{
  migrated: number;
  emotionsCreated: number;
}> {
  const db = await getDb();
  let migrated = 0;
  let emotionsCreated = 0;
  const emotionIds = new Map<string, number>();

  try {
    // Get all mood entries from database
    const rows = await db.getAllAsync("SELECT id, emotions FROM moods;");

    for (const row: any of rows) {
      const rawEmotions = row.emotions;

      // Skip if no emotions
      if (!rawEmotions || rawEmotions === "[]") {
        continue;
      }

      try {
        const parsed = JSON.parse(rawEmotions);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          continue;
        }

        // Extract emotions from the old format using shared helper
        const emotions: Emotion[] = parsed
          .map(parseEmotionItem)
          .filter((e): e is Emotion => e !== null);

        // Add emotions to emotions table and link to mood
        for (const emotion of emotions) {
          let emotionId: number;
          
          // Check cache first
          if (emotionIds.has(emotion.name)) {
            emotionId = emotionIds.get(emotion.name)!;
          } else {
            // Get or create emotion
            emotionId = await getOrCreateEmotionId(db, emotion);
            emotionIds.set(emotion.name, emotionId);
          }
          
          // Link emotion to mood
          await db.runAsync(
            "INSERT OR IGNORE INTO mood_emotions (mood_id, emotion_id) VALUES (?, ?);",
            row.id,
            emotionId
          );
        }

        migrated++;
      } catch (error) {
        console.error(`Failed to migrate emotions for mood ${row.id}:`, error);
      }
    }

    console.log(`Emotion migration complete: ${migrated} moods migrated, ${emotionIds.size} unique emotions in table`);
    return { migrated, emotionsCreated: emotionIds.size };
  } catch (error) {
    console.error("Error during emotion table migration:", error);
    throw error;
  }
}

/**
 * Checks if emotions have been migrated to the new table format
 */
export async function hasEmotionTableMigrated(): Promise<boolean> {
  const db = await getDb();
  
  // Check if emotions table has any data
  const emotionCount = await db.getFirstAsync("SELECT COUNT(*) as count FROM emotions;");
  const hasEmotions = (emotionCount as any)?.count > 0;
  
  // Check if junction table has any data
  const linkCount = await db.getFirstAsync("SELECT COUNT(*) as count FROM mood_emotions;");
  const hasLinks = (linkCount as any)?.count > 0;
  
  return hasEmotions || hasLinks;
}

/**
 * Ensures default emotions are in the emotions table
 */
export async function ensureDefaultEmotions(): Promise<void> {
  const db = await getDb();
  
  if (!DEFAULT_EMOTIONS.length) {
    return;
  }

  const placeholders = DEFAULT_EMOTIONS.map(() => "(?, ?)").join(", ");
  const values: (string)[] = [];

  for (const emotion of DEFAULT_EMOTIONS) {
    values.push(emotion.name, emotion.category);
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO emotions (name, category) VALUES ${placeholders};`,
    ...values
  );
}

/**
 * Clears all mood entries from the database (DEV only)
 */
export async function clearMoods() {
  if (!__DEV__) return;
  const db = await getDb();
  await db.runAsync("DELETE FROM mood_emotions;");
  await db.runAsync("DELETE FROM moods;");
  await db.runAsync("DELETE FROM emotions;");
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
      const emotions = sanitizeImportedEmotions((mood as any)?.emotions);
      const contextSource =
        (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy((mood as any)?.energy);
      const result = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy
      );
      
      // Also store emotions in junction table
      if (emotions && emotions.length > 0) {
        await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
      }
    }
    return moods.length;
  } catch (error) {
    console.error("Error importing moods:", error);
    throw new Error("Invalid mood data format");
  }
}

/**
 * Imports mood entries from the old backup format (pre-emotions-table).
 * This is a user-facing migration feature to import backups created before the emotions table was introduced.
 * @param jsonData - JSON string containing mood entries in the old backup format
 * @returns Promise resolving to the number of imported entries
 */
export async function importOldBackup(jsonData: string): Promise<number> {
  try {
    const moods = JSON.parse(jsonData) as any[];
    const db = await getDb();

    for (const mood of moods) {
      const note = mood?.notes ?? mood?.note ?? null;
      const timestamp = parseTimestamp(mood?.timestamp);
      
      // Handle old emotion format using shared helper
      let emotions: Emotion[] = [];
      if (mood?.emotions && Array.isArray(mood.emotions)) {
        emotions = mood.emotions
          .map(parseEmotionItem)
          .filter((e): e is Emotion => e !== null);
      }
      
      const contextSource = mood?.contextTags ?? mood?.context ?? [];
      const contextTags = sanitizeImportedArray(contextSource);
      const energy = sanitizeEnergy(mood?.energy);
      
      const result = await db.runAsync(
        "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
        mood.mood,
        note,
        timestamp,
        serializeEmotions(emotions),
        serializeArray(contextTags),
        energy
      );
      
      // Also store emotions in junction table
      if (emotions && emotions.length > 0) {
        await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
      }
    }
    return moods.length;
  } catch (error) {
    console.error("Error importing old backup:", error);
    throw new Error("Invalid backup data format");
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
          const emotions = sanitizeImportedEmotions((mood as any)?.emotions);
          const contextSource =
            (mood as any)?.contextTags ?? (mood as any)?.context ?? [];
          const contextTags = sanitizeImportedArray(contextSource);
          const energy = sanitizeEnergy((mood as any)?.energy);
          const timestamp = parseTimestamp((mood as any)?.timestamp);
          const result = await db.runAsync(
            "INSERT INTO moods (mood, note, timestamp, emotions, context_tags, energy) VALUES (?, ?, ?, ?, ?, ?);",
            mood.mood,
            note,
            timestamp,
            serializeEmotions(emotions),
            serializeArray(contextTags),
            energy
          );
          
          // Also store emotions in junction table
          if (emotions && emotions.length > 0) {
            await linkEmotionsToMood(db, result.lastInsertRowId, emotions);
          }
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
 * Migrates emotions from old string format to new object format with categories
 * This runs once and updates all existing mood entries in the database
 */
export async function migrateEmotionsToCategories(): Promise<{
  migrated: number;
  skipped: number;
}> {
  const db = await getDb();
  let migrated = 0;
  let skipped = 0;

  try {
    // Get all mood entries from database
    const rows = await db.getAllAsync("SELECT id, emotions FROM moods;");

    for (const row: any of rows) {
      const rawEmotions = row.emotions;

      // Skip if no emotions
      if (!rawEmotions || rawEmotions === "[]") {
        skipped++;
        continue;
      }

      try {
        const parsed = JSON.parse(rawEmotions);

        // Check if migration is needed (if any item is a string or missing category)
        const needsMigration = parsed.some((item: any) => {
          return typeof item === "string" ||
                 (typeof item === "object" && !item.category);
        });

        if (!needsMigration) {
          skipped++;
          continue;
        }

        // Migrate emotions to new format
        const migratedEmotions: Emotion[] = parsed.map((item: any): Emotion => {
          if (typeof item === "string") {
            // Assign category based on emotion name
            const name = item;
            let category: "positive" | "negative" | "neutral" = "neutral";

            // Check against default emotions for category
            const defaultEmotion = DEFAULT_EMOTIONS.find(e => e.name === name);
            if (defaultEmotion) {
              category = defaultEmotion.category;
            }

            return { name, category };
          } else if (typeof item === "object" && item.name) {
            // Already an object but might be missing category
            const category = item.category || "neutral";
            return { name: item.name, category };
          }
          // Fallback
          return { name: String(item), category: "neutral" };
        });

        // Update the database entry
        await db.runAsync(
          "UPDATE moods SET emotions = ? WHERE id = ?;",
          serializeEmotions(migratedEmotions),
          row.id
        );

        migrated++;
      } catch (error) {
        console.error(`Failed to migrate emotions for mood ${row.id}:`, error);
        skipped++;
      }
    }

    console.log(`Emotion migration complete: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped };
  } catch (error) {
    console.error("Error during emotion migration:", error);
    throw error;
  }
}
