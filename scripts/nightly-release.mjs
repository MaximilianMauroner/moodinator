#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, closeSync, existsSync, openSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampRelease } from './stamp-nightly-version.mjs';
import { verifyReleaseArtifacts } from './verify-release-artifacts.mjs';
import { uploadPlayInternal } from './upload-play-internal.mjs';
import { checkReleaseResources, preflightRelease, releaseFailure } from './release-environment.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;
const eas = process.env.EAS_BIN || 'eas';
const command = process.argv[2] ?? 'run';

function run(program, args, cwd = root, capture = false, input) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', input,
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status}): ${capture ? result.stderr : 'see log'}`);
  return result.stdout?.trim();
}

async function runEas(args, cwd, logPath) {
  // EAS can include a credential-bearing encoded job in failure output.
  // Keep its complete output in private files, outside terminal and shared artifacts.
  const log = openSync(logPath, 'w', 0o600);
  const child = spawn(eas, args, { cwd, stdio: ['ignore', log, log] });
  const monitor = setInterval(() => {
    const result = spawnSync(process.platform === 'darwin' ? 'memory_pressure' : 'free',
      process.platform === 'darwin' ? ['-Q'] : ['-m'], { encoding: 'utf8' });
    if (result.status === 0) console.log(result.stdout.trim());
  }, 60000);
  try {
    await new Promise((accept, reject) => {
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? accept() : reject(new Error(`EAS ${args[0]} failed (${code}); private log: ${logPath}`)));
    });
  } finally {
    clearInterval(monitor);
    closeSync(log);
  }
}

function ledger(action, args = []) {
  return JSON.parse(run('python3', [join(root, 'scripts/nightly-ledger.py'), app, action, ...args], root, true));
}

function assertProfiles(sourceRoot) {
  const config = JSON.parse(readFileSync(join(sourceRoot, 'eas.json'), 'utf8'));
  for (const name of ['nightly', 'nightly-apk']) {
    if (!config.build?.[name] || config.build[name].autoIncrement !== false) {
      throw new Error(`${name} must explicitly disable autoIncrement`);
    }
  }

}

async function buildRelease() {
  run('git', ['fetch', 'origin', 'main']);
  const sha = run('git', ['rev-parse', 'origin/main'], root, true);
  let temporary;
  let sourceRoot;
  let worktreeAdded = false;
  let reservation;
  let output;
  let outcome = 'failed';
  let stage = 'preflight';
  let failure;
  let releaseError;
  try {
    const fetchedConfig = JSON.parse(run('git', ['show', `${sha}:eas.json`], root, true));
    Object.assign(process.env, preflightRelease(root, process.env, fetchedConfig.cli.version));
    temporary = mkdtempSync(join(tmpdir(), `${app}-nightly-`));
    sourceRoot = join(temporary, 'source');
    run('git', ['worktree', 'add', '--detach', sourceRoot, sha]);
    worktreeAdded = true;
    stage = 'checks';
    checkReleaseResources(sourceRoot);
    run('bun', ['install', '--frozen-lockfile'], sourceRoot);
    run('bun', ['run', 'verify'], sourceRoot);
    run('bun', ['run', 'test:nightly'], sourceRoot);
    // Dependencies and checks can reduce free disk space on the fetched source filesystem.
    checkReleaseResources(sourceRoot);
    // Checks must pass on the fetched source before consuming a release identity.
    reservation = ledger('reserve', [sha]);
    console.log(JSON.stringify({ app, ...reservation }));
    if (!reservation.build) return;
    output = resolve(process.env.RELEASE_ARTIFACTS_DIR ?? join(homedir(), 'Downloads/lab4code-releases'), app,
      `${reservation.version}-${reservation.versionCode}-${sha.slice(0, 12)}`);
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'release.json'), `${JSON.stringify(reservation, null, 2)}\n`);
    stampRelease(sourceRoot, reservation.version, reservation.versionCode);
    const easPath = join(sourceRoot, 'eas.json');
    const config = JSON.parse(readFileSync(easPath, 'utf8'));
    config.cli = { ...config.cli, appVersionSource: 'local' };
    writeFileSync(easPath, `${JSON.stringify(config, null, 2)}\n`);
    assertProfiles(sourceRoot);
    const logs = join(homedir(), '.local/state/lab4code-releases/logs', app, reservation.id);
    mkdirSync(logs, { recursive: true, mode: 0o700 });
    chmodSync(logs, 0o700);
    const apk = join(output, `${app}-${reservation.version}.apk`);
    const aab = join(output, `${app}-${reservation.version}.aab`);
    stage = 'apk-build';
    await runEas(['build', '--platform', 'android', '--profile', 'nightly-apk', '--local', '--non-interactive', '--freeze-credentials', '--output', apk], sourceRoot, join(logs, 'apk-build.log'));
    stage = 'aab-build';
    checkReleaseResources(sourceRoot);
    await runEas(['build', '--platform', 'android', '--profile', 'nightly', '--local', '--non-interactive', '--freeze-credentials', '--output', aab], sourceRoot, join(logs, 'aab-build.log'));
    stage = 'artifact-verify';
    const stamped = JSON.parse(readFileSync(join(sourceRoot, 'app.json'), 'utf8')).expo;
    verifyReleaseArtifacts(apk, aab, { package: stamped.android.package, version: reservation.version, versionCode: reservation.versionCode }, app);
    const verified = join(output, 'verified');
    mkdirSync(verified);
    copyFileSync(apk, join(verified, `${app}-${reservation.version}.apk`));
    copyFileSync(aab, join(verified, `${app}-${reservation.version}.aab`));
    stage = 'play-upload';
    await uploadPlayInternal({ app, aabPath: aab, version: reservation.version, versionCode: reservation.versionCode, keyPath: process.env.PLAY_SERVICE_ACCOUNT_KEY_PATH });
    outcome = 'succeeded';
    console.log(`Internal release ready: ${output}`);
  } catch (error) {
    failure = releaseFailure(stage);
    releaseError = error;
    throw error;
  } finally {
    // Record the attempt even when dependency installation, checks, build, or upload fails.
    // If GitHub persistence fails here, the active reservation safely blocks another upload.
    try {
      const errors = [];
      try {
        const recordDirectory = output ?? resolve(process.env.RELEASE_ARTIFACTS_DIR ?? join(homedir(), 'Downloads/lab4code-releases'), app, `preflight-${sha.slice(0, 12)}`);
        if (!reservation || reservation.build) mkdirSync(recordDirectory, { recursive: true });
        if (!reservation || reservation.build) writeFileSync(join(recordDirectory, 'release.json'), `${JSON.stringify({ app, sha, ...reservation, status: outcome, ...(failure ? { failure } : {}), finishedAt: new Date().toISOString() }, null, 2)}\n`);
      } catch (error) {
        errors.push(error);
      }
      try {
        if (reservation?.build) ledger('finish', [reservation.id, outcome]);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) {
        if (releaseError) errors.unshift(releaseError);
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, errors.map((error) => error.message).join('; '));
      }
    } finally {
      if (worktreeAdded) run('git', ['worktree', 'remove', '--force', sourceRoot]);
      if (temporary) rmSync(temporary, { recursive: true, force: true });
    }
  }
}

try {
  if (command === 'run' && process.env.NIGHTLY_HOST_LOCKED !== '1') {
    const locked = spawnSync('python3', [join(root, 'scripts/nightly-host-lock.py'), process.execPath, fileURLToPath(import.meta.url), 'run'], { stdio: 'inherit' });
    if (locked.error) throw locked.error;
    process.exitCode = locked.status ?? 1;
  } else if (command === 'run') await buildRelease();
  else if (['status', 'finish'].includes(command)) console.log(JSON.stringify(ledger(command, process.argv.slice(3)), null, 2));
  else throw new Error('Usage: node scripts/nightly-release.mjs [run|status|finish ID failed|succeeded]');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
