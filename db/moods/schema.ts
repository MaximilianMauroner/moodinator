import type * as SQLite from "expo-sqlite";
import { getDb } from "../client";
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
