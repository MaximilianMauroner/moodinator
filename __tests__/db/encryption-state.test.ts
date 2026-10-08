import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyKeyPragma, rawKeyPragma, requireCipherVersion, validateRawKey } from "../../db/encryption/keys";
import { captureSnapshot, requireMatchingSnapshot, type EncryptionDatabase } from "../../db/encryption/snapshot";
import { DATABASE_FILES, openEncryptedDatabase, type EncryptionStorage } from "../../db/encryption/startup";

const KEY = "ab".repeat(32); // Fabricated test material only.
const LEGACY_FIXTURE = readFileSync(new URL("../../scripts/encryption-rehearsal/fixture.sql", import.meta.url), "utf8");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Real SQLite/filesystem state tests. Only coordinator capability admission is
// supplied; no encryption implementation or successful native startup is mocked.
class StateDatabase implements EncryptionDatabase {
  constructor(private readonly db: DatabaseSync, private readonly version: string | null,
    private readonly closed: () => void) {}
  async execAsync(sql: string) { this.db.exec(sql); }
  async runAsync(sql: string, ...params: (string | number | null)[]) {
    return { changes: Number(this.db.prepare(sql).run(...params).changes) };
  }
  async getAllAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row[]> {
    const rows = sql === "PRAGMA cipher_version;"
      ? (this.version ? [{ cipher_version: this.version }] : [])
      : this.db.prepare(sql).all(...params).map((row) => ({ ...row }));
    return rows as Row[];
  }
  async getFirstAsync<Row>(sql: string, ...params: (string | number | null)[]) {
    return (await this.getAllAsync<Row>(sql, ...params))[0] ?? null;
  }
  async closeAsync() { this.db.close(); this.closed(); }
}

function fixture({ key = null, version = "4.7.0 community" }: { key?: string | null; version?: string | null } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "moodinator-encryption-state-"));
  roots.push(root);
  let storedKey = key;
  const handles = new Set<DatabaseSync>();
  const opened: string[] = [];
  const file = (name: string) => path.join(root, name);
  const storage: EncryptionStorage<StateDatabase> = {
    path: file,
    exists: async (name) => existsSync(file(name)),
    open: async (name) => {
      opened.push(name);
      const db = new DatabaseSync(file(name));
      handles.add(db);
      return new StateDatabase(db, version, () => handles.delete(db));
    },
    copy: vi.fn(async (source, target) => { copyFileSync(file(source), file(target)); }),
    remove: vi.fn(async (name) => { unlinkSync(file(name)); }),
    readHeader: async (name) => readFileSync(file(name)).subarray(0, 16),
    loadKey: vi.fn(async () => storedKey),
    saveKey: vi.fn(async (value) => { storedKey = value; }),
    createKey: vi.fn(() => KEY),
    loadLegacyKey: vi.fn(async () => null),
    initialize: vi.fn(async () => {}),
  };
  function seed(name: string) {
    const db = new DatabaseSync(file(name));
    db.exec("CREATE TABLE retained (id INTEGER PRIMARY KEY, note TEXT); INSERT INTO retained VALUES (1, 'Fabricated original');");
    db.close();
  }
  function state(status: string, source = "plaintext", stateVersion = 2) {
    const db = new DatabaseSync(file(DATABASE_FILES.coordinator));
    db.exec("CREATE TABLE encryption_state (id INTEGER PRIMARY KEY, version INTEGER, status TEXT, source TEXT);");
    db.prepare("INSERT INTO encryption_state VALUES (1, ?, ?, ?)").run(stateVersion, status, source);
    db.close();
  }
  function seedLegacyLinks(name: string, schema = LEGACY_FIXTURE) {
    const db = new DatabaseSync(file(name));
    try {
      db.exec(schema);
      // Same deletes as the pre-encryption app, with its FK-off connection.
      db.exec("PRAGMA foreign_keys = OFF; DELETE FROM moods WHERE id = 1; DELETE FROM emotions WHERE name = 'Tired';");
    } finally { db.close(); }
  }
  function recordedState() {
    const db = new DatabaseSync(file(DATABASE_FILES.coordinator));
    try { return { ...db.prepare("SELECT version, status, source FROM encryption_state").get() }; }
    finally { db.close(); }
  }
  return { root, file, storage, handles, opened, seed, seedLegacyLinks, state, recordedState };
}

describe("database key and SQLCipher admission", () => {
  it("keeps V1 passphrase semantics distinct from V2 raw-key SQL", () => {
    expect(rawKeyPragma(KEY)).toBe(`PRAGMA key = "x'${KEY}'";`);
    expect(legacyKeyPragma(KEY)).toBe(`PRAGMA key = '${KEY}';`);
    for (const invalid of [null, "", "aa".repeat(31), "gg".repeat(32), `${KEY}'; SELECT 1;--`]) {
      expect(() => validateRawKey(invalid)).toThrow();
    }
  });

  it("rejects unknown and pre-4.2 runtimes and compares versions numerically", () => {
    for (const version of [null, "", "unknown", "4.2", "4.2.0\n", "4.2.0-beta", "3.4.2", "4.1.10 community", "9007199254740992.2.0"]) {
      expect(() => requireCipherVersion(version)).toThrow();
    }
    for (const version of ["4.2.0", "4.7.0 community", "4.10.0", "5.0.0"]) {
      expect(requireCipherVersion(version)).toBe(version);
    }
  });
});

it("snapshot comparison retains int64, NUL text, BLOBs, close real values and sequence state before the JS bridge", async () => {
  const { file, storage, handles } = fixture();
  const seeded = new DatabaseSync(file("snapshot.db"));
  seeded.exec(`CREATE TABLE values_to_retain (id INTEGER PRIMARY KEY AUTOINCREMENT, integer_value INTEGER, text_value TEXT, blob_value BLOB, real_value REAL);
    INSERT INTO values_to_retain VALUES (1, 9007199254740993, 'before' || char(0) || 'after', x'00ff80', 0.125);
    UPDATE sqlite_sequence SET seq = 99;
    PRAGMA user_version = 7; PRAGMA application_id = 1297040452;`);
  seeded.close();
  const db = await storage.open("snapshot.db");
  try {
    const original = await captureSnapshot(db);
    expect(original.content.values_to_retain[0]).toContain("integer:9007199254740993");
    expect(original.content.values_to_retain[0]).toContain("text:6265666F7265006166746572");
    expect(original.content.values_to_retain[0]).toContain("blob:00FF80");
    expect(original.content.sqlite_sequence[0]).toContain("integer:99");
    await db.execAsync("UPDATE values_to_retain SET real_value = 0.12500000000000003;");
    expect(() => requireMatchingSnapshot(original, original)).not.toThrow();
    const changed = await captureSnapshot(db);
    expect(() => requireMatchingSnapshot(changed, original)).toThrow("preserve all stored data");
  } finally { await db.closeAsync(); }
  expect(handles.size).toBe(0);
});

describe("legacy relationship preservation", () => {
  it("retains known orphan rows from FK-off mood and emotion deletion", async () => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      const snapshot = await captureSnapshot(db);
      expect(snapshot.legacyForeignKeyViolations.map(({ parent, count }) => ({ parent, count }))).toEqual([
        { parent: "emotions", count: 1 }, { parent: "moods", count: 1 },
      ]);
      expect(await db.getAllAsync("SELECT mood_id, emotion_id FROM mood_emotions ORDER BY mood_id;")).toEqual([
        { mood_id: 1, emotion_id: 1 }, { mood_id: 2, emotion_id: 3 }, { mood_id: 3, emotion_id: 2 },
      ]);
      expect(snapshot.content.mood_emotions).toHaveLength(3);
    } finally { await db.closeAsync(); }
  });

  it("compares equivalent relationship rows despite reassigned hidden rowids", async () => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      const original = await captureSnapshot(db);
      const before = await db.getAllAsync("PRAGMA foreign_key_check;");
      await db.execAsync("UPDATE mood_emotions SET rowid = rowid + 100;");
      expect(await db.getAllAsync("PRAGMA foreign_key_check;")).not.toEqual(before);
      const compacted = await captureSnapshot(db);
      expect(() => requireMatchingSnapshot(compacted, original)).not.toThrow();
    } finally { await db.closeAsync(); }
  });

  it.each([
    { loss: "missing", sql: "DELETE FROM mood_emotions WHERE mood_id = 1;" },
    { loss: "changed", sql: "UPDATE mood_emotions SET mood_id = 9876 WHERE mood_id = 1;" },
  ])("rejects $loss orphan row contents even when physical integrity remains valid", async ({ sql, loss }) => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      const original = await captureSnapshot(db);
      await db.execAsync(`PRAGMA foreign_keys = OFF; ${sql}`);
      const damaged = await captureSnapshot(db);
      if (loss === "changed") expect(damaged.legacyForeignKeyViolations).toEqual(original.legacyForeignKeyViolations);
      expect(() => requireMatchingSnapshot(damaged, original)).toThrow("preserve all stored data");
    } finally { await db.closeAsync(); }
  });

  it("keeps unrelated foreign-key violations fatal", async () => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      await db.execAsync(`PRAGMA foreign_keys = OFF;
        CREATE TABLE unknown_relationship (parent_id INTEGER REFERENCES moods(id) ON DELETE CASCADE);
        INSERT INTO unknown_relationship VALUES (9999);`);
      await expect(captureSnapshot(db)).rejects.toThrow("relationship verification failed");
    } finally { await db.closeAsync(); }
  });

  it.each([
    { change: "cascade", replacement: "FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE NO ACTION" },
    { change: "column", replacement: "FOREIGN KEY (mood_id) REFERENCES emotions(id) ON DELETE CASCADE" },
  ])("does not admit a same-named junction with a changed $change constraint", async ({ replacement }) => {
    const f = fixture();
    f.seedLegacyLinks("relations.db", LEGACY_FIXTURE.replace(
      "FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE", replacement
    ));
    const db = await f.storage.open("relations.db");
    try { await expect(captureSnapshot(db)).rejects.toThrow("relationship verification failed"); }
    finally { await db.closeAsync(); }
  });
});

describe("fail-closed startup state", () => {
  it("rejects an unavailable FK enforcement setting before initializing or publishing a target", async () => {
    const f = fixture();
    f.state("pending", "fresh");
    const open = f.storage.open;
    f.storage.open = async (name) => {
      const db = await open(name);
      if (name === DATABASE_FILES.active) {
        // Real SQLite ignores FK=ON inside a transaction. No successful
        // encryption is simulated to reach this early startup failure.
        await db.execAsync("PRAGMA foreign_keys = OFF; BEGIN;");
      }
      return db;
    };
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("foreign-key enforcement is unavailable");
    expect(f.storage.initialize).not.toHaveBeenCalled();
    expect(f.recordedState().status).toBe("pending");
    expect(f.handles.size).toBe(0);
  });

  it("refuses orphan encrypted data before creating a missing coordinator or a key", async () => {
    const f = fixture();
    writeFileSync(f.file(DATABASE_FILES.active), "Fabricated orphan encrypted bytes");
    const before = readFileSync(f.file(DATABASE_FILES.active));
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("state is missing");
    expect(f.opened).toEqual([]);
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(readFileSync(f.file(DATABASE_FILES.active))).toEqual(before);
  });

  it("refuses staging sidecars without positive intent even when the coordinator exists", async () => {
    const f = fixture();
    writeFileSync(f.file(DATABASE_FILES.coordinator), "");
    writeFileSync(f.file(DATABASE_FILES.copy + "-journal"), "Fabricated orphan journal");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("no committed intent");
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("retains all files when coordinator format is unknown", async () => {
    const f = fixture();
    f.state("pending", "plaintext", 3);
    f.seed(DATABASE_FILES.original);
    const before = readFileSync(f.file(DATABASE_FILES.original));
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("state is unknown");
    expect(readFileSync(f.file(DATABASE_FILES.original))).toEqual(before);
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.storage.saveKey).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("commits pending intent before touching the key or target and releases handles on interruption", async () => {
    const f = fixture();
    await expect(openEncryptedDatabase(f.storage, async (phase) => {
      if (phase === "intent-committed") throw new Error("Simulated interruption after durable intent");
    })).rejects.toThrow("Simulated interruption");
    expect(f.recordedState()).toEqual({ version: 2, status: "pending", source: "fresh" });
    expect(f.storage.saveKey).not.toHaveBeenCalled();
    expect(existsSync(f.file(DATABASE_FILES.active))).toBe(false);
    expect(f.handles.size).toBe(0);
  });

  it("completed state with a missing active file never reopens the retained original", async () => {
    const f = fixture({ key: KEY });
    f.state("completed");
    f.seed(DATABASE_FILES.original);
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("completed encrypted database is missing");
    expect(f.opened).toEqual([DATABASE_FILES.coordinator]);
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.storage.copy).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("completed state with lost keys preserves active and original without regenerating a key", async () => {
    const f = fixture();
    f.state("completed");
    f.seed(DATABASE_FILES.original);
    writeFileSync(f.file(DATABASE_FILES.active), "Fabricated encrypted target");
    const before = readFileSync(f.file(DATABASE_FILES.active));
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("key is missing or invalid");
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.storage.saveKey).not.toHaveBeenCalled();
    expect(f.opened).toEqual([DATABASE_FILES.coordinator]);
    expect(readFileSync(f.file(DATABASE_FILES.active))).toEqual(before);
    expect(existsSync(f.file(DATABASE_FILES.original))).toBe(true);
    expect(f.handles.size).toBe(0);
  });

  it("a damaged completed target never rolls back to a stale original", async () => {
    const f = fixture({ key: KEY });
    f.state("completed");
    f.seed(DATABASE_FILES.original);
    writeFileSync(f.file(DATABASE_FILES.active), "Fabricated corrupt target");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow();
    expect(f.opened).toEqual([DATABASE_FILES.coordinator, DATABASE_FILES.active]);
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("pending state never regenerates a lost key for an existing incomplete target", async () => {
    const f = fixture();
    f.state("pending");
    f.seed(DATABASE_FILES.original);
    writeFileSync(f.file(DATABASE_FILES.active), "Fabricated interrupted target");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("encrypted database key is missing");
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("repersists a cached key on every pending attempt before creating a target", async () => {
    const f = fixture({ key: KEY });
    f.state("pending");
    f.seed(DATABASE_FILES.original);
    f.storage.saveKey = vi.fn(async () => { throw new Error("Fabricated native commit failure"); });
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("native commit failure");
    expect(f.storage.saveKey).toHaveBeenCalledWith(KEY);
    expect(f.storage.copy).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
    f.storage.saveKey = vi.fn(async () => {});
    await expect(openEncryptedDatabase(f.storage, async (phase) => {
      if (phase === "key-persisted") throw new Error("Stop after verified key persistence");
    })).rejects.toThrow("verified key persistence");
    expect(f.storage.saveKey).toHaveBeenCalledWith(KEY);
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.storage.copy).not.toHaveBeenCalled();
    expect(f.recordedState().status).toBe("pending");
    expect(f.handles.size).toBe(0);
  });

  it("failed key readback never creates a target or copies original data", async () => {
    const f = fixture();
    f.state("pending");
    f.seed(DATABASE_FILES.original);
    f.storage.loadKey = vi.fn(async () => null);
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("could not be read back");
    expect(f.storage.saveKey).toHaveBeenCalled();
    expect(f.storage.copy).not.toHaveBeenCalled();
    expect(existsSync(f.file(DATABASE_FILES.active))).toBe(false);
    expect(f.handles.size).toBe(0);
  });

  it("retains a pending target when the verified original needed for retry is missing", async () => {
    const f = fixture({ key: KEY });
    f.state("pending");
    writeFileSync(f.file(DATABASE_FILES.active), "Fabricated incomplete target");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("original database is missing");
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.storage.copy).not.toHaveBeenCalled();
    expect(f.handles.size).toBe(0);
  });

  it("a missing or old native runtime fails before key writes or staging", async () => {
    for (const version of [null, "4.1.10 community"]) {
      const f = fixture({ version });
      await expect(openEncryptedDatabase(f.storage)).rejects.toThrow(/SQLCipher/);
      expect(f.storage.saveKey).not.toHaveBeenCalled();
      expect(f.storage.copy).not.toHaveBeenCalled();
      expect(existsSync(f.file(DATABASE_FILES.active))).toBe(false);
      expect(f.handles.size).toBe(0);
    }
  });
});
