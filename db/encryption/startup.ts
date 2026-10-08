import { legacyKeyPragma, rawKeyPragma, requireCipherVersion, validateRawKey } from "./keys";
import { captureSnapshot, requireMatchingSnapshot, type DatabaseSnapshot,
  type EncryptionDatabase } from "./snapshot";

export const DATABASE_FILES = {
  original: "moodinator.db",
  active: "moodinator.encrypted-v2.db",
  copy: "moodinator.migration-copy.db",
  coordinator: "moodinator.startup-v2.db",
} as const;

export const STARTUP_PHASES = [
  "intent-committed", "key-persisted", "copy-closed", "export-started",
  "export-closed", "target-verified", "initialized", "active-reopened",
  "completion-committed", "cleanup-complete",
] as const;
export type StartupPhase = typeof STARTUP_PHASES[number];
type Source = "fresh" | "plaintext" | "legacy-passphrase";
type State = { version: number; status: "pending" | "completed"; source: Source };

export interface EncryptionStorage<Db extends EncryptionDatabase> {
  exists(name: string): Promise<boolean>;
  open(name: string): Promise<Db>;
  path(name: string): string;
  copy(source: string, target: string): Promise<void>;
  remove(name: string): Promise<void>;
  readHeader(name: string): Promise<Uint8Array>;
  loadKey(): Promise<string | null>;
  saveKey(key: string): Promise<void>;
  createKey(): string;
  loadLegacyKey(): Promise<string | null>;
  initialize(db: Db): Promise<void>;
}

type Context<Db extends EncryptionDatabase> = {
  storage: EncryptionStorage<Db>;
  coordinator: Db;
  open(name: string, key?: string, legacy?: boolean): Promise<Db>;
  close(db: Db): Promise<void>;
  phase(name: StartupPhase): Promise<void>;
};

const SIDECARS = ["-journal", "-wal", "-shm"];
const plaintextHeader = "SQLite format 3\0";
const isPlaintextHeader = (header: Uint8Array) =>
  header.length >= 16 && Array.from(header.subarray(0, 16), (byte) => String.fromCharCode(byte)).join("") === plaintextHeader;

async function hasArtifacts<Db extends EncryptionDatabase>(storage: EncryptionStorage<Db>, name: string) {
  for (const suffix of ["", ...SIDECARS]) {
    if (await storage.exists(name + suffix)) return true;
  }
  return false;
}

async function readState(db: EncryptionDatabase): Promise<State | null> {
  const rows = await db.getAllAsync<State>("SELECT version, status, source FROM encryption_state;");
  if (rows.length === 0) return null;
  const state = rows[0];
  if (rows.length !== 1 || state.version !== 2
    || !["pending", "completed"].includes(state.status)
    || !["fresh", "plaintext", "legacy-passphrase"].includes(state.source)) {
    throw new Error("Database encryption recovery state is unknown. Existing files were retained.");
  }
  return state;
}

async function locked<Db extends EncryptionDatabase, Result>(context: Context<Db>, task: () => Promise<Result>) {
  await context.coordinator.execAsync("BEGIN EXCLUSIVE;");
  try {
    const result = await task();
    await context.coordinator.execAsync("COMMIT;");
    return result;
  } catch (error) {
    try { await context.coordinator.execAsync("ROLLBACK;"); } catch { /* Closing also releases the native lock. */ }
    throw error;
  }
}

async function configureCoordinator(db: EncryptionDatabase) {
  await db.execAsync("PRAGMA busy_timeout = 5000;");
  const mode = await db.getFirstAsync<{ journal_mode: string }>("PRAGMA journal_mode = DELETE;");
  await db.execAsync("PRAGMA synchronous = EXTRA;");
  const sync = await db.getFirstAsync<{ synchronous: number }>("PRAGMA synchronous;");
  const version = await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;");
  requireCipherVersion(version?.cipher_version);
  if (mode?.journal_mode !== "delete" || sync?.synchronous !== 3) {
    throw new Error("Native durable database startup coordination is unavailable.");
  }
  await db.execAsync(`CREATE TABLE IF NOT EXISTS encryption_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    version INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed')),
    source TEXT NOT NULL CHECK(source IN ('fresh', 'plaintext', 'legacy-passphrase'))
  );`);
}

async function determineSource<Db extends EncryptionDatabase>(context: Context<Db>): Promise<Source> {
  const { storage } = context;
  if (await hasArtifacts(storage, DATABASE_FILES.active) || await hasArtifacts(storage, DATABASE_FILES.copy)) {
    throw new Error("Database recovery artifacts have no committed intent. Existing files were retained.");
  }
  if (!await storage.exists(DATABASE_FILES.original)) {
    if (await hasArtifacts(storage, DATABASE_FILES.original)) {
      throw new Error("The original database is missing but recovery files remain.");
    }
    return "fresh";
  }
  const header = await storage.readHeader(DATABASE_FILES.original);
  const legacy = header.length !== 0 && !isPlaintextHeader(header);
  const key = legacy ? validateRawKey(await storage.loadLegacyKey()) : undefined;
  const original = await context.open(DATABASE_FILES.original, key, legacy);
  try { await captureSnapshot(original); } finally { await context.close(original); }
  return legacy ? "legacy-passphrase" : "plaintext";
}

async function persistKey<Db extends EncryptionDatabase>(context: Context<Db>) {
  const { storage } = context;
  const existing = await storage.loadKey();
  if (!existing && await hasArtifacts(storage, DATABASE_FILES.active)) {
    throw new Error("The encrypted database key is missing. Existing files were retained.");
  }
  const key = validateRawKey(existing ?? storage.createKey());
  // Repeat persistence even for a cached key: a previous failed SecureStore
  // commit must not be mistaken for a durable native-keystore value.
  await storage.saveKey(key);
  if (await storage.loadKey() !== key) {
    throw new Error("The database key could not be read back from native secure storage.");
  }
  await context.phase("key-persisted");
  return key;
}

async function removeDatabaseFiles<Db extends EncryptionDatabase>(storage: EncryptionStorage<Db>, name: string) {
  for (const suffix of ["", ...SIDECARS]) {
    if (await storage.exists(name + suffix)) await storage.remove(name + suffix);
  }
}

async function openOriginal<Db extends EncryptionDatabase>(context: Context<Db>, source: Source) {
  if (!await context.storage.exists(DATABASE_FILES.original)) {
    throw new Error("The original database is missing during an incomplete conversion.");
  }
  const legacy = source === "legacy-passphrase";
  const key = legacy ? validateRawKey(await context.storage.loadLegacyKey()) : undefined;
  return context.open(DATABASE_FILES.original, key, legacy);
}

async function exportOriginal<Db extends EncryptionDatabase>(context: Context<Db>, source: Source, key: string) {
  const { storage } = context;
  const original = await openOriginal(context, source);
  let expected: DatabaseSnapshot;
  try {
    expected = await captureSnapshot(original);
    const checkpoint = await original.getFirstAsync<{ busy: number }>("PRAGMA wal_checkpoint(TRUNCATE);");
    if (!checkpoint || checkpoint.busy !== 0) throw new Error("The original database could not be checkpointed safely.");
  } finally { await context.close(original); }
  // Only positively pending state reaches this deletion, after the original
  // has been opened and verified. No user handle can have used this target.
  await removeDatabaseFiles(storage, DATABASE_FILES.active);
  await removeDatabaseFiles(storage, DATABASE_FILES.copy);
  await storage.copy(DATABASE_FILES.original, DATABASE_FILES.copy);
  const legacy = source === "legacy-passphrase";
  const legacyKey = legacy ? validateRawKey(await storage.loadLegacyKey()) : undefined;
  const verifiedCopy = await context.open(DATABASE_FILES.copy, legacyKey, legacy);
  try { requireMatchingSnapshot(await captureSnapshot(verifiedCopy), expected); }
  finally { await context.close(verifiedCopy); }
  await context.phase("copy-closed");
  const copy = await context.open(DATABASE_FILES.copy, legacyKey, legacy);
  try {
    await copy.runAsync("ATTACH DATABASE ? AS encrypted KEY ?;", storage.path(DATABASE_FILES.active), `x'${key}'`);
    await context.phase("export-started");
    await copy.execAsync(`PRAGMA encrypted.synchronous = EXTRA;
      SELECT sqlcipher_export('encrypted');
      PRAGMA encrypted.user_version = ${expected.userVersion};
      PRAGMA encrypted.application_id = ${expected.applicationId};
      DETACH DATABASE encrypted;`);
  } finally { await context.close(copy); }
  await context.phase("export-closed");
  return expected;
}

async function requireUnreadable<Db extends EncryptionDatabase>(context: Context<Db>, key?: string) {
  const candidate = await context.open(DATABASE_FILES.active, key);
  try {
    try {
      await candidate.getFirstAsync("SELECT count(*) AS count FROM sqlite_master;");
    } catch (error) {
      if (error instanceof Error && /file is not a database|file is encrypted|SQLITE_NOTADB/i.test(error.message)) return;
      throw error;
    }
    throw new Error("The database remains readable without the correct encryption key.");
  } finally { await context.close(candidate); }
}

async function verifyEncrypted<Db extends EncryptionDatabase>(context: Context<Db>, db: Db, key: string, expected?: DatabaseSnapshot) {
  const snapshot = await captureSnapshot(db);
  if (expected) requireMatchingSnapshot(snapshot, expected);
  if ((await db.getAllAsync("PRAGMA cipher_integrity_check;")).length !== 0) {
    throw new Error("Encrypted database integrity verification failed.");
  }
  if (isPlaintextHeader(await context.storage.readHeader(DATABASE_FILES.active))) {
    throw new Error("The converted database still has a plaintext header.");
  }
  await requireUnreadable(context);
  const wrongKey = (key.startsWith("00") ? "01" : "00") + key.slice(2);
  await requireUnreadable(context, wrongKey);
  return snapshot;
}

async function initializeTarget<Db extends EncryptionDatabase>(context: Context<Db>, state: State) {
  const { storage } = context;
  const key = await persistKey(context);
  let expected: DatabaseSnapshot | undefined;
  if (state.source === "fresh") {
    if (await hasArtifacts(storage, DATABASE_FILES.original) || await hasArtifacts(storage, DATABASE_FILES.copy)) {
      throw new Error("Unexpected source files appeared during fresh database initialization.");
    }
    await removeDatabaseFiles(storage, DATABASE_FILES.active);
  } else {
    expected = await exportOriginal(context, state.source, key);
  }
  const target = await context.open(DATABASE_FILES.active, key);
  await target.execAsync("PRAGMA synchronous = EXTRA;");
  if (expected) {
    await verifyEncrypted(context, target, key, expected);
    await context.phase("target-verified");
  }
  await storage.initialize(target);
  await context.phase("initialized");
  const initialized = await verifyEncrypted(context, target, key);
  if (!expected) await context.phase("target-verified");
  await context.close(target);
  const active = await context.open(DATABASE_FILES.active, key);
  await verifyEncrypted(context, active, key, initialized);
  await context.phase("active-reopened");
  await context.coordinator.runAsync("UPDATE encryption_state SET status = 'completed' WHERE id = 1;");
  return active;
}

async function completedDatabase<Db extends EncryptionDatabase>(context: Context<Db>) {
  if (!await context.storage.exists(DATABASE_FILES.active)) {
    throw new Error("The completed encrypted database is missing. The original will not be used as a stale fallback.");
  }
  const key = validateRawKey(await context.storage.loadKey());
  const active = await context.open(DATABASE_FILES.active, key);
  await verifyEncrypted(context, active, key);
  await context.storage.initialize(active);
  return active;
}

async function finishCleanup<Db extends EncryptionDatabase>(context: Context<Db>, active: Db) {
  await locked(context, async () => {
    const state = await readState(context.coordinator);
    if (state?.status !== "completed") throw new Error("Database completion could not be confirmed before publication.");
    await verifyEncrypted(context, active, validateRawKey(await context.storage.loadKey()));
    if (state.source === "fresh"
      && (await hasArtifacts(context.storage, DATABASE_FILES.original) || await hasArtifacts(context.storage, DATABASE_FILES.copy))) {
      throw new Error("Unexpected recovery files remain beside a completed fresh database.");
    }
    await removeDatabaseFiles(context.storage, DATABASE_FILES.original);
    await removeDatabaseFiles(context.storage, DATABASE_FILES.copy);
  });
  await context.phase("cleanup-complete");
}

export async function openEncryptedDatabase<Db extends EncryptionDatabase>(
  storage: EncryptionStorage<Db>,
  onPhase?: (phase: StartupPhase) => Promise<void>
): Promise<Db> {
  // Opening through Expo creates missing files. Inspect staging paths before
  // creating a coordinator, then inspect them again under the native lock.
  if (!await storage.exists(DATABASE_FILES.coordinator)
    && (await hasArtifacts(storage, DATABASE_FILES.active) || await hasArtifacts(storage, DATABASE_FILES.copy))) {
    throw new Error("Database encryption state is missing. Existing files were retained.");
  }
  const handles = new Set<Db>();
  let retained: Db | undefined;
  const open = async (name: string, key?: string, legacy = false) => {
    const db = await storage.open(name);
    handles.add(db);
    if (key !== undefined) await db.execAsync(legacy ? legacyKeyPragma(key) : rawKeyPragma(key));
    await db.execAsync("PRAGMA busy_timeout = 5000;");
    return db;
  };
  const close = async (db: Db) => { await db.closeAsync(); handles.delete(db); };
  try {
    const coordinator = await open(DATABASE_FILES.coordinator);
    const context: Context<Db> = { storage, coordinator, open, close,
      phase: async (name) => { await onPhase?.(name); } };
    await configureCoordinator(coordinator);
    const newIntent = await locked(context, async () => {
      if (await readState(coordinator)) return false;
      const source = await determineSource(context);
      await coordinator.runAsync("INSERT INTO encryption_state (id, version, status, source) VALUES (1, 2, 'pending', ?);", source);
      return true;
    });
    if (newIntent) await context.phase("intent-committed");
    const active = await locked(context, async () => {
      const state = await readState(coordinator);
      if (!state) throw new Error("Committed database encryption intent was lost.");
      return state.status === "completed" ? completedDatabase(context) : initializeTarget(context, state);
    });
    await context.phase("completion-committed");
    await finishCleanup(context, active);
    retained = active;
    return active;
  } finally {
    const closing = await Promise.allSettled([...handles].filter((db) => db !== retained).map((db) => db.closeAsync()));
    const failures = closing.filter((result) => result.status === "rejected");
    if (failures.length) {
      await retained?.closeAsync();
      throw new Error("Database startup handles could not be closed safely.");
    }
  }
}
