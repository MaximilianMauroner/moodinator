import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("moodinator.db", {
      useNewConnection: true,
      finalizeUnusedStatementsBeforeClosing: true,
    });
  }
  return db;
}

