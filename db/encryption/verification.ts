export interface EncryptionDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getFirstAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row | null>;
  getAllAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row[]>;
  getEachAsync<Row>(sql: string, ...params: (string | number | null)[]): AsyncIterableIterator<Row>;
  closeAsync(): Promise<void>;
}

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };
type ColumnRow = { name: string; pk: number };
type ForeignKeyViolation = { table: string; parent: string; fkid: number };
type ForeignKeyDefinition = {
  id: number; seq: number; table: string; from: string; to: string;
  on_update: string; on_delete: string; match: string;
};
type LegacyForeignKeyViolation = {
  table: string; parent: string; from: string; to: string; seq: number;
  onUpdate: string; onDelete: string; match: string; count: number;
};

const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const CHUNK_BYTES = 16 * 1024;
const mismatch = () => new Error("Database conversion did not preserve all stored data. The original was retained.");

async function legacyForeignKeyViolations(db: EncryptionDatabase): Promise<LegacyForeignKeyViolation[]> {
  const definitions = await db.getAllAsync<ForeignKeyDefinition>('PRAGMA foreign_key_list("mood_emotions");');
  const counts = new Map<string, LegacyForeignKeyViolation>();
  for await (const violation of db.getEachAsync<ForeignKeyViolation>("PRAGMA foreign_key_check;")) {
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
    // Older FK-off deletions left these links behind. Preserve their exact
    // contents and constraint counts, without treating hidden rowids as identity.
    const normalized = { table: violation.table, parent: definition.table,
      from: definition.from, to: definition.to, seq: definition.seq,
      onUpdate: definition.on_update, onDelete: definition.on_delete, match: definition.match };
    const key = JSON.stringify(normalized);
    const previous = counts.get(key);
    counts.set(key, { ...normalized, count: (previous?.count ?? 0) + 1 });
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

/** Metadata only; user table contents stay in SQLite. */
export async function inspectDatabase(db: EncryptionDatabase) {
  let integrityRows = 0;
  for await (const row of db.getEachAsync<{ integrity_check: string }>("PRAGMA integrity_check;")) {
    if (++integrityRows !== 1 || row.integrity_check !== "ok") {
      throw new Error("Database integrity verification failed. Existing files were retained.");
    }
  }
  if (integrityRows !== 1) throw new Error("Database integrity verification failed. Existing files were retained.");
  const legacyViolations = await legacyForeignKeyViolations(db);
  const schema = await db.getAllAsync<SchemaRow>(
    "SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name;"
  );
  const userVersion = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const applicationId = await db.getFirstAsync<{ application_id: number }>("PRAGMA application_id;");
  const encoding = await db.getFirstAsync<{ encoding: string }>("PRAGMA encoding;");
  if (!userVersion || !applicationId || !encoding
    || !Number.isInteger(userVersion.user_version) || !Number.isInteger(applicationId.application_id)
    || !["UTF-8", "UTF-16le", "UTF-16be"].includes(encoding.encoding)) {
    throw new Error("Database metadata verification failed. Existing files were retained.");
  }
  return { schema, legacyForeignKeyViolations: legacyViolations, userVersion: userVersion.user_version,
    applicationId: applicationId.application_id, encoding: encoding.encoding };
}

function rowidColumn(table: SchemaRow, columns: ColumnRow[]) {
  // A broad match may choose the slower offset path for a quoted/commented
  // phrase, which is safe. Avoid a failing SQL probe on .bail CLI adapters.
  if (/\bWITHOUT(?:\s|\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$))+ROWID\b/i.test(table.sql ?? "")) return undefined;
  return ["rowid", "_rowid_", "oid"].find((candidate) => !columns.some((column) => column.name.toLowerCase() === candidate));
}

async function rowOrder(actual: EncryptionDatabase, expected: EncryptionDatabase, table: string, columns: ColumnRow[]) {
  const primaryKey = columns.filter(({ pk }) => pk > 0).sort((left, right) => left.pk - right.pk);
  if (primaryKey.length) {
    const nullable = primaryKey.map(({ name }) => `${identifier(name)} IS NULL`).join(" OR ");
    const query = `SELECT 1 FROM ${table} WHERE ${nullable} LIMIT 1;`;
    if (!await actual.getFirstAsync(query) && !await expected.getFirstAsync(query)) {
      // Unique non-null keys avoid sorting payloads for ordinary app tables and
      // the stress fixture. Nullable keys need all values to order their ties.
      return primaryKey.map(({ name }) => `${identifier(name)} COLLATE BINARY`).join(", ");
    }
  }
  return columns.flatMap(({ name }) => {
    const column = identifier(name);
    return [`typeof(${column})`, `${column} COLLATE BINARY`];
  }).join(", ");
}

function encodedValue(column: string) {
  // Keep int64 and precise reals in SQLite. Text is read as bytes so NUL and
  // database encoding survive; only bounded hex chunks reach JavaScript.
  return `CAST(CASE typeof(${column}) WHEN 'real' THEN printf('%!.26g', ${column})
    WHEN 'null' THEN x'' ELSE ${column} END AS BLOB)`;
}

type RowPosition = { position: string | null };
type Cell = { storage_type: string; bytes: number };

async function compareCell(actual: EncryptionDatabase, expected: EncryptionDatabase,
  table: string, columnName: string, incremental: boolean, actualRow: string, expectedRow: string,
  actualParams: (string | number)[], expectedParams: (string | number)[]) {
  const column = identifier(columnName);
  const value = encodedValue(column);
  const bytes = incremental
    ? `CASE WHEN typeof(${column}) IN ('text', 'blob') THEN moodinator_blob_read(?, ?, CAST(? AS INTEGER)) ELSE length(${value}) END`
    : `length(${value})`;
  const metadata = `SELECT typeof(${column}) AS storage_type, ${bytes} AS bytes `;
  const metadataParams = (params: (string | number)[]) => incremental ? [table, columnName, params[0], ...params] : params;
  const left = await actual.getFirstAsync<Cell>(metadata + actualRow, ...metadataParams(actualParams));
  const right = await expected.getFirstAsync<Cell>(metadata + expectedRow, ...metadataParams(expectedParams));
  if (!left || !right || left.storage_type !== right.storage_type || left.bytes !== right.bytes
    || !Number.isSafeInteger(left.bytes) || left.bytes < 0) throw mismatch();
  for (let offset = 0; offset < left.bytes; offset += CHUNK_BYTES) {
    const nativeBlob = incremental && (left.storage_type === "text" || left.storage_type === "blob");
    const query = nativeBlob ? "SELECT hex(moodinator_blob_read(?, ?, CAST(? AS INTEGER), ?, ?)) AS chunk;"
      : `SELECT hex(substr(${value}, ?, ?)) AS chunk `;
    const chunkParams = (params: (string | number)[]) => nativeBlob
      ? [table, columnName, params[0], offset, CHUNK_BYTES] : [offset + 1, CHUNK_BYTES, ...params];
    const a = await actual.getFirstAsync<{ chunk: string }>(nativeBlob ? query : query + actualRow, ...chunkParams(actualParams));
    const b = await expected.getFirstAsync<{ chunk: string }>(nativeBlob ? query : query + expectedRow, ...chunkParams(expectedParams));
    if (!a || !b || a.chunk !== b.chunk || a.chunk.length !== Math.min(CHUNK_BYTES, left.bytes - offset) * 2) throw mismatch();
  }
}

/** Compare exact typed row multisets, including duplicates and sqlite_sequence. */
export async function requireMatchingDatabases(actual: EncryptionDatabase, expected: EncryptionDatabase): Promise<void> {
  const actualMetadata = await inspectDatabase(actual);
  const expectedMetadata = await inspectDatabase(expected);
  if (JSON.stringify(actualMetadata) !== JSON.stringify(expectedMetadata)) throw mismatch();
  for (const table of actualMetadata.schema.filter(({ type }) => type === "table")) {
    const name = identifier(table.name);
    const columns = await actual.getAllAsync<ColumnRow>(`PRAGMA table_xinfo(${name});`);
    const order = await rowOrder(actual, expected, name, columns);
    const actualRowid = rowidColumn(table, columns);
    const expectedRowid = rowidColumn(table, columns);
    const positions = (rowid: string | undefined) =>
      `SELECT ${rowid ? `CAST(${rowid} AS TEXT)` : "NULL"} AS position FROM ${name} ORDER BY ${order};`;
    const right = expected.getEachAsync<RowPosition>(positions(expectedRowid));
    let offset = 0;
    try {
      for await (const left of actual.getEachAsync<RowPosition>(positions(actualRowid))) {
        const next = await right.next();
        if (next.done) throw mismatch();
        const row = (rowid: string | undefined) => rowid
          ? `FROM ${name} WHERE ${rowid} = CAST(? AS INTEGER);`
          : `FROM ${name} ORDER BY ${order} LIMIT 1 OFFSET ?;`;
        const actualPosition = actualRowid ? left.position : offset;
        const expectedPosition = expectedRowid ? next.value.position : offset;
        if (actualPosition === null || expectedPosition === null) throw mismatch();
        for (const column of columns) {
          await compareCell(actual, expected, table.name, column.name, actualRowid !== undefined, row(actualRowid), row(expectedRowid),
            [actualPosition], [expectedPosition]);
        }
        offset++;
      }
      if (!(await right.next()).done) throw mismatch();
    } finally { await right.return?.(); }
  }
}
