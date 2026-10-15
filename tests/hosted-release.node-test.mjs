import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { readHostedReservation } from '../scripts/hosted-release.mjs';
import { releaseChildEnvironment } from '../scripts/release-environment.mjs';

const source = readFileSync(new URL('../scripts/nightly-release.mjs', import.meta.url), 'utf8');
const environmentSource = readFileSync(new URL('../scripts/release-environment.mjs', import.meta.url), 'utf8');
const resourceSource = environmentSource.slice(environmentSource.indexOf('export function checkReleaseResources('), environmentSource.indexOf('export function preflightBuild(')).replace('export ', '');
const functionSource = source.slice(source.indexOf('async function buildRelease()'), source.indexOf('\ntry {\n  if (command'));

// Execute the complete runner lifecycle with all external effects replaced.
async function release({ hosted = false, checkFailure, reservationFailure, verifyFailure, uploadFailure, diskAfterInstallGiB = 16, memoryGiB = 8, skip = false } = {}) {
  const calls = [];
  const records = [];
  let diskGiB = 16;
  const checkReleaseResources = runInNewContext(`(${resourceSource})`, {
    statfsSync(path) { calls.push(['resources', path, diskGiB]); return { bavail: diskGiB * 1024 ** 3, bsize: 1 }; },
    totalmem: () => memoryGiB * 1024 ** 3,
  });
  const receiptDirectory = mkdtempSync(join(tmpdir(), 'hosted-build-receipt-'));
  writeFileSync(join(receiptDirectory, 'reservation.json'), JSON.stringify({ build: true, id: 'reservation', sha: 'a'.repeat(40), version: '0.1.6', versionCode: 41 }));
  const context = {
    command: hosted ? 'build' : 'run', app: 'moodinator', root: '/checkout', join, resolve,
    process: { env: { GITHUB_ACTIONS: 'true', EXPO_TOKEN: 'fixture', RELEASE_ARTIFACTS_DIR: receiptDirectory, RELEASE_CHECKED_SHA: 'a'.repeat(40) } },
    homedir: () => '/home', tmpdir: () => '/tmp', mkdtempSync: () => '/temporary',
    console: { log() {} },
    run(program, args, cwd) {
      calls.push([program, ...Array.from(args), cwd]);
      if (program === 'git' && args[0] === 'rev-parse') return 'a'.repeat(40);
      if (program === 'git' && args[0] === 'show') return '{"cli":{"version":">= 20.5.1"}}';
      if (program === 'pnpm' && args[0] === 'install') diskGiB = diskAfterInstallGiB;
      if (program === 'pnpm' && args[1] === 'verify' && checkFailure) throw new Error('Checks failed');
    },
    readHostedReservation,
    preflightBuild(root, env) { checkReleaseResources(root); return env; },
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
  finally { rmSync(receiptDirectory, { recursive: true, force: true }); }
  return { calls, records, error };
}

test('fetched main checks pass before reserve; verified copies precede Internal upload', async () => {
  const { calls, error } = await release();
  assert.equal(error, undefined);
  assert.ok(calls.some(([program, command, ref]) => program === 'git' && command === 'show' && ref === `${'a'.repeat(40)}:eas.json`));
  const check = calls.findIndex(([program, command, name]) => program === 'pnpm' && command === 'run' && name === 'test:nightly');
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
  const lastCheck = calls.findIndex(([program, command, name]) => program === 'pnpm' && command === 'run' && name === 'test:nightly');
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

test('hosted build uses its checked persisted identity without project checks, ledger auth, or Play upload', async () => {
  const { calls, records, error } = await release({ hosted: true });
  assert.equal(error, undefined);
  assert.equal(calls.some(([kind]) => ['pnpm', 'ledger', 'upload'].includes(kind)), false);
  assert.equal(records.at(-1).status, 'built');
  assert.equal(records.at(-1).sha, 'a'.repeat(40));
  assert.equal(calls.filter(([kind]) => kind === 'eas').length, 2);
});

test('actual dependency and EAS child calls receive only their operation credentials', async () => {
  const env = { PATH: '/bin', HOME: '/home', EXPO_TOKEN: 'expo', GITHUB_TOKEN: 'github', GH_TOKEN: 'gh', PLAY_SERVICE_ACCOUNT_JSON: 'play', PLAY_SERVICE_ACCOUNT_KEY_PATH: '/key' };
  const captured = [];
  const runSource = source.slice(source.indexOf('function run('), source.indexOf('async function runEas('));
  const run = runInNewContext(`(${runSource})`, {
    root: '/checkout', process: { env },
    releaseChildEnvironment: (operation) => releaseChildEnvironment(operation, env),
    spawnSync(program, args, options) { captured.push(options.env); return { status: 0, stdout: '' }; },
  });
  run('pnpm', ['install', '--frozen-lockfile']);
  run('pnpm', ['run', 'verify']);
  run('pnpm', ['run', 'test:nightly']);
  const easSource = source.slice(source.indexOf('async function runEas('), source.indexOf('function ledger('));
  const runEas = runInNewContext(`(${easSource})`, {
    eas: 'eas', process: { env }, releaseChildEnvironment: (operation) => releaseChildEnvironment(operation, env),
    openSync: () => 1, closeSync() {}, setInterval: () => 1, clearInterval() {},
    spawn(program, args, options) { captured.push(options.env); return { once(event, callback) { if (event === 'close') callback(0); } }; },
  });
  await runEas(['build'], '/checkout', '/private-log');
  assert.deepEqual(captured.slice(0, 3), Array.from({ length: 3 }, () => ({ PATH: '/bin', HOME: '/home' })));
  assert.deepEqual(captured[3], { PATH: '/bin', HOME: '/home', EXPO_TOKEN: 'expo' });
});
