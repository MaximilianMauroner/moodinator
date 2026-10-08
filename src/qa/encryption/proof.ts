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
  if (Platform.OS !== "android") throw new Error("This automated proof covers Android; iOS acceptance requires its own native journey.");
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

async function seed(f: ReturnType<typeof fixture>, legacy = false) {
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
    const snapshot = await captureSnapshot(db);
    f.file("expected.json").write(JSON.stringify(snapshot));
    return snapshot;
  } finally { await db.closeAsync(); }
}

async function roundtrip(f: ReturnType<typeof fixture>, db: SQLite.SQLiteDatabase) {
  const expected = await captureSnapshot(db);
  await db.runAsync("ATTACH DATABASE ? AS roundtrip KEY '';", f.storage.path("roundtrip.db"));
  await db.execAsync(`SELECT sqlcipher_export('roundtrip');
    PRAGMA roundtrip.user_version = ${expected.userVersion};
    PRAGMA roundtrip.application_id = ${expected.applicationId};
    DETACH DATABASE roundtrip;`);
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
  for (const source of ["plaintext", "legacy-passphrase"]) {
    progress(`running:${source}`);
    const f = fixture(source);
    const expected = await seed(f, source === "legacy-passphrase");
    const db = await openEncryptedDatabase(f.storage);
    try {
      requireMatchingSnapshot(await captureSnapshot(db), expected);
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
  return { status: "passed", cipherVersion, passed, platform: "Android Expo native", crashProof: "separate cold-process cases required" };
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
