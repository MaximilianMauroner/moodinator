/**
 * Mock SQLite client for testing database operations.
 * Provides an in-memory mock implementation of expo-sqlite database.
 */

import type { Emotion, MoodEntry } from "../../db/types";

export type MockRow = {
  id: number;
  mood: number;
  note: string | null;
  timestamp: number;
  emotions: string;
  context_tags: string;
  energy: number | null;
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
 * Creates a mock SQLite database for testing.
 */
export function createMockDb() {
  let moodRows: MockRow[] = [];
  let emotionRows: MockEmotionRow[] = [];
  let moodEmotionRows: MockMoodEmotionRow[] = [];
  let nextMoodId = 1;
  let nextEmotionId = 1;

  const mockDb = {
    // Transaction methods
    execAsync: jest.fn().mockResolvedValue(undefined),

    // Insert/Update/Delete
    runAsync: jest.fn(async (sql: string, ...params: any[]) => {
      // Handle INSERT INTO moods
      if (sql.includes("INSERT INTO moods")) {
        const id = nextMoodId++;
        const newRow: MockRow = {
          id,
          mood: params[0],
          note: params[1],
          timestamp: params[2],
          emotions: params[3],
          context_tags: params[4],
          energy: params[5],
        };
        moodRows.push(newRow);
        return { lastInsertRowId: id, changes: 1 };
      }

      // Handle UPDATE moods
      if (sql.includes("UPDATE moods SET")) {
        const idIndex = params.length - 1;
        const id = params[idIndex];
        const rowIndex = moodRows.findIndex((r) => r.id === id);
        if (rowIndex >= 0) {
          // Parse which fields are being updated
          if (sql.includes("note =")) {
            moodRows[rowIndex].note = params[0];
          }
          if (sql.includes("timestamp =") && !sql.includes("note =")) {
            moodRows[rowIndex].timestamp = params[0];
          }
          return { changes: 1 };
        }
        return { changes: 0 };
      }

      // Handle DELETE FROM moods
      if (sql.includes("DELETE FROM moods")) {
        const id = params[0];
        const initialLength = moodRows.length;
        moodRows = moodRows.filter((r) => r.id !== id);
        return { changes: initialLength - moodRows.length };
      }

      // Handle INSERT INTO emotions
      if (sql.includes("INSERT") && sql.includes("emotions")) {
        if (sql.includes("INSERT OR REPLACE") || sql.includes("INSERT OR IGNORE")) {
          const name = params[0];
          const category = params[1];
          const existing = emotionRows.find(
            (e) => e.name.toLowerCase() === name.toLowerCase()
          );
          if (existing) {
            if (sql.includes("INSERT OR REPLACE")) {
              existing.category = category;
            }
            return { lastInsertRowId: existing.id, changes: 0 };
          }
          const id = nextEmotionId++;
          emotionRows.push({ id, name, category });
          return { lastInsertRowId: id, changes: 1 };
        }
      }

      // Handle DELETE FROM emotions
      if (sql.includes("DELETE FROM emotions")) {
        const name = params[0];
        const initialLength = emotionRows.length;
        emotionRows = emotionRows.filter(
          (e) => e.name.toLowerCase() !== name.toLowerCase()
        );
        return { changes: initialLength - emotionRows.length };
      }

      // Handle INSERT INTO mood_emotions
      if (sql.includes("INSERT") && sql.includes("mood_emotions")) {
        const moodId = params[0];
        const emotionId = params[1];
        moodEmotionRows.push({ mood_id: moodId, emotion_id: emotionId });
        return { changes: 1 };
      }

      // Handle DELETE FROM mood_emotions
      if (sql.includes("DELETE FROM mood_emotions")) {
        const moodId = params[0];
        moodEmotionRows = moodEmotionRows.filter((me) => me.mood_id !== moodId);
        return { changes: 1 };
      }

      return { lastInsertRowId: 0, changes: 0 };
    }),

    // Query single row
    getFirstAsync: jest.fn(async (sql: string, ...params: any[]) => {
      // Handle SELECT * FROM moods WHERE id = ?
      if (sql.includes("SELECT * FROM moods WHERE id")) {
        const id = params[0];
        return moodRows.find((r) => r.id === id) ?? null;
      }

      // Handle SELECT COUNT(*) FROM moods
      if (sql.includes("SELECT COUNT") && sql.includes("moods")) {
        if (sql.includes("WHERE timestamp")) {
          // Filter by timestamp range
          const start = params[0];
          const end = params[1];
          const count = moodRows.filter(
            (r) => r.timestamp >= start && r.timestamp <= end
          ).length;
          return { count };
        }
        return { count: moodRows.length };
      }

      // Handle SELECT id FROM emotions WHERE name = ?
      if (sql.includes("SELECT id FROM emotions WHERE name")) {
        const name = params[0];
        const emotion = emotionRows.find(
          (e) => e.name.toLowerCase() === name.toLowerCase()
        );
        return emotion ? { id: emotion.id } : null;
      }

      // Handle SELECT COUNT(*) FROM emotions
      if (sql.includes("SELECT COUNT") && sql.includes("emotions")) {
        return { count: emotionRows.length };
      }

      // Handle SELECT COUNT(*) FROM mood_emotions
      if (sql.includes("SELECT COUNT") && sql.includes("mood_emotions")) {
        return { count: moodEmotionRows.length };
      }

      return null;
    }),

    // Query multiple rows
    getAllAsync: jest.fn(async (sql: string, ...params: any[]) => {
      // Handle SELECT * FROM moods ORDER BY timestamp DESC
      if (sql.includes("SELECT * FROM moods") && sql.includes("ORDER BY")) {
        let result = [...moodRows];

        // Handle WHERE clauses for timestamp filtering
        if (sql.includes("WHERE") && params.length > 0) {
          if (sql.includes("timestamp >=") && sql.includes("timestamp <=")) {
            const start = params[0];
            const end = params[1];
            result = result.filter((r) => r.timestamp >= start && r.timestamp <= end);
          } else if (sql.includes("timestamp >=")) {
            result = result.filter((r) => r.timestamp >= params[0]);
          } else if (sql.includes("timestamp <=")) {
            result = result.filter((r) => r.timestamp <= params[0]);
          }
        }

        return result.sort((a, b) => b.timestamp - a.timestamp);
      }

      // Handle SELECT id, emotions FROM moods
      if (sql.includes("SELECT id, emotions FROM moods")) {
        return moodRows.map((r) => ({ id: r.id, emotions: r.emotions }));
      }

      // Handle SELECT emotions FROM moods
      if (sql.includes("SELECT emotions FROM moods")) {
        return moodRows.map((r) => ({ emotions: r.emotions }));
      }

      // Handle SELECT name, category FROM emotions
      if (sql.includes("SELECT name, category FROM emotions")) {
        return emotionRows.map((e) => ({ name: e.name, category: e.category }));
      }

      return [];
    }),

    // Utility methods for testing
    __getMoods: () => [...moodRows],
    __getEmotions: () => [...emotionRows],
    __getMoodEmotions: () => [...moodEmotionRows],
    __reset: () => {
      moodRows = [];
      emotionRows = [];
      moodEmotionRows = [];
      nextMoodId = 1;
      nextEmotionId = 1;
    },
    __addMood: (mood: Partial<MockRow>) => {
      const id = nextMoodId++;
      const newRow: MockRow = {
        id,
        mood: mood.mood ?? 5,
        note: mood.note ?? null,
        timestamp: mood.timestamp ?? Date.now(),
        emotions: mood.emotions ?? "[]",
        context_tags: mood.context_tags ?? "[]",
        energy: mood.energy ?? null,
      };
      moodRows.push(newRow);
      return newRow;
    },
    __addEmotion: (emotion: Partial<MockEmotionRow>) => {
      const id = nextEmotionId++;
      const newRow: MockEmotionRow = {
        id,
        name: emotion.name ?? "test",
        category: emotion.category ?? "neutral",
      };
      emotionRows.push(newRow);
      return newRow;
    },
  };

  return mockDb;
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
