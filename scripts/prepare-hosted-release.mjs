import { writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export function prepareHostedRelease(env = process.env) {
  if (!env.EXPO_TOKEN?.trim()) throw new Error('EXPO_TOKEN is required');
  if (!env.PLAY_SERVICE_ACCOUNT_JSON?.trim()) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is required');
  if (!env.PLAY_SERVICE_ACCOUNT_KEY_PATH || !isAbsolute(env.PLAY_SERVICE_ACCOUNT_KEY_PATH)) {
    throw new Error('PLAY_SERVICE_ACCOUNT_KEY_PATH must be an absolute path');
  }
  let key;
  try {
    key = JSON.parse(env.PLAY_SERVICE_ACCOUNT_JSON);
    if (key.type !== 'service_account' || !key.client_email || !key.private_key) throw new Error();
  } catch {
    throw new Error('Expected a Play service-account JSON key');
  }
  // Exclusive creation prevents following an existing path; do not print key data.
  writeFileSync(env.PLAY_SERVICE_ACCOUNT_KEY_PATH, env.PLAY_SERVICE_ACCOUNT_JSON, { mode: 0o600, flag: 'wx' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { prepareHostedRelease(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
