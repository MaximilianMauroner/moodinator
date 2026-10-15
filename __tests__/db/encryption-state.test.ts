import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyKeyPragma, rawKeyPragma, requireCipherVersion, validateRawKey } from "../../db/encryption/keys";
import { inspectDatabase, requireMatchingDatabases, type EncryptionDatabase } from "../../db/encryption/verification";
import { DATABASE_FILES, openEncryptedDatabase, type EncryptionStorage } from "../../db/encryption/startup";

const KEY = "ab".repeat(32); // Fabricated test material only.
const LEGACY_FIXTURE = readFileSync(new URL("../../scripts/encryption-rehearsal/fixture.sql", import.meta.url), "utf8");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Real SQLite/filesystem state tests. Only coordinator capability admission is
// supplied; no encryption implementation or successful native startup is mocked.
class StateDatabase implements EncryptionDatabase {
  constructor(private readonly db: DatabaseSync, private readonly version: string | null,
    private readonly closed: () => void) {
    // The Node adapter emulates the private native reader on small fixtures.
    // This tests comparison semantics, not the C patch or native heap behavior.
    this.db.function("moodinator_blob_read", { varargs: true, useBigIntArguments: true }, (table, column, rowid, offset, length) => {
      if (typeof table !== "string" || typeof column !== "string" || typeof rowid !== "bigint") throw new Error("Invalid fixture reader arguments");
      const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
      const columns = this.db.prepare(`PRAGMA table_xinfo(${identifier(table)})`).all();
      if (columns.some(({ hidden }) => hidden === 2 || hidden === 3)) throw new Error("cannot open table with generated columns");
      const alias = ["rowid", "_rowid_", "oid"].find((name) => !columns.some((column) => String(column.name).toLowerCase() === name));
      if (!alias) throw new Error("Fixture has no hidden rowid alias");
      const from = `FROM ${identifier(table)} WHERE ${alias} = ?`;
      if (offset === undefined) {
        const row = this.db.prepare(`SELECT length(CAST(${identifier(column)} AS BLOB)) AS bytes ${from}`).get(rowid);
        if (!row || typeof row.bytes !== "number") throw new Error("Fixture value length is unavailable");
        return row.bytes;
      }
      const row = this.db.prepare(`SELECT substr(CAST(${identifier(column)} AS BLOB), ?, ?) AS chunk ${from}`)
        .get(Number(offset) + 1, Number(length), rowid);
      if (!row || !(row.chunk instanceof Uint8Array)) throw new Error("Fixture value bytes are unavailable");
      return row.chunk;
    });
  }
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
  async *getEachAsync<Row>(sql: string, ...params: (string | number | null)[]): AsyncIterableIterator<Row> {
    for (const row of this.db.prepare(sql).iterate(...params)) yield { ...row } as Row;
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
    copyFileSync(file("snapshot.db"), file("expected.db"));
    const expected = await storage.open("expected.db");
    try {
      await requireMatchingDatabases(db, expected);
      await db.execAsync("UPDATE values_to_retain SET real_value = 0.12500000000000003;");
      await expect(requireMatchingDatabases(db, expected)).rejects.toThrow("preserve all stored data");
    } finally { await expected.closeAsync(); }
  } finally { await db.closeAsync(); }
  expect(handles.size).toBe(0);
});

it.each([
  { name: "int64", sql: "UPDATE exact_values SET integer_value = 9007199254740992;" },
  { name: "NUL suffix", sql: "UPDATE exact_values SET text_value = 'before' || char(0) || 'changed';" },
  { name: "BLOB byte", sql: "UPDATE exact_values SET blob_value = x'00ff81';" },
  { name: "storage class", sql: "UPDATE exact_values SET untyped_value = 1.0;" },
  { name: "sequence", sql: "UPDATE sqlite_sequence SET seq = 98;" },
  { name: "schema", sql: "DROP INDEX retained_index;" },
])("rejects exact $name loss without JavaScript numeric or text coercion", async ({ sql }) => {
  const f = fixture();
  const seeded = new DatabaseSync(f.file("actual.db"));
  seeded.exec(`CREATE TABLE exact_values (id INTEGER PRIMARY KEY AUTOINCREMENT, integer_value INTEGER,
    text_value TEXT, blob_value BLOB, untyped_value);
    CREATE INDEX retained_index ON exact_values(integer_value);
    INSERT INTO exact_values VALUES (9007199254740993, 9007199254740993, 'before' || char(0) || 'after', x'00ff80', 1);
    UPDATE sqlite_sequence SET seq = 99;`);
  seeded.close();
  copyFileSync(f.file("actual.db"), f.file("expected.db"));
  const actual = await f.storage.open("actual.db");
  const expected = await f.storage.open("expected.db");
  try {
    await requireMatchingDatabases(actual, expected);
    await actual.execAsync(sql);
    await expect(requireMatchingDatabases(actual, expected)).rejects.toThrow("preserve all stored data");
  } finally { await actual.closeAsync(); await expected.closeAsync(); }
});

it("compares individual multi-chunk text/BLOB values with bounded bridge results and detects their tail", async () => {
  const chunkBytes = 256 * 1024;
  const payloadBytes = chunkBytes + 1;
  const f = fixture();
  const seeded = new DatabaseSync(f.file("actual.db"));
  seeded.exec(`CREATE TABLE payload (id INTEGER PRIMARY KEY, text_value TEXT, blob_value BLOB);
    INSERT INTO payload VALUES (1, 'before' || char(0) || printf('%.*c', ${payloadBytes}, 'z'), zeroblob(${payloadBytes}));`);
  seeded.close();
  copyFileSync(f.file("actual.db"), f.file("expected.db"));
  const actual = await f.storage.open("actual.db");
  const expected = await f.storage.open("expected.db");
  const nativeRead = actual.getFirstAsync.bind(actual);
  let chunks = 0;
  let largestRequestedChunk = 0;
  actual.getFirstAsync = async <Row,>(sql: string, ...params: (string | number | null)[]) => {
    const result = await nativeRead<Row>(sql, ...params);
    if (sql.startsWith("SELECT hex(moodinator_blob_read(")) {
      chunks++;
      largestRequestedChunk = Math.max(largestRequestedChunk, Number(params[4]));
      expect(JSON.stringify(result).length).toBeLessThan(chunkBytes * 2 + 32);
    }
    return result;
  };
  try {
    await requireMatchingDatabases(actual, expected);
    expect(chunks).toBe(4);
    expect(largestRequestedChunk).toBe(chunkBytes);
    await actual.execAsync(`UPDATE payload SET blob_value = CAST(substr(blob_value, 1, ${payloadBytes - 1}) || x'01' AS BLOB);`);
    await expect(requireMatchingDatabases(actual, expected)).rejects.toThrow("preserve all stored data");
  } finally { await actual.closeAsync(); await expected.closeAsync(); }
});

it.each([
  { name: "duplicate rows", schema: "CREATE TABLE content (value TEXT COLLATE NOCASE, number_value);", values: "('a', 1), ('A', 1.0), ('a', 1), (NULL, NULL)", move: "UPDATE content SET rowid = -rowid;" },
  { name: "partial rowid shadow", schema: "CREATE TABLE content (rowid TEXT, value TEXT);", values: "('not-an-id', 'payload'), ('another-user-id', 'value')", move: "" },
  { name: "shadowed rowids", schema: "CREATE TABLE content (rowid TEXT, _rowid_ TEXT, oid TEXT);", values: "('a', 'b', 'c'), ('a', 'b', 'c'), (NULL, NULL, NULL)", move: "" },
  { name: "WITHOUT ROWID", schema: "CREATE TABLE content (a TEXT, b INTEGER, value BLOB, PRIMARY KEY(a, b)) WITHOUT /* retained comment */ ROWID;", values: "('a', 1, x'00ff'), ('A', 2, x'0080')", move: "" },
])("retains exact $name and ignores hidden row identity", async ({ schema, values, move }) => {
  const f = fixture();
  const seeded = new DatabaseSync(f.file("actual.db"));
  seeded.exec(`${schema} INSERT INTO content VALUES ${values};`);
  seeded.close();
  copyFileSync(f.file("actual.db"), f.file("expected.db"));
  const actual = await f.storage.open("actual.db");
  const expected = await f.storage.open("expected.db");
  try {
    if (move) await actual.execAsync(move);
    await requireMatchingDatabases(actual, expected);
    await actual.execAsync("DELETE FROM content WHERE 1 = 1;");
    await expect(requireMatchingDatabases(actual, expected)).rejects.toThrow("preserve all stored data");
  } finally { await actual.closeAsync(); await expected.closeAsync(); }
});

it.each(["VIRTUAL", "STORED"])("compares %s generated-column tables without unsupported native blob reads", async (mode) => {
  const f = fixture();
  const seeded = new DatabaseSync(f.file("actual.db"));
  seeded.exec(`CREATE TABLE generated (id INTEGER PRIMARY KEY, value TEXT,
    derived TEXT GENERATED ALWAYS AS (value || '-suffix') ${mode});
    INSERT INTO generated(id, value) VALUES (1, 'before' || char(0) || 'after');`);
  seeded.close();
  copyFileSync(f.file("actual.db"), f.file("expected.db"));
  const actual = await f.storage.open("actual.db");
  const expected = await f.storage.open("expected.db");
  try {
    await requireMatchingDatabases(actual, expected);
    await actual.execAsync("UPDATE generated SET value = 'before' || char(0) || 'changed';");
    await expect(requireMatchingDatabases(actual, expected)).rejects.toThrow("preserve all stored data");
  } finally { await actual.closeAsync(); await expected.closeAsync(); }
});

describe("legacy relationship preservation", () => {
  it("retains known orphan rows from FK-off mood and emotion deletion", async () => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      const snapshot = await inspectDatabase(db);
      expect(snapshot.legacyForeignKeyViolations.map(({ parent, count }) => ({ parent, count }))).toEqual([
        { parent: "emotions", count: 1 }, { parent: "moods", count: 1 },
      ]);
      expect(await db.getAllAsync("SELECT mood_id, emotion_id FROM mood_emotions ORDER BY mood_id;")).toEqual([
        { mood_id: 1, emotion_id: 1 }, { mood_id: 2, emotion_id: 3 }, { mood_id: 3, emotion_id: 2 },
      ]);
      expect((await db.getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM mood_emotions;"))?.count).toBe(3);
    } finally { await db.closeAsync(); }
  });

  it("compares equivalent relationship rows despite reassigned hidden rowids", async () => {
    const f = fixture();
    f.seedLegacyLinks("relations.db");
    const db = await f.storage.open("relations.db");
    try {
      copyFileSync(f.file("relations.db"), f.file("expected.db"));
      const expected = await f.storage.open("expected.db");
      try {
        const before = await db.getAllAsync("PRAGMA foreign_key_check;");
        await db.execAsync("UPDATE mood_emotions SET rowid = rowid + 100;");
        expect(await db.getAllAsync("PRAGMA foreign_key_check;")).not.toEqual(before);
        await requireMatchingDatabases(db, expected);
      } finally { await expected.closeAsync(); }
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
      copyFileSync(f.file("relations.db"), f.file("expected.db"));
      const expected = await f.storage.open("expected.db");
      try {
        const original = await inspectDatabase(expected);
        await db.execAsync(`PRAGMA foreign_keys = OFF; ${sql}`);
        const damaged = await inspectDatabase(db);
        if (loss === "changed") expect(damaged.legacyForeignKeyViolations).toEqual(original.legacyForeignKeyViolations);
        await expect(requireMatchingDatabases(db, expected)).rejects.toThrow("preserve all stored data");
      } finally { await expected.closeAsync(); }
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
      await expect(inspectDatabase(db)).rejects.toThrow("relationship verification failed");
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
    try { await expect(inspectDatabase(db)).rejects.toThrow("relationship verification failed"); }
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

  it.each(["plaintext", "fresh"])("retains verification files when %s source ownership cannot be verified", async (source) => {
    const f = fixture({ key: KEY });
    f.state("pending", source);
    if (source === "fresh") f.seed(DATABASE_FILES.original);
    writeFileSync(f.file(DATABASE_FILES.verification), "Fabricated encrypted verification copy");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow(source === "fresh" ? "Unexpected source files" : "original database is missing");
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(existsSync(f.file(DATABASE_FILES.verification))).toBe(true);
    expect(f.handles.size).toBe(0);
  });

  it("refuses an orphan encrypted verification copy before creating state or keys", async () => {
    const f = fixture();
    writeFileSync(f.file(DATABASE_FILES.verification), "Fabricated encrypted verification copy");
    const before = readFileSync(f.file(DATABASE_FILES.verification));
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("state is missing");
    expect(f.opened).toEqual([]);
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(readFileSync(f.file(DATABASE_FILES.verification))).toEqual(before);
  });

  it("does not replace a lost key when only a pending encrypted verification copy remains", async () => {
    const f = fixture();
    f.state("pending");
    f.seed(DATABASE_FILES.original);
    writeFileSync(f.file(DATABASE_FILES.verification), "Fabricated encrypted verification copy");
    await expect(openEncryptedDatabase(f.storage)).rejects.toThrow("encrypted database key is missing");
    expect(f.storage.createKey).not.toHaveBeenCalled();
    expect(f.storage.remove).not.toHaveBeenCalled();
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
