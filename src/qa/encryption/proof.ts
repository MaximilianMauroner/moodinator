import * as Application from "expo-application";
import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { getDb, initializeDatabase } from "@db/client";
import { legacyKeyPragma, rawKeyPragma, validateRawKey } from "@db/encryption/keys";
import { createNativeEncryptionStorage, LEGACY_KEY_STORAGE_NAME, RAW_KEY_STORAGE_NAME } from "@db/encryption/native";
import { captureSnapshot, requireMatchingSnapshot, type DatabaseSnapshot } from "@db/encryption/snapshot";
import { DATABASE_FILES, openEncryptedDatabase, type StartupPhase } from "@db/encryption/startup";
import { ENCRYPTION_PROOF_FIXTURE } from "./fixture";

const QA_ID = "com.lab4code.moodinator.qa";
const LEGACY_KEY = "cd".repeat(32); // Fabricated QA key only.
type Progress = (message: string) => void;

function requireQaPackage() {
  if (Application.applicationId !== QA_ID) throw new Error("Encryption proof requires the isolated QA package.");
  if (Platform.OS !== "android" && Platform.OS !== "ios") throw new Error("Encryption proof requires a native QA build.");
}

// Consume only the disposable simulator driver's next cold-launch action.
export function readEncryptionProofLaunchUrl() {
  requireQaPackage();
  const request = new File(Paths.document, "encryption-proof-launch.txt");
  if (!request.exists) return null;
  const url = request.textSync();
  check(url.startsWith("moodinator-qa:///?"), "Invalid native proof launch request");
  request.delete();
  return url;
}

// The simulator driver reads only this QA status file, never databases or keys.
export function writeEncryptionProofStatus(status: { sourceSha: unknown; runId: string | null; progress: string; result?: unknown }) {
  requireQaPackage();
  check(typeof status.sourceSha === "string" && /^[0-9a-f]{40}$/.test(status.sourceSha), "Prepared QA source identity is missing");
  new File(Paths.document, "encryption-proof-status.json").write(JSON.stringify(status));
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equalBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function fixture(caseName: string, initialize = async (_db: SQLite.SQLiteDatabase) => {}) {
  requireQaPackage();
  check(/^[a-z0-9-]+$/.test(caseName), "Invalid native proof case");
  const directory = new Directory(Paths.document, "encryption-proof", caseName);
  directory.create({ idempotent: true, intermediates: true });
  const namespace = `encryptionProof.${caseName}`;
  const storage = createNativeEncryptionStorage(initialize, { directory: directory.uri, keyNamespace: namespace });
  const file = (name: string) => new File(directory, name);
  return { directory, namespace, storage, file };
}

async function seed(f: ReturnType<typeof fixture>, legacy = false, orphans = false) {
  for (const name of Object.values(DATABASE_FILES)) {
    check(!await f.storage.exists(name), "Proof case already contains a database. Use a fresh owned QA install.");
  }
  const db = await f.storage.open(DATABASE_FILES.original);
  try {
    if (legacy) {
      await SecureStore.setItemAsync(`${f.namespace}.${LEGACY_KEY_STORAGE_NAME}`, LEGACY_KEY);
      await db.execAsync(legacyKeyPragma(LEGACY_KEY));
    }
    await db.execAsync(ENCRYPTION_PROOF_FIXTURE);
    if (orphans) await db.execAsync(`PRAGMA foreign_keys = OFF;
      DELETE FROM mood_emotions WHERE mood_id = 1;
      INSERT INTO mood_emotions VALUES (777, 1);
      DELETE FROM emotions WHERE id = 3;`);
    const snapshot = await captureSnapshot(db);
    f.file("expected.json").write(JSON.stringify(snapshot));
    return snapshot;
  } finally { await db.closeAsync(); }
}

async function roundtrip(f: ReturnType<typeof fixture>, db: SQLite.SQLiteDatabase) {
  const expected = await captureSnapshot(db);
  const exporter = await f.storage.open(DATABASE_FILES.active);
  try {
    await exporter.execAsync(rawKeyPragma(validateRawKey(await f.storage.loadKey())));
    await exporter.execAsync("PRAGMA foreign_keys = OFF;");
    await exporter.runAsync("ATTACH DATABASE ? AS roundtrip KEY '';", f.storage.path("roundtrip.db"));
    await exporter.execAsync(`SELECT sqlcipher_export('roundtrip');
      PRAGMA roundtrip.user_version = ${expected.userVersion};
      PRAGMA roundtrip.application_id = ${expected.applicationId};
      DETACH DATABASE roundtrip;`);
  } finally { await exporter.closeAsync(); }
  const plain = await f.storage.open("roundtrip.db");
  try { requireMatchingSnapshot(await captureSnapshot(plain), expected); }
  finally { await plain.closeAsync(); }
  await f.storage.remove("roundtrip.db");
}

async function rejectWithoutChanges(f: ReturnType<typeof fixture>, mutate: () => Promise<void>, restore: () => Promise<void>) {
  const bytes = await f.file(DATABASE_FILES.active).bytes();
  await mutate();
  let rejected = false;
  try {
    const unexpected = await openEncryptedDatabase(f.storage);
    await unexpected.closeAsync();
  } catch { rejected = true; }
  try {
    check(rejected, "Unsafe native recovery state was admitted");
    check(equalBytes(await f.file(DATABASE_FILES.active).bytes(), bytes), "A failed startup changed the encrypted database");
  } finally { await restore(); }
}

export async function runEncryptionProof(progress: Progress) {
  requireQaPackage();
  const passed: string[] = [];
  let cipherVersion = "";
  for (const source of ["plaintext", "legacy-passphrase", "legacy-orphans"]) {
    progress(`running:${source}`);
    const f = fixture(source);
    const expected = await seed(f, source === "legacy-passphrase", source === "legacy-orphans");
    const db = await openEncryptedDatabase(f.storage);
    try {
      requireMatchingSnapshot(await captureSnapshot(db), expected);
      check((await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;"))?.foreign_keys === 1, "Published native handle has foreign keys disabled");
      if (source === "legacy-orphans") {
        check((await db.getAllAsync("PRAGMA foreign_key_check;")).length === 2, "Legacy orphan link rows were changed");
        let rejected = false;
        try { await db.execAsync("INSERT INTO mood_emotions VALUES (888, 1);"); }
        catch (error) { rejected = error instanceof Error && /FOREIGN KEY/i.test(error.message); }
        check(rejected, "Published handle accepted a new orphan link");
        await db.execAsync(`INSERT INTO moods (id, mood) VALUES (101, 3);
          INSERT INTO mood_emotions VALUES (101, 1);
          DELETE FROM moods WHERE id = 101;
          UPDATE sqlite_sequence SET seq = 99 WHERE name = 'moods';`);
        check((await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM mood_emotions WHERE mood_id = 101;"))?.count === 0, "Native parent deletion did not cascade");
      }
      cipherVersion = (await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;"))!.cipher_version;
      await roundtrip(f, db);
      await db.execAsync("INSERT INTO moods (mood, note) VALUES (3, 'Fabricated after cutover');");
      check((await db.getFirstAsync<{ id: number }>("SELECT id FROM moods WHERE note = 'Fabricated after cutover';"))?.id === 100, "AUTOINCREMENT sequence was lost");
    } finally { await db.closeAsync(); }
    const reopened = await openEncryptedDatabase(f.storage, async (phase) => {
      check(phase !== "export-started" && phase !== "key-persisted", "Completed native database was migrated again");
    });
    try {
      check((await reopened.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM moods;"))?.count === 6, "Later writes were lost");
      f.file("expected.json").write(JSON.stringify(await captureSnapshot(reopened)));
    }
    finally { await reopened.closeAsync(); }
    check(!await f.storage.exists(DATABASE_FILES.original) && !await f.storage.exists(DATABASE_FILES.copy), "Plaintext migration files remain after successful publication");
    passed.push(`${source}:preservation-roundtrip-later-writes`);
  }

  progress("running:fresh");
  const fresh = fixture("fresh", initializeDatabase);
  const initialized = await openEncryptedDatabase(fresh.storage);
  try {
    check((await initialized.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM moods;"))?.count === 0, "Fresh app schema was not initialized correctly");
    fresh.file("expected.json").write(JSON.stringify(await captureSnapshot(initialized)));
  }
  finally { await initialized.closeAsync(); }
  passed.push("fresh:actual-app-initialization");

  const f = fixture("plaintext");
  const key = validateRawKey(await f.storage.loadKey());
  const keyName = `${f.namespace}.${RAW_KEY_STORAGE_NAME}`;
  await rejectWithoutChanges(f, () => SecureStore.deleteItemAsync(keyName), () => f.storage.saveKey(key));
  passed.push("completed:key-loss-retains-data");
  await rejectWithoutChanges(f, () => f.storage.saveKey("00".repeat(32)), () => f.storage.saveKey(key));
  passed.push("completed:wrong-key-retains-data");
  const coordinatorBytes = await f.file(DATABASE_FILES.coordinator).bytes();
  await rejectWithoutChanges(f, () => f.storage.remove(DATABASE_FILES.coordinator), async () => { f.file(DATABASE_FILES.coordinator).write(coordinatorBytes); });
  passed.push("completed:missing-coordinator-retains-data");
  await rejectWithoutChanges(f, async () => {
    const state = await f.storage.open(DATABASE_FILES.coordinator);
    try { await state.execAsync("UPDATE encryption_state SET version = 999;"); }
    finally { await state.closeAsync(); }
  }, async () => { f.file(DATABASE_FILES.coordinator).write(coordinatorBytes); });
  passed.push("completed:unknown-state-retains-data");

  // Deliberately remove a fabricated active file while a stale source remains.
  // Completed state must not recreate an empty DB or roll back later writes.
  const activeBytes = await f.file(DATABASE_FILES.active).bytes();
  const stale = await f.storage.open(DATABASE_FILES.original);
  try { await stale.execAsync(ENCRYPTION_PROOF_FIXTURE); }
  finally { await stale.closeAsync(); }
  const staleBytes = await f.file(DATABASE_FILES.original).bytes();
  await f.storage.remove(DATABASE_FILES.active);
  try {
    let rejected = false;
    try { const unexpected = await openEncryptedDatabase(f.storage); await unexpected.closeAsync(); }
    catch { rejected = true; }
    check(rejected && !await f.storage.exists(DATABASE_FILES.active), "Missing completed database was silently replaced");
    check(equalBytes(await f.file(DATABASE_FILES.original).bytes(), staleBytes), "A stale source was changed during failed recovery");
  } finally {
    f.file(DATABASE_FILES.active).write(activeBytes);
    await f.storage.remove(DATABASE_FILES.original);
  }
  passed.push("completed:missing-active-does-not-use-stale-original");

  progress("running:native-lock");
  const locked = fixture("native-lock");
  await seed(locked);
  let lockRejected = false;
  const owner = await openEncryptedDatabase(locked.storage, async (phase) => {
    if (phase !== "copy-closed") return;
    const competitor = await locked.storage.open(DATABASE_FILES.coordinator);
    try {
      await competitor.execAsync("PRAGMA busy_timeout = 50;");
      try { await competitor.execAsync("BEGIN EXCLUSIVE;"); }
      catch (error) { lockRejected = error instanceof Error && /locked|busy/i.test(error.message); }
      if (!lockRejected) await competitor.execAsync("ROLLBACK;");
    } finally { await competitor.closeAsync(); }
  });
  await owner.closeAsync();
  check(lockRejected, "A second native connection acquired startup ownership during migration");
  passed.push("native-lock:independent-connection-excluded");
  return { status: "passed", cipherVersion, passed, platform: `${Platform.OS} Expo native`, crashProof: "separate cold-process cases required" };
}

export async function crashEncryptionProof(caseName: string, phase: StartupPhase, progress: Progress) {
  const f = fixture(caseName);
  await seed(f);
  await openEncryptedDatabase(f.storage, async (current) => {
    if (current !== phase) return;
    progress(`paused:${caseName}:${phase}`);
    // The external owned-emulator runner abruptly stops the Android process.
    await new Promise<void>(() => {});
  });
  throw new Error("The requested native crash phase was not reached");
}

export async function resumeEncryptionProof(caseName: string) {
  const f = fixture(caseName);
  const expected: DatabaseSnapshot = JSON.parse(await f.file("expected.json").text());
  const db = await openEncryptedDatabase(f.storage);
  try { requireMatchingSnapshot(await captureSnapshot(db), expected); }
  finally { await db.closeAsync(); }
  const reopened = await openEncryptedDatabase(f.storage);
  try { requireMatchingSnapshot(await captureSnapshot(reopened), expected); }
  finally { await reopened.closeAsync(); }
  check(!await f.storage.exists(DATABASE_FILES.original) && !await f.storage.exists(DATABASE_FILES.copy), "Recovered source cleanup is incomplete");
  return { status: "passed", caseName, evidence: "cold reopen, exact data, recovery and subsequent open" };
}

// Limit only the attached target in a disposable QA namespace. SQLCipher itself
// must reject the actual export with SQLITE_FULL; no JS error substitutes for a
// native write failure and no host/simulator volume is filled.
export async function prepareNativeWriteFailure(progress: Progress) {
  const f = fixture("native-write-failure");
  await seed(f);
  const original = await f.storage.open(DATABASE_FILES.original);
  let expected: DatabaseSnapshot;
  try {
    await original.execAsync("CREATE TABLE qa_write_payload (value TEXT NOT NULL);");
    await original.runAsync("INSERT INTO qa_write_payload VALUES (?);", "Fabricated write-failure payload ".repeat(2048));
    expected = await captureSnapshot(original);
    f.file("expected.json").write(JSON.stringify(expected));
  } finally { await original.closeAsync(); }
  const originalBytes = await f.file(DATABASE_FILES.original).bytes();
  const nativeOpen = f.storage.open;
  let injections = 0;
  let pageLimit = 0;
  f.storage.open = async (name) => {
    const db = await nativeOpen(name);
    if (name !== DATABASE_FILES.copy) return db;
    const nativeExec = db.execAsync.bind(db);
    db.execAsync = async (sql) => {
      if (sql.includes("SELECT sqlcipher_export('encrypted')")) {
        const limit = await db.getFirstAsync<{ max_page_count: number }>("PRAGMA encrypted.max_page_count = 1;");
        pageLimit = limit?.max_page_count ?? 0;
        check(pageLimit > 0 && pageLimit <= 2, "Native attached-target page limit was not applied");
        injections++;
        progress("running:native-write-failure:sqlcipher-export");
      }
      return nativeExec(sql);
    };
    return db;
  };
  let nativeError = "";
  try {
    const unexpected = await openEncryptedDatabase(f.storage);
    await unexpected.closeAsync();
  } catch (error) {
    if (!(error instanceof Error) || !/database or disk is full|SQLITE_FULL/i.test(error.message)) throw error;
    nativeError = error.message;
  } finally { f.storage.open = nativeOpen; }
  check(injections === 1 && nativeError !== "", "Actual SQLCipher export did not reject the native page-limit write");
  check(equalBytes(await f.file(DATABASE_FILES.original).bytes(), originalBytes), "Native write failure changed the original database bytes");
  const retained = await f.storage.open(DATABASE_FILES.original);
  try { requireMatchingSnapshot(await captureSnapshot(retained), expected); }
  finally { await retained.closeAsync(); }
  const coordinator = await f.storage.open(DATABASE_FILES.coordinator);
  try {
    check((await coordinator.getFirstAsync<{ status: string }>("SELECT status FROM encryption_state WHERE id = 1;"))?.status === "pending", "Native failed export was marked completed");
  } finally { await coordinator.closeAsync(); }
  f.file("native-write-failure.json").write(JSON.stringify({ nativeError, pageLimit, originalRetained: true, status: "pending" }));
  return { status: "passed", caseName: "native-write-failure", nativeError, pageLimit,
    evidence: "actual SQLCipher SQLITE_FULL during export, byte-identical original and exact snapshot retained, pending coordinator; cold retry required" };
}

export async function verifyNativeWriteFailureRecovery() {
  const f = fixture("native-write-failure");
  check(f.file("native-write-failure.json").exists, "Native write-failure evidence is required before recovery");
  check(await f.storage.exists(DATABASE_FILES.original), "Cold retry requires the retained failed-export source");
  const expected: DatabaseSnapshot = JSON.parse(await f.file("expected.json").text());
  const original = await f.storage.open(DATABASE_FILES.original);
  try { requireMatchingSnapshot(await captureSnapshot(original), expected); }
  finally { await original.closeAsync(); }
  return resumeEncryptionProof("native-write-failure");
}

export async function prepareNativeExportInterruption(progress: Progress) {
  const caseName = "native-export-interruption";
  const f = fixture(caseName);
  await seed(f);
  const original = await f.storage.open(DATABASE_FILES.original);
  try {
    // 1024 separate 64 KiB fabricated blobs give a bounded 64 MiB native export
    // and a roughly 128 MiB exact hex snapshot, without a giant JS seed string.
    await original.execAsync(`CREATE TABLE qa_export_payload (id INTEGER PRIMARY KEY, value BLOB NOT NULL);
      BEGIN;
      WITH RECURSIVE rows(id) AS (VALUES(1) UNION ALL SELECT id + 1 FROM rows WHERE id < 1024)
      INSERT INTO qa_export_payload SELECT id, zeroblob(65536) FROM rows;
      COMMIT;`);
    check((await original.getFirstAsync<{ bytes: number }>("SELECT sum(length(value)) AS bytes FROM qa_export_payload;"))?.bytes === 64 * 1024 * 1024, "Native export payload size is incorrect");
    f.file("expected.json").write(JSON.stringify(await captureSnapshot(original)));
  } finally { await original.closeAsync(); }
  f.file("export-interruption.json").write(JSON.stringify({ caseName, payloadBytes: 64 * 1024 * 1024,
    target: DATABASE_FILES.active, evidence: "inside-export interruption requires externally observed partial target growth and actual process kill" }));
  const unexpectedlyCompleted = await openEncryptedDatabase(f.storage, async (phase) => {
    if (phase === "export-started" || phase === "export-closed") {
      progress(`running:${caseName}:${phase}`);
    }
    // Return immediately. Pausing here would only prove a phase boundary.
  });
  await unexpectedlyCompleted.closeAsync();
  throw new Error("Native export completed before the external interruption; inside-export proof was not obtained");
}

export async function prepareAppUpgrade() {
  requireQaPackage();
  const storage = createNativeEncryptionStorage(initializeDatabase);
  for (const name of Object.values(DATABASE_FILES)) check(!await storage.exists(name), "QA app data already exists; preparation refuses to replace it");
  const original = await storage.open(DATABASE_FILES.original);
  try { await original.execAsync(ENCRYPTION_PROOF_FIXTURE); }
  finally { await original.closeAsync(); }
  return { status: "passed", evidence: "fabricated plaintext app database prepared for next cold launch" };
}

export async function verifyAppUpgrade() {
  requireQaPackage();
  // Exercise the actual shared getDb startup path and actual app initializer.
  const [first, second] = await Promise.all([getDb(), getDb()]);
  check(first === second, "App startup published different handles to concurrent callers");
  check((await first.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;"))?.foreign_keys === 1, "Actual app handle has foreign keys disabled");
  check((await first.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM moods;"))?.count === 5, "App first-open migration lost mood records");
  check((await first.getFirstAsync<{ value: string }>("SELECT CAST(large_integer AS TEXT) AS value FROM fixture_values;"))?.value === "9007199254740993", "Native app migration lost exact int64 data");
  const storage = createNativeEncryptionStorage(initializeDatabase);
  check(!await storage.exists(DATABASE_FILES.original) && !await storage.exists(DATABASE_FILES.copy), "App admitted data before plaintext cleanup");
  const key = validateRawKey(await storage.loadKey());
  const reopened = await storage.open(DATABASE_FILES.active);
  try { await reopened.execAsync(rawKeyPragma(key)); await captureSnapshot(reopened); }
  finally { await reopened.closeAsync(); }
  return { status: "passed", evidence: "actual getDb, shared handle, initialization, data retention and keyed independent reopen" };
}

export async function loseProofKey() {
  const f = fixture("plaintext");
  check(await f.storage.exists(DATABASE_FILES.active), "Fabricated active database is required");
  f.file("before-key-loss.bin").write(await f.file(DATABASE_FILES.active).bytes());
  await SecureStore.deleteItemAsync(`${f.namespace}.${RAW_KEY_STORAGE_NAME}`);
  return { status: "passed", evidence: "fabricated namespace key deleted; cold verification still required" };
}

export async function prepareWalCrash(progress: Progress) {
  const f = fixture("wal-source");
  check(!await f.storage.exists(DATABASE_FILES.original), "WAL proof already contains a source");
  const original = await f.storage.open(DATABASE_FILES.original);
  const mode = await original.getFirstAsync<{ journal_mode: string }>("PRAGMA journal_mode = WAL;");
  check(mode?.journal_mode === "wal", "Native source did not enter WAL mode");
  await original.execAsync(ENCRYPTION_PROOF_FIXTURE);
  f.file("expected.json").write(JSON.stringify(await captureSnapshot(original)));
  check(await f.storage.exists(`${DATABASE_FILES.original}-wal`), "Committed native WAL is missing before interruption");
  check((await f.file(`${DATABASE_FILES.original}-wal`).bytes()).length > 32, "Native WAL has no committed frames");
  progress("paused:wal-source:committed-wal");
  // Leave a committed WAL and its open connection for an abrupt Android stop.
  await new Promise<void>(() => {});
}

export async function verifyLostProofKey() {
  const f = fixture("plaintext");
  check(await f.storage.loadKey() === null, "Deleted native key reappeared after cold launch");
  let rejected = false;
  try { const unexpected = await openEncryptedDatabase(f.storage); await unexpected.closeAsync(); }
  catch { rejected = true; }
  check(rejected, "A cold launch admitted encrypted data with a lost key");
  check(await f.storage.loadKey() === null, "Cold recovery generated a replacement key");
  check(equalBytes(await f.file(DATABASE_FILES.active).bytes(), await f.file("before-key-loss.bin").bytes()), "Cold key-loss recovery changed encrypted data");
  return { status: "passed", evidence: "cold native key-loss rejection, no replacement key, byte-identical encrypted data retained" };
}
