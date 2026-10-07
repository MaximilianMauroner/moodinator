import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../scripts/nightly-release.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  } finally {\n    // Record the attempt');
const end = source.indexOf('\n}\n\ntry {', start);
assert.ok(start >= 0 && end > start, 'release finalization block must exist');
const finalization = source.slice(start + '  } '.length, end);

// Execute the runner's actual finalization code with every side effect mocked.
// No release checks, builds, uploads, filesystem writes, or ledger calls run.
function finalize({ outcome = 'failed', releaseError, evidenceError, ledgerError } = {}) {
  const calls = [];
  const context = {
    hosted: false, output: '/mock-output', app: 'moodinator', sha: 'a'.repeat(40), reservation: { id: 'mock-reservation', build: true }, outcome,
    failure: outcome === 'failed' ? { stage: 'checks' } : undefined, releaseError,
    worktreeAdded: true, sourceRoot: '/mock-source', temporary: '/mock-temporary', join,
    mkdirSync() {},
    writeFileSync(path, value) {
      calls.push(['evidence', path, JSON.parse(value)]);
      if (evidenceError) throw evidenceError;
    },
    ledger(action, args) {
      calls.push(['ledger', action, Array.from(args)]);
      if (ledgerError) throw ledgerError;
    },
    run(...args) { calls.push(['cleanup-worktree', ...args]); },
    rmSync(...args) { calls.push(['cleanup-temporary', ...args]); },
  };
  const execute = runInNewContext(`(function () {
    try { if (releaseError) throw releaseError; }
    ${finalization}
  })`, context);
  let error;
  try { execute(); } catch (caught) { error = caught; }
  assert.deepEqual(calls.filter(([kind]) => kind === 'ledger'), [
    ['ledger', 'finish', ['mock-reservation', outcome]],
  ]);
  assert.deepEqual(calls.slice(-2).map(([kind]) => kind), ['cleanup-worktree', 'cleanup-temporary']);
  return { error, calls };
}

for (const outcome of ['failed', 'succeeded']) {
  test(`evidence write failure still finalizes a ${outcome} reservation and cleans up`, () => {
    const evidenceError = new Error('EACCES: release.json');
    const result = finalize({ outcome, evidenceError });
    assert.equal(result.error, evidenceError);
    assert.equal(result.calls[0][2].status, outcome);
  });
}

test('evidence and ledger failures retain both errors and still clean up', () => {
  const evidenceError = new Error('ENOSPC: release.json');
  const ledgerError = new Error('GitHub ledger unavailable');
  const { error } = finalize({ evidenceError, ledgerError });
  assert.deepEqual(Array.from(error.errors), [evidenceError, ledgerError]);
  assert.match(error.message, /ENOSPC: release.json; GitHub ledger unavailable/);
});

test('finalization failure retains the original release error', () => {
  const releaseError = new Error('Build failed; inspect private log');
  const evidenceError = new Error('EACCES: release.json');
  const { error } = finalize({ releaseError, evidenceError });
  assert.deepEqual(Array.from(error.errors), [releaseError, evidenceError]);
  assert.match(error.message, /Build failed; inspect private log; EACCES: release.json/);
});

test('normal finalization preserves release success and the original build failure', () => {
  assert.equal(finalize({ outcome: 'succeeded' }).error, undefined);
  const releaseError = new Error('Build failed; inspect private log');
  assert.equal(finalize({ releaseError }).error, releaseError);
});
