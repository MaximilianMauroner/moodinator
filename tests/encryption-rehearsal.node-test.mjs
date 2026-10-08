import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  createEngine, keyLiteral, PHASES, recoverFixture, runRehearsal, seedFixture, snapshot,
} from '../scripts/encryption-rehearsal.mjs';

const KEY = 'ab'.repeat(32); // Fabricated, never an app or user key.
const engine = createEngine('synthetic');

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'moodinator-recovery-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const original = path.join(root, 'original.db');
  seedFixture(original);
  return { root, original, expected: snapshot(engine, original) };
}

test('abrupt process exit at each replacement phase preserves complete fabricated data', () => {
  const report = runRehearsal();
  assert.deepEqual(report.cases.map((item) => item.interruptedAfter), [...PHASES, null]);
  assert.ok(report.cases.every((item) => item.content === 'passed' && item.original === 'preserved'));
  assert.match(report.nativeEncryption, /^blocked:/);
  assert.match(report.mobileAcceptance, /^blocked:/);
});

test('recovery ignores a truncated active file and an unverified target', (t) => {
  const { root, original, expected } = fixture(t);
  const before = readFileSync(original);
  writeFileSync(path.join(root, 'active.db'), 'interrupted file');
  writeFileSync(path.join(root, 'target.db'), 'unverified target');
  assert.deepEqual(recoverFixture(engine, root, KEY, expected), {
    file: original, outcome: 'preserved-original',
  });
  assert.deepEqual(readFileSync(original), before);
});

test('recovery rejects readable databases with changed rows or metadata', (t) => {
  const { root, original, expected } = fixture(t);
  const active = path.join(root, 'active.db');
  copyFileSync(original, active);
  engine.exec(active, null, "UPDATE moods SET note = 'lost content' WHERE id = 1;");
  assert.equal(recoverFixture(engine, root, KEY, expected).file, original);
  copyFileSync(original, active);
  engine.exec(active, null, 'PRAGMA user_version = 0;');
  assert.equal(recoverFixture(engine, root, KEY, expected).file, original);
});

test('content comparison retains text after a NUL and precise real values', (t) => {
  const { root, original, expected } = fixture(t);
  const active = path.join(root, 'active.db');
  copyFileSync(original, active);
  engine.exec(active, null, "UPDATE moods SET note = 'Fabricated NUL: ' || char(0) || 'changed' WHERE id = 5;");
  assert.notDeepEqual(snapshot(engine, active), expected);
  copyFileSync(original, active);
  engine.exec(active, null, 'UPDATE fixture_values SET real_value = 0.12500000000000003;');
  assert.notDeepEqual(snapshot(engine, active), expected);
});

test('recovery fails closed if no verified original or active file remains', (t) => {
  const { root, original, expected } = fixture(t);
  writeFileSync(original, 'damaged original');
  writeFileSync(path.join(root, 'active.db'), 'damaged active');
  const before = readFileSync(original);
  assert.throws(() => recoverFixture(engine, root, KEY, expected));
  assert.deepEqual(readFileSync(original), before);
});

test('verification detects broken foreign keys, missing indexes and changed sequence state', (t) => {
  const { root, original, expected } = fixture(t);
  const active = path.join(root, 'active.db');
  copyFileSync(original, active);
  engine.exec(active, null, 'PRAGMA foreign_keys = OFF; DELETE FROM emotions WHERE id = 1;');
  assert.throws(() => snapshot(engine, active));
  copyFileSync(original, active);
  engine.exec(active, null, 'DROP INDEX idx_moods_timestamp;');
  assert.notDeepEqual(snapshot(engine, active), expected);
  copyFileSync(original, active);
  engine.exec(active, null, "UPDATE sqlite_sequence SET seq = 4 WHERE name = 'moods';");
  assert.notDeepEqual(snapshot(engine, active), expected);
});

test('key SQL accepts only a fixed 32-byte hex shape', () => {
  assert.equal(keyLiteral(KEY), `"x'${KEY}'"`);
  for (const invalid of ['', 'ab'.repeat(31), 'ab'.repeat(33), 'zz'.repeat(32), `${KEY}'; DROP TABLE moods;--`]) {
    assert.throws(() => keyLiteral(invalid));
  }
});

test('SQLCipher mode fails rather than substituting synthetic encryption when runtime is missing', () => {
  assert.throws(() => runRehearsal({ mode: 'sqlcipher', binary: '/nonexistent/moodinator-sqlcipher' }), /SQLCipher command failed: ENOENT/);
});
