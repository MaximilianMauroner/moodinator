export function validateRawKey(key: unknown): string {
  if (typeof key !== "string" || !/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error("The stored database key is missing or invalid. Existing files were retained.");
  }
  return key;
}

// PRAGMA key does not support prepared parameters. This SQL shape accepts only
// 32 bytes of validated raw hex, never a password or arbitrary input.
export function rawKeyPragma(key: string): string {
  return `PRAGMA key = "x'${validateRawKey(key)}'";`;
}

export function legacyKeyPragma(key: string): string {
  // V1 stored bare hex as a passphrase. Adding x'...' would reinterpret it and
  // make already encrypted iOS databases unreadable.
  return `PRAGMA key = '${validateRawKey(key)}';`;
}

export function requireCipherVersion(version: unknown): string {
  const match = typeof version === "string"
    ? /^(\d+)\.(\d+)\.(\d+)(?: [a-z]+)?$/i.exec(version) : null;
  if (!match || match[0] !== version) {
    throw new Error("A supported native SQLCipher runtime is required to open mood data.");
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)
    || !(major > 4 || (major === 4 && minor >= 2))) {
    throw new Error("SQLCipher 4.2.0 or newer is required for cipher integrity verification.");
  }
  return match[0];
}
