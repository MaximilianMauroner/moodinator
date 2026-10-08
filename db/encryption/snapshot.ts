export interface EncryptionDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getFirstAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row | null>;
  getAllAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row[]>;
  closeAsync(): Promise<void>;
}

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };
type ColumnRow = { name: string };
type ForeignKeyViolation = { table: string; parent: string; fkid: number };
type ForeignKeyDefinition = {
  id: number; seq: number; table: string; from: string; to: string;
  on_update: string; on_delete: string; match: string;
};
type LegacyForeignKeyViolation = {
  table: string; parent: string; from: string; to: string; seq: number;
  onUpdate: string; onDelete: string; match: string; count: number;
};

export type DatabaseSnapshot = {
  schema: SchemaRow[];
  content: Record<string, string[]>;
  legacyForeignKeyViolations: LegacyForeignKeyViolation[];
  userVersion: number;
  applicationId: number;
  encoding: string;
};

const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function captureLegacyForeignKeyViolations(db: EncryptionDatabase): Promise<LegacyForeignKeyViolation[]> {
  const violations = await db.getAllAsync<ForeignKeyViolation>("PRAGMA foreign_key_check;");
  if (violations.length === 0) return [];
  const definitions = await db.getAllAsync<ForeignKeyDefinition>('PRAGMA foreign_key_list("mood_emotions");');
  const counts = new Map<string, LegacyForeignKeyViolation>();
  for (const violation of violations) {
    const constraint = definitions.filter((row) => row.id === violation.fkid);
    const definition = constraint[0];
    const expectedColumn = definition?.table === "moods" ? "mood_id"
      : definition?.table === "emotions" ? "emotion_id" : null;
    if (violation.table !== "mood_emotions" || constraint.length !== 1
      || !definition || definition.seq !== 0 || definition.table !== violation.parent
      || definition.from !== expectedColumn || definition.to !== "id"
      || definition.on_delete !== "CASCADE" || definition.on_update !== "NO ACTION"
      || definition.match !== "NONE") {
      throw new Error("Database relationship verification failed. Existing files were retained.");
    }
    // FK-off deletions in older versions left these links behind. Preserve them
    // with exact table contents and a constraint/count multiset. Hidden rowids
    // are not identity: sqlcipher_export may compact their holes.
    const normalized = { table: violation.table, parent: definition.table,
      from: definition.from, to: definition.to, seq: definition.seq,
      onUpdate: definition.on_update, onDelete: definition.on_delete, match: definition.match };
    const key = JSON.stringify(normalized);
    const previous = counts.get(key);
    counts.set(key, { ...normalized, count: (previous?.count ?? 0) + 1 });
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

export async function captureSnapshot(db: EncryptionDatabase): Promise<DatabaseSnapshot> {
  const integrity = await db.getAllAsync<{ integrity_check: string }>("PRAGMA integrity_check;");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error("Database integrity verification failed. Existing files were retained.");
  }
  const legacyForeignKeyViolations = await captureLegacyForeignKeyViolations(db);
  const schema = await db.getAllAsync<SchemaRow>(
    "SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name;"
  );
  const content: Record<string, string[]> = {};
  for (const table of schema.filter((row) => row.type === "table")) {
    const columns = await db.getAllAsync<ColumnRow>(`PRAGMA table_xinfo(${identifier(table.name)});`);
    const fields = columns.map(({ name }) => {
      const column = identifier(name);
      // Encode in SQL before crossing the native bridge: int64 values and text
      // after a NUL would otherwise lose information in JavaScript.
      return `typeof(${column}) || ':' || CASE typeof(${column})
        WHEN 'text' THEN hex(CAST(${column} AS BLOB))
        WHEN 'blob' THEN hex(${column})
        WHEN 'real' THEN printf('%!.26g', ${column})
        ELSE quote(${column}) END AS ${column}`;
    });
    const rows = await db.getAllAsync<Record<string, string>>(
      `SELECT ${fields.join(", ")} FROM ${identifier(table.name)};`
    );
    content[table.name] = rows.map((row) => JSON.stringify(columns.map(({ name }) => row[name]))).sort();
  }
  const userVersion = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const applicationId = await db.getFirstAsync<{ application_id: number }>("PRAGMA application_id;");
  const encoding = await db.getFirstAsync<{ encoding: string }>("PRAGMA encoding;");
  if (!userVersion || !applicationId || !encoding
    || !Number.isInteger(userVersion.user_version) || !Number.isInteger(applicationId.application_id)
    || !["UTF-8", "UTF-16le", "UTF-16be"].includes(encoding.encoding)) {
    throw new Error("Database metadata verification failed. Existing files were retained.");
  }
  return { schema, content, legacyForeignKeyViolations, userVersion: userVersion.user_version,
    applicationId: applicationId.application_id, encoding: encoding.encoding };
}

export function requireMatchingSnapshot(actual: DatabaseSnapshot, expected: DatabaseSnapshot): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    // Do not include mood contents or key material in errors or logs.
    throw new Error("Database conversion did not preserve all stored data. The original was retained.");
  }
}
