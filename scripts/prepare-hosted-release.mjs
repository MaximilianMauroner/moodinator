import { closeSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

function playKey(env) {
  if (!env.PLAY_SERVICE_ACCOUNT_JSON?.trim()) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is required');
  try {
    const key = JSON.parse(env.PLAY_SERVICE_ACCOUNT_JSON);
    if (key.type !== 'service_account' || typeof key.client_email !== 'string' || !key.client_email ||
        typeof key.private_key !== 'string' || !key.private_key) throw new Error();
  } catch {
    throw new Error('Expected a Play service-account JSON key');
  }
}

export function validateHostedSecrets(env = process.env) {
  if (!env.EXPO_TOKEN?.trim()) throw new Error('EXPO_TOKEN is required');
  playKey(env);
}

export function preparePlayKey(env = process.env) {
  playKey(env);
  if (!env.PLAY_SERVICE_ACCOUNT_KEY_PATH || !isAbsolute(env.PLAY_SERVICE_ACCOUNT_KEY_PATH)) {
    throw new Error('PLAY_SERVICE_ACCOUNT_KEY_PATH must be an absolute path');
  }
  // Exclusive creation prevents following an existing path; do not print key data.
  const path = env.PLAY_SERVICE_ACCOUNT_KEY_PATH;
  const descriptor = openSync(path, 'wx', 0o600);
  try { writeFileSync(descriptor, env.PLAY_SERVICE_ACCOUNT_JSON); }
  catch (error) { rmSync(path, { force: true }); throw error; }
  finally { closeSync(descriptor); }
  return path;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] ?? 'validate';
    if (command === 'validate') validateHostedSecrets();
    else if (command === 'play-key') preparePlayKey();
    else throw new Error('Expected validate or play-key');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
