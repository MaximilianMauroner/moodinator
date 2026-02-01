import type * as SQLite from "expo-sqlite";
import { getDb } from "../client";
import type { ColumnInfo } from "../types/rows";
import { createEmotionsTable, createMoodEmotionsTable } from "./emotions";

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
  await createIndexes(db);
  await createEmotionsTable();
  await createMoodEmotionsTable();
}

/**
 * Create database indexes for performance
 */
async function createIndexes(database: SQLite.SQLiteDatabase) {
  // Index on timestamp for date range queries (most common)
  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_moods_timestamp ON moods(timestamp DESC);"
  );
  // Index on mood_emotions junction table for emotion lookups
  await database.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_mood_emotions_mood_id ON mood_emotions(mood_id);"
  );
}

async function ensureMoodTableColumns(database: SQLite.SQLiteDatabase) {
  const columns = await database.getAllAsync<ColumnInfo>("PRAGMA table_info(moods);");
  const existing = new Set(columns.map((col) => col.name));

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
    {
      name: "photos_json",
      sql: "ALTER TABLE moods ADD COLUMN photos_json TEXT DEFAULT '[]';",
    },
    {
      name: "location_json",
      sql: "ALTER TABLE moods ADD COLUMN location_json TEXT;",
    },
    {
      name: "voice_memos_json",
      sql: "ALTER TABLE moods ADD COLUMN voice_memos_json TEXT DEFAULT '[]';",
    },
    {
      name: "based_on_entry_id",
      sql: "ALTER TABLE moods ADD COLUMN based_on_entry_id INTEGER;",
    },
  ];

  for (const migration of migrations) {
    if (!existing.has(migration.name)) {
      await database.execAsync(migration.sql);
    }
  }
}
