import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legacyKeyPragma } from "../db/encryption/keys";
import { captureSnapshot, requireMatchingSnapshot, type EncryptionDatabase } from "../db/encryption/snapshot";
import { DATABASE_FILES, STARTUP_PHASES, openEncryptedDatabase, type EncryptionStorage } from "../db/encryption/startup";

// This runs the production state machine against actual native SQLCipher
// processes. It is a diagnostic; it cannot prove the Expo bridge or keystore.
const binary = process.argv[2];
if (!binary || !existsSync(binary)) throw new Error("Pass an installed SQLCipher 4.2+ binary.");
const fixtureSql = readFileSync(new URL("./encryption-rehearsal/fixture.sql", import.meta.url), "utf8");
const sessions = new Set<CipherDatabase>();

class CipherDatabase implements EncryptionDatabase {
  private process;
  private buffer = "";
  private errors = "";
  private sequence = 0;
  private failed = false;
  private pending: { marker: string; resolve: (value: string) => void; reject: (error: Error) => void } | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private exited: Promise<void>;

  constructor(filename: string) {
    this.process = spawn(binary, [filename], { stdio: "pipe" });
    sessions.add(this);
    this.exited = new Promise((resolve) => this.process.on("close", () => {
      this.failed = true;
      this.pending?.reject(new Error(this.errors || "SQLCipher session closed"));
      this.pending = null;
      sessions.delete(this);
      resolve();
    }));
    this.process.on("error", (error) => { this.pending?.reject(error); });
    this.process.stderr.on("data", (data) => { this.errors += String(data); });
    this.process.stdout.on("data", (data) => {
      this.buffer += String(data);
      if (!this.pending) return;
      const marker = `${this.pending.marker}\n`;
      const end = this.buffer.indexOf(marker);
      if (end < 0) return;
      const output = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + marker.length);
      const request = this.pending;
      this.pending = null;
      request.resolve(output.trim());
    });
    this.process.stdin.write(".bail on\n.mode json\n");
  }

  private request(sql: string, params: (string | number | null)[] = []): Promise<string> {
    const task = this.tail.then(() => {
      if (this.failed) throw new Error(this.errors || "SQLCipher session closed");
      let index = 0;
      const bound = sql.replace(/\?/g, () => {
        const value = params[index++];
        if (value === undefined) throw new Error("Missing diagnostic SQL parameter");
        return value === null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
      });
      assert.equal(index, params.length);
      const marker = `__moodinator_statement_${++this.sequence}__`;
      return new Promise<string>((resolve, reject) => {
        this.pending = { marker, resolve, reject };
        this.process.stdin.write(`${bound.trim()}\n.print ${marker}\n`);
      });
    });
    this.tail = task.catch(() => {});
    return task;
  }

  async execAsync(sql: string) { await this.request(sql); }
  async getAllAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row[]> {
    const result = await this.request(sql, params);
    return result ? JSON.parse(result) : [];
  }
  async getFirstAsync<Row>(sql: string, ...params: (string | number | null)[]) {
    return (await this.getAllAsync<Row>(sql, ...params))[0] ?? null;
  }
  async runAsync(sql: string, ...params: (string | number | null)[]) {
    await this.request(sql, params);
    return (await this.getFirstAsync<{ changes: number }>("SELECT changes() AS changes;"))!;
  }
  async closeAsync() {
    if (!this.failed) this.process.stdin.end(".quit\n");
    await this.exited;
  }
  crash() { this.process.kill("SIGKILL"); }
}

function storageAt(root: string): EncryptionStorage<CipherDatabase> {
  const file = (name: string) => path.join(root, name);
  return {
    path: file,
    exists: async (name) => existsSync(file(name)),
    open: async (name) => new CipherDatabase(file(name)),
    copy: async (source, target) => { copyFileSync(file(source), file(target)); },
    remove: async (name) => { unlinkSync(file(name)); },
    readHeader: async (name) => readFileSync(file(name)).subarray(0, 16),
    loadKey: async () => existsSync(file("fabricated-key")) ? readFileSync(file("fabricated-key"), "utf8") : null,
    saveKey: async (key) => { writeFileSync(file("fabricated-key"), key, { mode: 0o600, flush: true }); },
    createKey: () => "ab".repeat(32),
    loadLegacyKey: async () => "cd".repeat(32),
    initialize: async (db) => { await db.execAsync("CREATE TABLE IF NOT EXISTS fresh_install (id INTEGER PRIMARY KEY);"); },
  };
}

async function seed(storage: EncryptionStorage<CipherDatabase>, legacy = false) {
  const db = await storage.open(DATABASE_FILES.original);
  try {
    if (legacy) await db.execAsync(legacyKeyPragma((await storage.loadLegacyKey())!));
    await db.execAsync(fixtureSql);
    return await captureSnapshot(db);
  } finally { await db.closeAsync(); }
}

async function verifyRoundtrip(storage: EncryptionStorage<CipherDatabase>, db: CipherDatabase) {
  const expected = await captureSnapshot(db);
  await db.runAsync("ATTACH DATABASE ? AS roundtrip KEY '';", storage.path("roundtrip.db"));
  await db.execAsync(`SELECT sqlcipher_export('roundtrip');
    PRAGMA roundtrip.user_version = ${expected.userVersion};
    PRAGMA roundtrip.application_id = ${expected.applicationId};
    DETACH DATABASE roundtrip;`);
  const plain = await storage.open("roundtrip.db");
  try { requireMatchingSnapshot(await captureSnapshot(plain), expected); }
  finally { await plain.closeAsync(); }
}

if (process.argv[3] === "--crash") {
  const storage = storageAt(process.argv[4]);
  await openEncryptedDatabase(storage, async (phase) => {
    if (phase !== process.argv[5]) return;
    for (const session of sessions) session.crash();
    process.exit(86);
  });
  throw new Error("Requested crash phase was not reached");
}

const roots: string[] = [];
const freshStorage = () => {
  const root = mkdtempSync(path.join(tmpdir(), "moodinator-startup-native-"));
  roots.push(root);
  return { root, storage: storageAt(root) };
};
const passed: string[] = [];
try {
  for (const source of ["plaintext", "legacy-passphrase", "fresh"]) {
    const { storage } = freshStorage();
    if (source !== "fresh") await seed(storage, source === "legacy-passphrase");
    const db = await openEncryptedDatabase(storage);
    await verifyRoundtrip(storage, db);
    await db.execAsync("INSERT INTO fresh_install VALUES (1);");
    await db.closeAsync();
    const reopened = await openEncryptedDatabase(storage);
    assert.equal((await reopened.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM fresh_install;"))?.count, 1);
    await reopened.closeAsync();
    assert.equal(await storage.exists(DATABASE_FILES.original), false);
    assert.equal(await storage.exists(DATABASE_FILES.copy), false);
    passed.push(source);
  }
  for (const phase of STARTUP_PHASES) {
    const { root, storage } = freshStorage();
    await seed(storage);
    const original = readFileSync(storage.path(DATABASE_FILES.original));
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), binary, "--crash", root, phase], { timeout: 30000, encoding: "utf8" });
    assert.equal(child.status, 86, child.stderr || child.error?.message);
    if (await storage.exists(DATABASE_FILES.original)) assert.deepEqual(readFileSync(storage.path(DATABASE_FILES.original)), original);
    const recovered = await openEncryptedDatabase(storage);
    assert.equal((await recovered.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM moods;"))?.count, 5);
    await recovered.closeAsync();
    const reopened = await openEncryptedDatabase(storage);
    await reopened.closeAsync();
    passed.push(`crash:${phase}`);
  }
  const { storage } = freshStorage();
  const complete = await openEncryptedDatabase(storage);
  await complete.closeAsync();
  const encrypted = readFileSync(storage.path(DATABASE_FILES.active));
  await storage.remove("fabricated-key");
  await assert.rejects(openEncryptedDatabase(storage), /stored database key/);
  assert.deepEqual(readFileSync(storage.path(DATABASE_FILES.active)), encrypted);
  passed.push("completed-key-loss-retains-data");
  console.log(JSON.stringify({ scope: "Actual native SQLCipher; Expo/mobile proof still required", passed }, null, 2));
} finally {
  for (const session of sessions) await session.closeAsync();
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
