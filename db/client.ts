import type * as SQLite from "expo-sqlite";
import { createNativeEncryptionStorage } from "./encryption/native";
import { openEncryptedDatabase } from "./encryption/startup";
import { createMoodTable } from "./moods/schema";
import {
  hasEmotionTableMigrated,
  migrateEmotionsToTable,
} from "./moods/emotions";
import { backfillMoodScaleJson } from "./moods/migrations";

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await createMoodTable(database);
  await backfillMoodScaleJson(database);

  const migrated = await hasEmotionTableMigrated(database);
  if (migrated) {
    return;
  }

  await migrateEmotionsToTable(database);
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const openedDb = await openEncryptedDatabase(createNativeEncryptionStorage(initializeDatabase));
      db = openedDb;
      return openedDb;
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}
