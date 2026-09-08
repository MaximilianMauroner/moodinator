/** SQLite-backed test adapter for the async Expo database API. */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { afterAll, beforeAll, vi } from "vitest";
import type { Emotion, MoodEntry } from "../../db/types";

export type MockRow = {
  id: number;
  mood: number;
  note: string | null;
  timestamp: number;
  emotions: string;
  context_tags: string;
  energy: number | null;
  mood_scale_json: string | null;
  utc_offset_minutes: number | null;
  based_on_entry_id: number | null;
};

export type MockEmotionRow = {
  id: number;
  name: string;
  category: "positive" | "negative" | "neutral";
};

export type MockMoodEmotionRow = {
  mood_id: number;
  emotion_id: number;
};

/**
 * Uses production schema SQL and real constraints, ordering, and transactions.
 * Only the Expo async transport is replaced; spies support injected I/O failures.
 * Native connection initialization and SQLCipher encryption are not covered.
 */
export function createMockDb() {
  const sqlite = new DatabaseSync(":memory:");
  // Match SQLite's native default; production does not enable foreign keys.
  // Constraint-specific tests opt in explicitly.
  sqlite.exec("PRAGMA foreign_keys = OFF;");
  const mockDb = {
    execAsync: vi.fn(async (sql: string) => { sqlite.exec(sql); }),
    runAsync: vi.fn(async (sql: string, ...params: SQLInputValue[]) => {
      const result = sqlite.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    }),
    getFirstAsync: vi.fn(async (sql: string, ...params: SQLInputValue[]) =>
      sqlite.prepare(sql).get(...params) ?? null),
    getAllAsync: vi.fn(async (sql: string, ...params: SQLInputValue[]) =>
      sqlite.prepare(sql).all(...params)),
    __getMoods: () => sqlite.prepare("SELECT * FROM moods ORDER BY id").all() as MockRow[],
    __getEmotions: () => sqlite.prepare("SELECT * FROM emotions ORDER BY id").all() as MockEmotionRow[],
    __getMoodEmotions: () => sqlite.prepare("SELECT * FROM mood_emotions ORDER BY mood_id, emotion_id").all() as MockMoodEmotionRow[],
    __reset: () => {
      sqlite.exec("DELETE FROM mood_emotions; DELETE FROM moods; DELETE FROM emotions; DELETE FROM sqlite_sequence;");
    },
    __addMood: (mood: Partial<MockRow>) => {
      const row = {
        mood: mood.mood ?? 5,
        note: mood.note ?? null,
        timestamp: mood.timestamp ?? Date.now(),
        emotions: mood.emotions ?? "[]",
        context_tags: mood.context_tags ?? "[]",
        energy: mood.energy ?? null,
        mood_scale_json: mood.mood_scale_json ?? null,
        utc_offset_minutes: mood.utc_offset_minutes ?? null,
        based_on_entry_id: mood.based_on_entry_id ?? null,
      };
      const result = sqlite.prepare(`INSERT INTO moods (${Object.keys(row).join(", ")}) VALUES (${Object.keys(row).map(() => "?").join(", ")})`).run(...Object.values(row));
      return { id: Number(result.lastInsertRowid), ...row };
    },
    __addEmotion: (emotion: Partial<MockEmotionRow>) => {
      const row = { name: emotion.name ?? "test", category: emotion.category ?? "neutral" };
      const result = sqlite.prepare("INSERT INTO emotions (name, category) VALUES (?, ?)").run(row.name, row.category);
      return { id: Number(result.lastInsertRowid), ...row };
    },
    __addMoodEmotion: (moodId: number, emotionId: number) => {
      sqlite.prepare("INSERT INTO mood_emotions (mood_id, emotion_id) VALUES (?, ?)").run(moodId, emotionId);
    },
  };
  // The adapter implements the Expo methods used by production queries. Native
  // handles, sessions, and prepared-statement lifecycle are outside these tests.
  const database = mockDb as unknown as SQLiteDatabase;
  beforeAll(async () => {
    const { createMoodTable } = await import("../../db/moods/schema");
    await createMoodTable(database);
  });
  afterAll(() => sqlite.close());
  return Object.assign(mockDb, { database });
}

/**
 * Helper to create a mock MoodEntry for testing.
 */
export function createMockMoodEntry(overrides?: Partial<MoodEntry>): MoodEntry {
  return {
    id: 1,
    mood: 5,
    note: null,
    timestamp: Date.now(),
    emotions: [],
    contextTags: [],
    energy: null,
    moodScale: { version: 1, min: 0, max: 10, lowerIsBetter: true },
    basedOnEntryId: null,
    ...overrides,
  };
}

/**
 * Helper to create a mock Emotion for testing.
 */
export function createMockEmotion(overrides?: Partial<Emotion>): Emotion {
  return {
    name: "Happy",
    category: "positive",
    ...overrides,
  };
}
