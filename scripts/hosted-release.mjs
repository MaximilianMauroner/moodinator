#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as environment from './release-environment.mjs';
import { preparePlayKey } from './prepare-hosted-release.mjs';
import { releaseIdentity } from './stamp-nightly-version.mjs';
import { verifyReleaseArtifacts } from './verify-release-artifacts.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const repository = 'https://github.com/MaximilianMauroner/moodinator.git';

function commandEnvironment(env, github = false) {
  const child = {};
  for (const name of ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'TMP', 'TEMP', 'SYSTEMROOT']) {
    if (env[name] !== undefined) child[name] = env[name];
  }
  if (github) for (const name of ['GH_TOKEN', 'GITHUB_TOKEN']) {
    if (env[name]) child[name] = env[name];
  }
  return child;
}

function toolEnvironment(env) {
  const child = commandEnvironment(env);
  for (const name of ['ANDROID_HOME', 'ANDROID_SDK_ROOT', 'ANDROID_BUNDLETOOL_JAR', 'JAVA_HOME', 'EAS_BIN']) {
    if (env[name] !== undefined) child[name] = env[name];
  }
  return child;
}

function git(args, env) {
  const result = spawnSync('git', args, { cwd: root, env: commandEnvironment(env), encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error('Release source check failed');
  return result.stdout.trim();
}

export function callHostedLedger(action, args, env = process.env, spawn = spawnSync) {
  const result = spawn('python3', [join(root, 'scripts/nightly-ledger.py'), 'moodinator', action, ...args], {
    cwd: root, env: commandEnvironment(env, true), encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Ledger persistence failed; reconcile before another release');
  try {
    const response = JSON.parse(result.stdout);
    if (action === 'reserve' ? typeof response.build !== 'boolean' : response.finished !== true || response.status !== args[1]) throw new Error();
    return response;
  }
  catch { throw new Error('Ledger persistence unconfirmed; reconcile before another release'); }
}

function artifactsDirectory(env) {
  if (!env.RELEASE_ARTIFACTS_DIR || !isAbsolute(env.RELEASE_ARTIFACTS_DIR)) throw new Error('RELEASE_ARTIFACTS_DIR must be an absolute path');
  return env.RELEASE_ARTIFACTS_DIR;
}

function checkedSha(env) {
  if (!/^[0-9a-f]{40}$/.test(env.RELEASE_CHECKED_SHA ?? '')) throw new Error('Expected a checked full Git SHA');
  return env.RELEASE_CHECKED_SHA;
}

function reservationIdentity(reservation, sha) {
  if (reservation.build !== true || typeof reservation.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(reservation.id) ||
      reservation.sha !== sha) throw new Error('Invalid checked release reservation');
  return { build: true, id: reservation.id, sha, ...releaseIdentity(reservation.version, reservation.versionCode) };
}

export function readHostedReservation(env, actualSHA) {
  const sha = checkedSha(env);
  if (sha !== actualSHA) throw new Error('Checked release SHA differs from checkout');
  let parsed;
  try { parsed = JSON.parse(env.RELEASE_RESERVATION_JSON); }
  catch { throw new Error('Invalid checked release reservation'); }
  return reservationIdentity(parsed, sha);
}

function evidence(env, record) {
  const directory = artifactsDirectory(env);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'release.json'), `${JSON.stringify({ app: 'moodinator', ...record }, null, 2)}\n`);
}

export function verifyHostedArtifacts(apk, aab, expected, app, env = process.env, spawn = spawnSync) {
  if (app !== 'moodinator') throw new Error('Invalid artifact app');
  const result = spawn(process.execPath, [fileURLToPath(import.meta.url), 'verify', apk, aab, JSON.stringify(expected)], {
    cwd: root, env: toolEnvironment(env), encoding: 'utf8', timeout: 120000,
  });
  if (result.error || result.status !== 0) throw new Error('Artifact verification failed');
}

export function uploadHostedInternal(options, env = process.env, spawn = spawnSync) {
  const result = spawn(process.execPath, [join(root, 'scripts/upload-play-internal.mjs'), options.aabPath, options.version, String(options.versionCode)], {
    cwd: root, env: { ...commandEnvironment(env), PLAY_SERVICE_ACCOUNT_KEY_PATH: options.keyPath },
    encoding: 'utf8', timeout: 25 * 60000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Internal upload failed; reconcile an uncertain upload');
}

const services = {
  git,
  ledger: callHostedLedger,
  preflight: (directory, env, constraint) => environment.preflightBuild(directory, toolEnvironment(env), constraint),
  verify: verifyHostedArtifacts,
  prepareKey: preparePlayKey,
  upload: uploadHostedInternal,
  evidence,
  removeKey: (path) => rmSync(path, { force: true }),
  saveReservation(env, reservation) {
    const directory = artifactsDirectory(env);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'reservation.json'), `${JSON.stringify(reservation)}\n`);
    if (!env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
    appendFileSync(env.GITHUB_OUTPUT, `build=${reservation.build}\nreservation=${JSON.stringify(reservation)}\n`);
  },
  constraint: () => JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')).cli.version,
};

export function reserveHostedRelease(env = process.env, effects = services) {
  try {
    const sha = checkedSha(env);
    effects.git(['fetch', repository, '+refs/heads/main:refs/remotes/origin/main'], env);
    if (effects.git(['rev-parse', 'HEAD'], env) !== sha || effects.git(['rev-parse', 'origin/main'], env) !== sha) {
      throw new Error('Checked main SHA changed; rerun project checks');
    }
    effects.preflight(root, env, effects.constraint());
    const result = effects.ledger('reserve', [sha], env);
    const reservation = result.build === false ? { build: false } : reservationIdentity(result, sha);
    effects.saveReservation(env, reservation);
    return reservation;
  } catch {
    try { effects.evidence(env, { ...(/^[0-9a-f]{40}$/.test(env.RELEASE_CHECKED_SHA ?? '') ? { sha: env.RELEASE_CHECKED_SHA } : {}), status: 'failed', failure: { stage: 'preflight', message: 'Hosted preflight or reservation failed; reconcile uncertain ledger writes' } }); }
    catch { /* Failure evidence must not hide an uncertain reservation. */ }
    throw new Error('Hosted preflight or reservation failed; reconcile uncertain ledger writes');
  }
}

export async function publishHostedRelease(env = process.env, effects = services) {
  let reservation;
  try {
    const parsed = JSON.parse(env.RELEASE_RESERVATION_JSON);
    if (parsed.build === false) return;
    reservation = readHostedReservation(env, effects.git(['rev-parse', 'HEAD'], env));
    if (!['success', 'failure'].includes(env.RELEASE_BUILD_RESULT)) throw new Error();
  } catch { throw new Error('Invalid publish source, reservation, or build result; reconcile active ledger'); }
  let outcome = 'failed';
  let stage = 'build';
  let keyPath;
  const errors = [];
  try {
    if (env.RELEASE_BUILD_RESULT === 'success') {
      const directory = join(artifactsDirectory(env), 'verified');
      const apk = join(directory, `moodinator-${reservation.version}.apk`);
      const aab = join(directory, `moodinator-${reservation.version}.aab`);
      stage = 'artifact-verify';
      effects.verify(apk, aab, { package: 'com.lab4code.moodinator', version: reservation.version, versionCode: reservation.versionCode }, 'moodinator', env);
      stage = 'play-upload';
      keyPath = effects.prepareKey(env);
      await effects.upload({ app: 'moodinator', aabPath: aab, version: reservation.version, versionCode: reservation.versionCode, keyPath }, env);
      outcome = 'succeeded';
    }
  } catch {
    errors.push(`Hosted release failed during ${stage}`);
  } finally {
    if (keyPath) {
      try { effects.removeKey(keyPath); }
      catch { errors.push('Play key cleanup failed'); }
    }
    try {
      effects.evidence(env, { ...reservation, status: outcome, ...(outcome === 'failed' ? { failure: { stage, message: `Hosted release failed during ${stage}` } } : {}) });
    } catch { errors.push('Release evidence write failed'); }
    try { effects.ledger('finish', [reservation.id, outcome], env); }
    catch { errors.push('Ledger finish unconfirmed; reconcile before another release'); }
  }
  if (errors.length) throw new Error(errors.join('; '));
  return { status: outcome };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'reserve') reserveHostedRelease();
    else if (process.argv[2] === 'publish') await publishHostedRelease();
    else if (process.argv[2] === 'verify') {
      const [apk, aab, encoded] = process.argv.slice(3);
      const expected = JSON.parse(encoded);
      releaseIdentity(expected.version, expected.versionCode);
      if (expected.package !== 'com.lab4code.moodinator') throw new Error('Invalid artifact package');
      verifyReleaseArtifacts(apk, aab, expected, 'moodinator');
    }
    else throw new Error('Expected reserve or publish');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
