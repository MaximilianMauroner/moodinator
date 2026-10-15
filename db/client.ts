import type * as SQLite from "expo-sqlite";
import { createNativeEncryptionStorage } from "./encryption/native";
import { openEncryptedDatabase } from "./encryption/startup";
import { createMoodTable } from "./moods/schema";
import {
  hasEmotionTableMigrated,
  migrateEmotionsToTable,
} from "./moods/emotions";
import { backfillMoodScaleJson } from "./moods/migrations";

/**
 * Removes the write methods from ordinary reads. It is not SQLite
 * authorization: getAllAsync still runs whatever statement it is given.
 */
export type QueryConnection = Pick<SQLite.SQLiteDatabase, "getAllAsync" | "getFirstAsync">;

declare const unpublished: unique symbol;
type Unpublished = { readonly [unpublished]: true };

/**
 * The connection while startup initializes it, before any caller can see it.
 * Only initializeDatabase creates one.
 */
export type InitDb = QueryConnection
  & Pick<SQLite.SQLiteDatabase, "runAsync" | "execAsync" | "withTransactionAsync">
  & Unpublished;

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const init: InitDb = database as typeof database & Unpublished;
  await createMoodTable(init);
  await backfillMoodScaleJson(init);

  const migrated = await hasEmotionTableMigrated(init);
  if (migrated) {
    return;
  }

  await migrateEmotionsToTable(init);
}

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
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

export async function readDb(): Promise<QueryConnection> {
  return openDatabase();
}
