import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DATABASE_NAME = "moodinator.db";
const DB_ENCRYPTION_KEY_KEY = "dbEncryptionKeyV1";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_ENCRYPTION_KEY_KEY);
  if (existing) return existing;

  // SQLCipher key stored in SecureStore; DB is encrypted at rest on iOS when SQLCipher is enabled.
  const newKey = toHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(DB_ENCRYPTION_KEY_KEY, newKey);
  return newKey;
}

async function canReadMainSchema(database: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master;"
    );
    return true;
  } catch {
    return false;
  }
}

async function applySqlCipherKey(database: SQLite.SQLiteDatabase, key: string): Promise<void> {
  await database.execAsync(`PRAGMA key = '${key}';`);
}

function isSqlCipherUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("PRAGMA key or rekey");
}

async function configureDatabaseEncryption(database: SQLite.SQLiteDatabase): Promise<void> {
  // SQLCipher is enabled in app.json only for iOS builds.
  if (Platform.OS !== "ios") return;

  const key = await getOrCreateDbKey();
  try {
    const readableWithoutKey = await canReadMainSchema(database);

    if (readableWithoutKey) {
      // Existing plaintext DB (or brand-new DB). Encrypt it in place.
      await database.execAsync(`PRAGMA rekey = '${key}';`);
    }

    await applySqlCipherKey(database, key);

    const readableWithKey = await canReadMainSchema(database);
    if (!readableWithKey) {
      throw new Error(
        "Failed to open encrypted database. The SQLCipher key may be missing or invalid."
      );
    }
  } catch (error) {
    if (isSqlCipherUnavailableError(error)) {
      console.warn(
        "SQLCipher is unavailable in the current iOS build; continuing with the local SQLite database."
      );
      return;
    }

    throw error;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const openedDb = await SQLite.openDatabaseAsync(DATABASE_NAME, {
        useNewConnection: true,
        finalizeUnusedStatementsBeforeClosing: true,
      });

      await configureDatabaseEncryption(openedDb);
      db = openedDb;
      return openedDb;
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}
