import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, renameSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const FIXTURE = new URL('./encryption-rehearsal/fixture.sql', import.meta.url);
const CRASH_EXIT = 86;
export const PHASES = [
  'copy-closed', 'export-closed', 'target-verified',
  'original-renamed', 'target-promoted', 'active-reopened',
];

const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

// PRAGMA key cannot be bound. Only a 32-byte raw key may enter this SQL shape.
export function keyLiteral(hex) {
  assert.match(hex, /^[0-9a-f]{64}$/i, 'Expected exactly 32 bytes of hex');
  return `"x'${hex}'"`;
}

export function requireCipherIntegritySupport(version) {
  const match = typeof version === 'string'
    ? /^(\d+)\.(\d+)\.(\d+)(?: [a-z]+)?$/i.exec(version) : null;
  assert.ok(match && match[0] === version, 'Malformed SQLCipher version');
  const [major, minor, patch] = match.slice(1).map(Number);
  // An unsupported PRAGMA also returns [], indistinguishable from a successful check.
  assert.ok([major, minor, patch].every(Number.isSafeInteger)
    && (major > 4 || (major === 4 && minor >= 2)),
  'SQLCipher 4.2.0 or newer required for cipher_integrity_check');
  return version;
}

export function createEngine(mode, binary = 'sqlcipher') {
  assert.ok(['synthetic', 'sqlcipher'].includes(mode), 'Unknown rehearsal engine');
  function run(file, key, sql, query = false) {
    if (key !== null) keyLiteral(key);
    assert.ok(existsSync(file), 'Refusing to create a missing database on reopen');
    if (mode === 'synthetic') {
      const db = new DatabaseSync(file, { readOnly: query });
      try {
        return query ? db.prepare(sql).all().map((row) => ({ ...row })) : db.exec(sql);
      } finally {
        db.close();
      }
    }
    // Keys go through stdin, never command arguments or a key file.
    const keySql = key === null ? '' : `PRAGMA key = ${keyLiteral(key)};`;
    const result = spawnSync(binary, ['-batch', '-json', ...(query ? ['-readonly'] : []), file], {
      input: `.bail on\n.output /dev/null\n${keySql}\n.output stdout\n${sql}\n`,
      encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const detail = String(result.error?.code ?? result.stderr)
        .replace(/[0-9a-f]{64}/gi, '<fabricated-key>').slice(0, 500);
      throw new Error(`SQLCipher command failed: ${detail}`);
    }
    return query ? JSON.parse(result.stdout.trim() || '[]') : undefined;
  }
  return {
    mode, binary,
    exec: (file, key, sql) => run(file, key, sql),
    query: (file, key, sql) => run(file, key, sql, true),
    export(file, key, target, targetKey, metadata) {
      assert.ok(!existsSync(target), 'Export target must be a new file');
      if (targetKey !== null) keyLiteral(targetKey);
      if (mode === 'synthetic') {
        // This is a plaintext filesystem rehearsal, with no simulated cipher.
        copyFileSync(file, target);
        return;
      }
      run(file, key, `
        ATTACH DATABASE ${literal(target)} AS encrypted KEY ${targetKey === null ? "''" : keyLiteral(targetKey)};
        SELECT sqlcipher_export('encrypted');
        PRAGMA encrypted.user_version = ${metadata.user_version};
        PRAGMA encrypted.application_id = ${metadata.application_id};
        DETACH DATABASE encrypted;
      `);
    },
  };
}

export function seedFixture(file) {
  assert.ok(!existsSync(file), 'Fixture must be created at a new path');
  const db = new DatabaseSync(file);
  try { db.exec(readFileSync(FIXTURE, 'utf8')); } finally { db.close(); }
}

export function snapshot(engine, file, key = null) {
  const query = (sql) => engine.query(file, key, sql);
  assert.deepEqual(query('PRAGMA integrity_check;'), [{ integrity_check: 'ok' }]);
  assert.deepEqual(query('PRAGMA foreign_key_check;'), []);
  const schema = query('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name;');
  const content = {};
  for (const table of schema.filter((row) => row.type === 'table')) {
    const columns = query(`PRAGMA table_xinfo(${identifier(table.name)});`);
    // quote(TEXT) truncates at NUL. Hex preserves all text/blob bytes; SQLite's
    // alternate float format retains enough digits to distinguish binary64 values.
    const fields = columns.map(({ name }) => {
      const column = identifier(name);
      return `typeof(${column}) || ':' || CASE typeof(${column})
        WHEN 'text' THEN hex(CAST(${column} AS BLOB))
        WHEN 'blob' THEN hex(${column})
        WHEN 'real' THEN printf('%!.26g', ${column})
        ELSE quote(${column}) END AS ${column}`;
    });
    content[table.name] = query(`SELECT ${fields.join(', ')} FROM ${identifier(table.name)};`)
      .map((row) => JSON.stringify(row)).sort();
  }
  return {
    schema, content,
    user_version: query('PRAGMA user_version;')[0].user_version,
    application_id: query('PRAGMA application_id;')[0].application_id,
    encoding: query('PRAGMA encoding;')[0].encoding,
  };
}

function verifyTarget(engine, file, key, expected) {
  assert.deepEqual(snapshot(engine, file, key), expected);
  if (engine.mode === 'synthetic') return;
  assert.deepEqual(engine.query(file, key, 'PRAGMA cipher_integrity_check;'), []);
  const schemaRead = 'SELECT count(*) AS count FROM sqlite_master;';
  const unreadable = /SQLCipher command failed:[\s\S]*(?:file is not a database|file is encrypted|SQLITE_NOTADB)/i;
  assert.throws(() => engine.query(file, null, schemaRead), unreadable);
  // Alter one byte to guarantee that the wrong key differs from the right key.
  const wrongKey = (key.startsWith('00') ? '01' : '00') + key.slice(2);
  assert.throws(() => engine.query(file, wrongKey, schemaRead), unreadable);
  assert.notEqual(readFileSync(file).subarray(0, 16).toString(), 'SQLite format 3\0');
}

function durable(file) {
  const fd = openSync(file, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function phase(root, name, stopAt) {
  durable(root);
  if (name === stopAt) process.exit(CRASH_EXIT);
}

// Only the parent creates the workspace and supplies these private worker inputs.
export function migrateFixture({ root, mode, binary, key, stopAt }) {
  const engine = createEngine(mode, binary);
  const active = path.join(root, 'active.db');
  const original = path.join(root, 'original.db');
  const copy = path.join(root, 'copy.db');
  const target = path.join(root, 'target.db');
  const expected = snapshot(engine, active);
  copyFileSync(active, copy);
  durable(copy);
  phase(root, 'copy-closed', stopAt);
  engine.export(copy, null, target, key, expected);
  durable(target);
  phase(root, 'export-closed', stopAt);
  verifyTarget(engine, target, key, expected);
  const roundtrip = path.join(root, 'roundtrip.db');
  engine.export(target, key, roundtrip, null, expected);
  assert.deepEqual(snapshot(engine, roundtrip), expected);
  phase(root, 'target-verified', stopAt);
  assert.ok(!existsSync(original), 'Original must never be overwritten');
  renameSync(active, original);
  phase(root, 'original-renamed', stopAt);
  renameSync(target, active);
  phase(root, 'target-promoted', stopAt);
  verifyTarget(engine, active, key, expected);
  phase(root, 'active-reopened', stopAt);
}

export function recoverFixture(engine, root, key, expected) {
  const active = path.join(root, 'active.db');
  if (existsSync(active)) {
    try {
      verifyTarget(engine, active, key, expected);
      return { file: active, outcome: 'verified-active' };
    } catch {
      // A failed candidate or unavailable key never authorizes deleting a file.
    }
  }
  const original = path.join(root, 'original.db');
  const fallback = existsSync(original) ? original : active;
  assert.deepEqual(snapshot(engine, fallback), expected);
  return { file: fallback, outcome: 'preserved-original' };
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function runRehearsal({ mode = 'synthetic', binary = 'sqlcipher' } = {}) {
  const engine = createEngine(mode, binary);
  const workspace = mkdtempSync(path.join(tmpdir(), 'moodinator-encryption-rehearsal-'));
  try {
    const seed = path.join(workspace, 'fabricated.db');
    seedFixture(seed);
    const expected = snapshot(engine, seed);
    const originalDigest = digest(seed);
    let cipherVersion = null;
    if (mode === 'sqlcipher') {
      const version = engine.query(seed, null, 'PRAGMA cipher_version;');
      assert.equal(version.length, 1, 'Native SQLCipher runtime required');
      cipherVersion = requireCipherIntegritySupport(version[0].cipher_version);
    }
    const cases = [];
    for (const stopAt of [...PHASES, null]) {
      const root = path.join(workspace, stopAt ?? 'complete');
      mkdirSync(root);
      copyFileSync(seed, path.join(root, 'active.db'));
      durable(path.join(root, 'active.db'));
      const key = randomBytes(32).toString('hex');
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { readFileSync } from 'node:fs';
        import { migrateFixture } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};
        migrateFixture(JSON.parse(readFileSync(0, 'utf8')));
      `], {
        input: JSON.stringify({ root, mode, binary, key, stopAt }),
        encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
      });
      assert.equal(child.error, undefined, child.error?.message);
      assert.equal(child.status, stopAt ? CRASH_EXIT : 0, child.stderr);
      const result = recoverFixture(engine, root, key, expected);
      assert.deepEqual(snapshot(engine, result.file,
        result.outcome === 'verified-active' ? key : null), expected);
      // Run recovery again to prove reopen is repeatable without marker state.
      assert.deepEqual(recoverFixture(engine, root, key, expected), result);
      const preserved = path.join(root, 'original.db');
      assert.equal(digest(existsSync(preserved) ? preserved : path.join(root, 'active.db')), originalDigest);
      assert.equal(digest(seed), originalDigest);
      cases.push({ interruptedAfter: stopAt, recovery: result.outcome, content: 'passed', original: 'preserved' });
    }
    return {
      engine: mode, cipherVersion, cases,
      nativeEncryption: mode === 'sqlcipher' ? 'passed (host CLI only)' : 'blocked: synthetic engine has no cipher',
      mobileAcceptance: 'blocked: separate Expo SQLCipher native build and disposable mobile evidence required',
    };
  } finally {
    // Only the fresh generated workspace is removed. The rehearsal takes no DB path.
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--engine'),
    'Usage: node scripts/encryption-rehearsal.mjs [--engine synthetic|sqlcipher]');
  console.log(JSON.stringify(runRehearsal({ mode: args[1] ?? 'synthetic' }), null, 2));
}
