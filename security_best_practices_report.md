# Security Best Practices Report

## Executive Summary

This project is a TypeScript Expo/React Native app that stores highly sensitive mood/mental-health data locally. The most important findings are in the new app-lock and backup/privacy paths: the PIN is protected with a custom non-cryptographic hash, PIN attempts are not rate-limited, and backups/exports are written as plaintext JSON with an iOS configuration that enables document file sharing.

The skill did not include Expo/React Native-specific reference documents, so this review uses the provided general JavaScript/TypeScript security guidance plus mobile security best practices for local-secret handling and sensitive-data storage.

## Scope / Evidence

- Language: TypeScript
- Frameworks: Expo, React Native, Zustand, Expo Secure Store, Expo SQLite
- Sensitive areas reviewed: app lock, local database setup, export/backup flows, iOS sharing configuration

## High Severity

### H-001: App-lock PIN uses a custom unsalted hash instead of a password KDF

- Impact: Anyone who can extract the stored PIN value (e.g., from a compromised device backup / app state extraction) can brute-force 4-digit or 6-digit PINs quickly because the stored value is only a simple deterministic hash.
- Evidence:
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/src/features/appLock/store/appLockStore.ts:12-22`
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/src/features/appLock/store/appLockStore.ts:110-122`
- Why this matters:
  - The code uses a small custom integer hash with no salt and no work factor, which is not suitable for protecting authentication secrets.
  - PINs are low-entropy by design, so secure handling should rely on a slow KDF (or OS-auth-protected key derivation / secure enclave-backed flow), not simple obfuscation.
- Recommended fix:
  - Replace the custom hash with a standard password hashing/KDF approach (e.g., Argon2id, scrypt, PBKDF2 with strong parameters and per-user random salt), or use a platform-native secure credential mechanism if available.
  - Store the salt + derived hash (or wrapped key) in `SecureStore`.

### H-002: App-lock PIN verification has no rate limiting or lockout enforcement

- Impact: The app-lock PIN can be brute-forced on-device because failed attempts are only counted for display and never trigger a cooldown, exponential backoff, or lockout.
- Evidence:
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/src/features/appLock/screens/LockScreen.tsx:93-106`
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/src/features/appLock/store/appLockStore.ts:131-148`
- Why this matters:
  - `failedAttempts` is incremented and displayed, but there is no enforcement path that blocks further input after repeated failures.
  - Failed attempt count is reset on lock/unlock, which prevents persistent throttling across app state transitions.
- Recommended fix:
  - Add enforced backoff (e.g., 5 failures => cooldown, then exponential delays).
  - Persist lockout state / next-allowed-at timestamp in secure storage (or at least persistent storage) so it survives app restarts/backgrounding.
  - Consider a “biometric only / system auth required after N failed attempts” fallback.

### H-003: SQLCipher is enabled in config, but no database key is applied at runtime

- Impact: The app may appear to be using encrypted SQLite while actually opening the database without a SQLCipher key, leaving mood data unencrypted at rest.
- Evidence:
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/app.json:64-71` (`useSQLCipher: true`)
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/db/client.ts:5-13` (opens database without key setup)
- Why this matters:
  - Enabling SQLCipher in build config only compiles SQLCipher support; it does not automatically encrypt the database without applying a key.
  - This creates a false sense of protection for extremely sensitive local data.
- Recommended fix:
  - Generate and store a random DB encryption key in `SecureStore`.
  - Apply the SQLCipher key immediately after opening the DB (before normal queries/migrations).
  - Add a startup integrity check to detect unkeyed/plaintext DBs and migrate safely.

## Medium Severity

### M-001: Backups are plaintext JSON in `documentDirectory` while iOS file sharing is enabled

- Evidence:
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/db/backup.ts:16` (default backup path is `documentDirectory`)
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/db/backup.ts:143-170`
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/db/backup.ts:209-215`
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/db/moods/importExport.ts:23-34` (export contains emotions/context/notes)
  - `/Users/maximilianmauroner/Documents/GitHub/moodinator/app.json:19-20` (`UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`)
- Why this matters:
  - Backups include sensitive mental-health notes/emotions as plaintext JSON.
  - The default iOS backup location is the app Documents directory, and the app explicitly enables iOS file sharing / opening in place, increasing exposure to local extraction via Finder/iTunes-style access.
- Recommended fix:
  - Store automatic backups in a less user-exposed location (e.g., Application Support) unless explicit user export is requested.
  - Encrypt backup payloads (password-based or device-key-based) before writing them.
  - If file sharing is not a product requirement, disable `UIFileSharingEnabled` / `LSSupportsOpeningDocumentsInPlace`; otherwise document the privacy tradeoff in-app and add opt-in controls.

## Suggested Remediation Order

1. H-001 (PIN hashing) and H-002 (PIN throttling/lockout) because they directly affect the new app-lock feature’s effectiveness.
2. H-003 (SQLCipher keying) to ensure local at-rest protection matches the intended configuration.
3. M-001 (backup storage/sharing exposure) to reduce accidental disclosure of exported/backup mood data.

## Notes

- This report focuses on the highest-impact security issues visible in the reviewed code paths and does not claim a full mobile pentest.
- If you want, the next step can be a targeted fix pass starting with H-001 (replace the custom PIN hash) or H-002 (add lockout/backoff).
