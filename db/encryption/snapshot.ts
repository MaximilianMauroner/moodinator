export interface EncryptionDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getFirstAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row | null>;
  getAllAsync<Row>(sql: string, ...params: (string | number | null)[]): Promise<Row[]>;
  closeAsync(): Promise<void>;
}

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };
type ColumnRow = { name: string };

export type DatabaseSnapshot = {
  schema: SchemaRow[];
  content: Record<string, string[]>;
  userVersion: number;
  applicationId: number;
  encoding: string;
};

const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;

export async function captureSnapshot(db: EncryptionDatabase): Promise<DatabaseSnapshot> {
  const integrity = await db.getAllAsync<{ integrity_check: string }>("PRAGMA integrity_check;");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error("Database integrity verification failed. Existing files were retained.");
  }
  if ((await db.getAllAsync("PRAGMA foreign_key_check;")).length !== 0) {
    throw new Error("Database relationship verification failed. Existing files were retained.");
  }
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
  return { schema, content, userVersion: userVersion.user_version,
    applicationId: applicationId.application_id, encoding: encoding.encoding };
}

export function requireMatchingSnapshot(actual: DatabaseSnapshot, expected: DatabaseSnapshot): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    // Do not include mood contents or key material in errors or logs.
    throw new Error("Database conversion did not preserve all stored data. The original was retained.");
  }
}
