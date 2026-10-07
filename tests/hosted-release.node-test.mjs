import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { prepareHostedRelease } from '../scripts/prepare-hosted-release.mjs';

const source = readFileSync(new URL('../scripts/nightly-release.mjs', import.meta.url), 'utf8');
const environmentSource = readFileSync(new URL('../scripts/release-environment.mjs', import.meta.url), 'utf8');
const resourceSource = environmentSource.slice(environmentSource.indexOf('export function checkReleaseResources('), environmentSource.indexOf('export function preflightRelease(')).replace('export ', '');
const functionSource = source.slice(source.indexOf('async function buildRelease()'), source.indexOf('\ntry {\n  if (command'));

// Execute the complete runner lifecycle with all external effects replaced.
async function release({ checkFailure, reservationFailure, verifyFailure, uploadFailure, diskAfterInstallGiB = 16, memoryGiB = 8, skip = false } = {}) {
  const calls = [];
  const records = [];
  let diskGiB = 16;
  const checkReleaseResources = runInNewContext(`(${resourceSource})`, {
    statfsSync(path) { calls.push(['resources', path, diskGiB]); return { bavail: diskGiB * 1024 ** 3, bsize: 1 }; },
    totalmem: () => memoryGiB * 1024 ** 3,
  });
  const context = {
    app: 'moodinator', root: '/checkout', join, resolve,
    process: { env: { GITHUB_ACTIONS: 'true', RELEASE_ARTIFACTS_DIR: '/artifacts' } },
    homedir: () => '/home', tmpdir: () => '/tmp', mkdtempSync: () => '/temporary',
    console: { log() {} },
    run(program, args, cwd) {
      calls.push([program, ...Array.from(args), cwd]);
      if (program === 'git' && args[0] === 'rev-parse') return 'a'.repeat(40);
      if (program === 'git' && args[0] === 'show') return '{"cli":{"version":">= 20.5.1"}}';
      if (program === 'bun' && args[0] === 'install') diskGiB = diskAfterInstallGiB;
      if (program === 'bun' && args[1] === 'verify' && checkFailure) throw new Error('Checks failed');
    },
    preflightRelease(root, env, version) { calls.push(['preflight', version]); checkReleaseResources(root); return env; },
    checkReleaseResources, stampRelease() {}, assertProfiles() {}, chmodSync() {}, mkdirSync() {},
    readFileSync(path) { return path.endsWith('eas.json') ? '{"cli":{}}' : '{"expo":{"android":{"package":"com.lab4code.moodinator"},"version":"0.1.6"}}'; },
    writeFileSync(path, value) { if (path.endsWith('release.json')) records.push(JSON.parse(value)); },
    ledger(action, args) {
      calls.push(['ledger', action, ...Array.from(args)]);
      if (action === 'reserve') {
        if (reservationFailure) throw new Error('Persistence uncertain');
        return skip ? { build: false } : { build: true, id: 'reservation', version: '0.1.6', versionCode: 41 };
      }
    },
    async runEas(args) { calls.push(['eas', ...Array.from(args)]); },
    verifyReleaseArtifacts() { calls.push(['verify']); if (verifyFailure) throw new Error('Wrong certificate'); },
    copyFileSync(from, to) { calls.push(['copy', to]); },
    async uploadPlayInternal() { calls.push(['upload']); if (uploadFailure) throw new Error('Ambiguous upload'); },
    releaseFailure: (stage) => ({ stage, message: 'Sanitized failure' }),
    rmSync() { calls.push(['cleanup']); },
  };
  const execute = runInNewContext(`(${functionSource})`, context);
  let error;
  try { await execute(); } catch (caught) { error = caught; }
  return { calls, records, error };
}

test('fetched main checks pass before reserve; verified copies precede Internal upload', async () => {
  const { calls, error } = await release();
  assert.equal(error, undefined);
  assert.ok(calls.some(([program, command, ref]) => program === 'git' && command === 'show' && ref === `${'a'.repeat(40)}:eas.json`));
  const check = calls.findIndex(([program, command, name]) => program === 'bun' && command === 'run' && name === 'test:nightly');
  const reserve = calls.findIndex(([program, action]) => program === 'ledger' && action === 'reserve');
  assert.ok(check < reserve);
  const resource = calls.findIndex(([kind], index) => kind === 'resources' && index > check);
  assert.ok(resource > check && resource < reserve);
  assert.equal(calls[resource][1], '/temporary/source');
  assert.equal(calls[check].at(-1), '/temporary/source');
  assert.ok(calls.findIndex(([kind]) => kind === 'verify') < calls.findIndex(([kind]) => kind === 'copy'));
  assert.ok(calls.findIndex(([kind]) => kind === 'copy') < calls.findIndex(([kind]) => kind === 'upload'));
  assert.deepEqual(calls.filter(([kind, action]) => kind === 'ledger' && action === 'finish'), [['ledger', 'finish', 'reservation', 'succeeded']]);
});

test('disk lost to dependencies stops before reservation on the source filesystem', async () => {
  const { calls, records, error } = await release({ diskAfterInstallGiB: 14 });
  assert.match(error.message, /at least 15 GiB free disk space/);
  const lastCheck = calls.findIndex(([program, command, name]) => program === 'bun' && command === 'run' && name === 'test:nightly');
  const denied = calls.findIndex(([kind, path, disk]) => kind === 'resources' && path === '/temporary/source' && disk === 14);
  assert.ok(lastCheck >= 0 && denied > lastCheck);
  assert.equal(calls.some(([kind]) => ['ledger', 'eas', 'upload'].includes(kind)), false);
  assert.equal(records.at(-1).versionCode, undefined);
  assert.equal(records.at(-1).failure.stage, 'checks');
});

test('insufficient RAM stops before ledger or builds', async () => {
  const { calls, error } = await release({ memoryGiB: 7 });
  assert.match(error.message, /at least 8 GiB RAM/);
  assert.equal(calls.some(([kind]) => ['ledger', 'eas', 'upload'].includes(kind)), false);
});

test('check failure and uncertain reservation never build or finalize an identity', async () => {
  for (const options of [{ checkFailure: true }, { reservationFailure: true }]) {
    const { calls, records, error } = await release(options);
    assert.ok(error);
    assert.equal(calls.some(([kind]) => ['eas', 'upload'].includes(kind)), false);
    assert.equal(calls.some(([kind, action]) => kind === 'ledger' && action === 'finish'), false);
    if (options.checkFailure) assert.equal(calls.some(([kind]) => kind === 'ledger'), false);
    assert.equal(records.at(-1).versionCode, undefined);
    assert.equal(calls.at(-1)[0], 'cleanup');
  }
});

test('daily/source skip does not build, write evidence or finish', async () => {
  const { calls, records, error } = await release({ skip: true });
  assert.equal(error, undefined);
  assert.equal(records.length, 0);
  assert.equal(calls.some(([kind]) => kind === 'eas'), false);
  assert.equal(calls.filter(([kind]) => kind === 'ledger').length, 1);
});

test('bad certificates are never retained or uploaded; upload failure retains verified copies', async () => {
  for (const options of [{ verifyFailure: true }, { uploadFailure: true }]) {
    const { calls, records, error } = await release(options);
    assert.ok(error);
    assert.equal(calls.filter(([kind]) => kind === 'copy').length, options.verifyFailure ? 0 : 2);
    if (options.verifyFailure) assert.equal(calls.some(([kind]) => kind === 'upload'), false);
    assert.equal(records.at(-1).status, 'failed');
    assert.deepEqual(calls.filter(([kind, action]) => kind === 'ledger' && action === 'finish'), [['ledger', 'finish', 'reservation', 'failed']]);
  }
});

test('hosted secret preparation fails without writing; valid JSON has restrictive permissions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hosted-key-'));
  const path = join(directory, 'play.json');
  const env = { GITHUB_ACTIONS: 'true', EXPO_TOKEN: 'fixture', PLAY_SERVICE_ACCOUNT_JSON: '{"type":"service_account","client_email":"test@example.com","private_key":"fixture"}', PLAY_SERVICE_ACCOUNT_KEY_PATH: path };
  try {
    for (const name of ['EXPO_TOKEN', 'PLAY_SERVICE_ACCOUNT_JSON']) assert.throws(() => prepareHostedRelease({ ...env, [name]: '' }), /required/);
    assert.throws(() => prepareHostedRelease({ ...env, PLAY_SERVICE_ACCOUNT_JSON: 'PRIVATE not JSON' }), /Expected a Play/);
    prepareHostedRelease(env);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(readFileSync(path, 'utf8'), env.PLAY_SERVICE_ACCOUNT_JSON);
    assert.throws(() => prepareHostedRelease(env), /EEXIST/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
