import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import type { EncryptionStorage } from "./startup";

export const RAW_KEY_STORAGE_NAME = "dbEncryptionKeyV2";
export const LEGACY_KEY_STORAGE_NAME = "dbEncryptionKeyV1";

export function createNativeEncryptionStorage(
  initialize: (db: SQLite.SQLiteDatabase) => Promise<void>,
  options: { directory?: string; keyNamespace?: string } = {}
): EncryptionStorage<SQLite.SQLiteDatabase> {
  const configuredDirectory = options.directory ?? SQLite.defaultDatabaseDirectory;
  if (!configuredDirectory) throw new Error("Native database storage is unavailable.");
  // Expo SQLite needs a native path; Expo FileSystem needs a file URI. QA may
  // pass a FileSystem directory URI, so normalize once without changing globals.
  const directory = configuredDirectory.startsWith("file://")
    ? decodeURIComponent(configuredDirectory.slice(7)) : configuredDirectory;
  if (!directory.startsWith("/")) throw new Error("Database storage must use an absolute native directory.");
  if (options.keyNamespace !== undefined && !/^[A-Za-z0-9._-]+$/.test(options.keyNamespace)) {
    throw new Error("The isolated database key namespace is invalid.");
  }
  const keyName = (name: string) => options.keyNamespace ? `${options.keyNamespace}.${name}` : name;
  const path = (name: string) => `${directory.replace(/\/$/, "")}/${name}`;
  const file = (name: string) => new File(`file://${path(name).split("/").map(encodeURIComponent).join("/")}`);
  return {
    path,
    exists: async (name) => file(name).exists,
    open: (name) => SQLite.openDatabaseAsync(name, {
      useNewConnection: true,
      finalizeUnusedStatementsBeforeClosing: true,
    }, directory),
    copy: async (source, target) => { file(source).copy(file(target)); },
    remove: async (name) => { file(name).delete(); },
    readHeader: async (name) => {
      const handle = file(name).open();
      try { return handle.readBytes(16); } finally { handle.close(); }
    },
    loadKey: () => SecureStore.getItemAsync(keyName(RAW_KEY_STORAGE_NAME)),
    saveKey: (key) => SecureStore.setItemAsync(keyName(RAW_KEY_STORAGE_NAME), key, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
    createKey: () => Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    loadLegacyKey: () => SecureStore.getItemAsync(keyName(LEGACY_KEY_STORAGE_NAME)),
    initialize,
  };
}
