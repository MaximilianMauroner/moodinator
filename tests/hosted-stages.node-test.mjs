import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { callHostedLedger, publishHostedRelease, readHostedReservation, reserveHostedRelease, uploadHostedInternal, verifyHostedArtifacts } from '../scripts/hosted-release.mjs';
import { preparePlayKey, validateHostedSecrets } from '../scripts/prepare-hosted-release.mjs';

const sha = 'a'.repeat(40);
const reservation = { build: true, id: 'reservation-id', sha, version: '0.1.6', versionCode: 41 };

function fixture(overrides = {}) {
  const calls = [];
  const records = [];
  const env = { RELEASE_CHECKED_SHA: sha, RELEASE_RESERVATION_JSON: JSON.stringify(reservation),
    RELEASE_BUILD_RESULT: 'success', RELEASE_ARTIFACTS_DIR: '/artifacts', ...overrides };
  const effects = {
    git(args) { calls.push(['git', ...args]); return sha; },
    constraint: () => '>= 20.5.1',
    preflight() { calls.push(['preflight']); },
    ledger(action, args) { calls.push(['ledger', action, ...args]); return reservation; },
    saveReservation(env, result) { calls.push(['save', result]); },
    verify() { calls.push(['verify']); },
    prepareKey() { calls.push(['key']); return '/key'; },
    async upload() { calls.push(['upload']); },
    removeKey() { calls.push(['remove-key']); },
    evidence(env, record) { records.push(record); calls.push(['evidence']); },
  };
  return { env, effects, calls, records };
}

test('validated hosted secrets do not create a key; publish key is restrictive and exclusive', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hosted-stages-'));
  const path = join(directory, 'play.json');
  const env = { EXPO_TOKEN: 'fixture', PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', client_email: 'test@example.com', private_key: 'fixture' }), PLAY_SERVICE_ACCOUNT_KEY_PATH: path };
  try {
    for (const name of ['EXPO_TOKEN', 'PLAY_SERVICE_ACCOUNT_JSON']) {
      assert.throws(() => validateHostedSecrets({ ...env, [name]: '' }), /required/);
      assert.equal(existsSync(path), false);
    }
    assert.throws(() => validateHostedSecrets({ ...env, PLAY_SERVICE_ACCOUNT_JSON: 'PRIVATE invalid' }), /Expected a Play/);
    validateHostedSecrets(env);
    assert.equal(existsSync(path), false);
    const { EXPO_TOKEN, ...publishEnv } = env;
    assert.equal(preparePlayKey(publishEnv), path);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(readFileSync(path, 'utf8'), env.PLAY_SERVICE_ACCOUNT_JSON);
    assert.throws(() => preparePlayKey(publishEnv), /EEXIST/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('ledger subprocess receives GitHub authentication without Expo, Play, or injected credential paths', () => {
  let captured;
  const env = { PATH: '/bin', HOME: '/home', GH_TOKEN: 'github', EXPO_TOKEN: 'expo',
    PLAY_SERVICE_ACCOUNT_JSON: 'play', PLAY_SERVICE_ACCOUNT_KEY_PATH: '/key', NODE_OPTIONS: '--require=hostile' };
  const result = callHostedLedger('reserve', [sha], env, (program, args, options) => {
    captured = { program, args, options };
    return { status: 0, stdout: JSON.stringify(reservation) };
  });
  assert.equal(result.build, true);
  assert.equal(captured.program, 'python3');
  assert.deepEqual(captured.options.env, { PATH: '/bin', HOME: '/home', GH_TOKEN: 'github' });
  assert.deepEqual(captured.args.slice(-3), ['moodinator', 'reserve', sha]);
  assert.equal(captured.options.timeout, 60000);
});

test('artifact tools receive no credentials and uploader receives only the key path', () => {
  const env = { PATH: '/bin', GH_TOKEN: 'github', GITHUB_TOKEN: 'github2', EXPO_TOKEN: 'expo',
    PLAY_SERVICE_ACCOUNT_JSON: 'play', PLAY_SERVICE_ACCOUNT_KEY_PATH: '/ambient-key',
    ANDROID_HOME: '/sdk', ANDROID_BUNDLETOOL_JAR: '/bundletool', NODE_OPTIONS: '--require=hostile' };
  const captures = [];
  const spawn = (program, args, options) => { captures.push(options.env); return { status: 0 }; };
  verifyHostedArtifacts('/apk', '/aab', { version: '0.1.6', versionCode: 41 }, 'moodinator', env, spawn);
  uploadHostedInternal({ aabPath: '/aab', version: '0.1.6', versionCode: 41, keyPath: '/new-key' }, env, spawn);
  assert.deepEqual(captures, [
    { PATH: '/bin', ANDROID_HOME: '/sdk', ANDROID_BUNDLETOOL_JAR: '/bundletool' },
    { PATH: '/bin', PLAY_SERVICE_ACCOUNT_KEY_PATH: '/new-key' },
  ]);
});

test('ledger errors and ambiguous responses are sanitized and never retried', () => {
  for (const response of [{ status: 1, stderr: 'PRIVATE_TOKEN' }, { status: 0, stdout: 'PRIVATE invalid JSON' }]) {
    let calls = 0;
    assert.throws(() => callHostedLedger('finish', ['reservation-id', 'failed'], {}, () => { calls++; return response; }), (error) => {
      assert.match(error.message, /reconcile/);
      assert.doesNotMatch(error.message, /PRIVATE/);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('reserve requires the checked checkout and freshly fetched main before resource preflight and ledger', () => {
  const state = fixture();
  assert.deepEqual(reserveHostedRelease(state.env, state.effects), reservation);
  assert.deepEqual(state.calls[0], ['git', 'fetch', 'https://github.com/MaximilianMauroner/moodinator.git', '+refs/heads/main:refs/remotes/origin/main']);
  assert.ok(state.calls.findIndex(([kind]) => kind === 'preflight') < state.calls.findIndex(([kind]) => kind === 'ledger'));
  assert.ok(state.calls.findIndex(([kind]) => kind === 'ledger') < state.calls.findIndex(([kind]) => kind === 'save'));
  for (const mismatch of ['HEAD', 'origin/main']) {
    const rejected = fixture();
    rejected.effects.git = (args) => args[1] === mismatch ? 'b'.repeat(40) : sha;
    assert.throws(() => reserveHostedRelease(rejected.env, rejected.effects), /preflight or reservation failed/);
    assert.equal(rejected.calls.some(([kind]) => kind === 'ledger'), false);
    assert.equal(rejected.records[0].versionCode, undefined);
  }
});

test('post-install resource failure prevents reservation and emits only sanitized identity-free evidence', () => {
  const state = fixture();
  state.effects.preflight = () => { throw new Error('PRIVATE low disk'); };
  assert.throws(() => reserveHostedRelease(state.env, state.effects), /Hosted preflight/);
  assert.equal(state.calls.some(([kind]) => ['ledger', 'save'].includes(kind)), false);
  assert.equal(state.records[0].versionCode, undefined);
  assert.doesNotMatch(JSON.stringify(state.records), /PRIVATE/);
});

test('reservation persistence uncertainty does not expose a successful output', () => {
  const state = fixture();
  state.effects.ledger = () => { throw new Error('uncertain'); };
  assert.throws(() => reserveHostedRelease(state.env, state.effects), /reconcile/);
  assert.equal(state.calls.some(([kind]) => kind === 'save'), false);
});

test('shared reservation gate rejects a different checkout or identity', () => {
  const state = fixture();
  assert.deepEqual(readHostedReservation(state.env, sha), reservation);
  for (const altered of [{ sha: 'b'.repeat(40) }, { versionCode: 0 }, { id: '../path' }, { build: false }]) {
    assert.throws(() => readHostedReservation({ ...state.env, RELEASE_RESERVATION_JSON: JSON.stringify({ ...reservation, ...altered }) }, sha));
  }
  assert.throws(() => readHostedReservation(state.env, 'b'.repeat(40)));
});

test('publish verifies before key creation and cleans the key before recording a successful finish', async () => {
  const state = fixture();
  assert.deepEqual(await publishHostedRelease(state.env, state.effects), { status: 'succeeded' });
  assert.deepEqual(state.calls.filter(([kind]) => kind !== 'git').map(([kind]) => kind), ['verify', 'key', 'upload', 'remove-key', 'evidence', 'ledger']);
  assert.deepEqual(state.calls.at(-1), ['ledger', 'finish', 'reservation-id', 'succeeded']);
});

test('failed builds do not verify, create Play keys, or upload; cancellation stays active', async () => {
  const failed = fixture({ RELEASE_BUILD_RESULT: 'failure' });
  assert.deepEqual(await publishHostedRelease(failed.env, failed.effects), { status: 'failed' });
  assert.equal(failed.calls.some(([kind]) => ['verify', 'key', 'upload'].includes(kind)), false);
  assert.deepEqual(failed.calls.at(-1), ['ledger', 'finish', 'reservation-id', 'failed']);
  for (const result of ['cancelled', 'skipped']) {
    const cancelled = fixture({ RELEASE_BUILD_RESULT: result });
    await assert.rejects(publishHostedRelease(cancelled.env, cancelled.effects), /reconcile active ledger/);
    assert.equal(cancelled.calls.some(([kind]) => kind === 'ledger'), false);
  }
});

test('certificate rejection never creates a key or uploads, and finalizes failed', async () => {
  const state = fixture();
  state.effects.verify = () => { throw new Error('PRIVATE wrong certificate'); };
  await assert.rejects(publishHostedRelease(state.env, state.effects), /artifact-verify/);
  assert.equal(state.calls.some(([kind]) => ['key', 'upload'].includes(kind)), false);
  assert.deepEqual(state.calls.at(-1), ['ledger', 'finish', 'reservation-id', 'failed']);
  assert.doesNotMatch(JSON.stringify(state.records), /PRIVATE/);
});

test('upload failure removes the real key even when evidence fails; finish is still attempted once', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hosted-upload-'));
  const key = join(directory, 'play.json');
  const state = fixture({ PLAY_SERVICE_ACCOUNT_KEY_PATH: key, PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', client_email: 'test', private_key: 'test' }) });
  state.effects.prepareKey = preparePlayKey;
  state.effects.upload = async () => { assert.equal(existsSync(key), true); throw new Error('PRIVATE upload response'); };
  state.effects.removeKey = (path) => rmSync(path);
  state.effects.evidence = () => { throw new Error('disk full'); };
  try {
    await assert.rejects(publishHostedRelease(state.env, state.effects), (error) => {
      assert.match(error.message, /play-upload; Release evidence write failed/);
      assert.doesNotMatch(error.message, /PRIVATE/);
      return true;
    });
    assert.equal(existsSync(key), false);
    assert.deepEqual(state.calls.filter(([kind]) => kind === 'ledger'), [['ledger', 'finish', 'reservation-id', 'failed']]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('uncertain finish is not retried, retains sanitized evidence, and reports reconciliation', async () => {
  const state = fixture();
  let finishes = 0;
  state.effects.ledger = () => { finishes++; throw new Error('PRIVATE lost response'); };
  await assert.rejects(publishHostedRelease(state.env, state.effects), /Ledger finish unconfirmed; reconcile/);
  assert.equal(finishes, 1);
  assert.equal(state.records[0].status, 'succeeded');
  assert.doesNotMatch(JSON.stringify(state.records), /PRIVATE/);
});

test('duplicate reservation does not publish or finalize', async () => {
  const state = fixture({ RELEASE_RESERVATION_JSON: '{"build":false}' });
  assert.equal(await publishHostedRelease(state.env, state.effects), undefined);
  assert.deepEqual(state.calls, []);
});
