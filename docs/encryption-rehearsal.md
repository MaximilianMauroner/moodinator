# Encryption rehearsal and deferred C2 design

This rehearsal uses fabricated records in a fresh temporary directory. It does
not open the app database, use SecureStore, change app configuration, or run an
app migration. C2 remains deferred under [issue 45](https://github.com/MaximilianMauroner/moodinator/issues/45).
The issue corrections and the current authorization supersede the rekey and
parameter-binding proposals still shown in the linked September Microplan.

## Run the isolated rehearsal

The caller is a maintainer running `runRehearsal({ mode })`, not app startup.
The runner owns the temporary workspace and fabricated keys; each database
operation owns and closes its connection. The dependency direction is runner
to engine/filesystem and fixture. It has no app/service imports. Any verification
failure stops replacement; recovery failure leaves all surviving files intact.

Alternatives considered: an Expo app-integrated rehearsal could exercise the
bridge, but would share bootstrap/handle lifecycle and risk enabling the wrong
configuration before isolation was proven. A separate mobile harness is the
required next native layer. A Node cipher mock could run now but would give no
encryption evidence. The selected standalone runner provides real filesystem
and SQLite recovery checks now, with an explicit optional host SQLCipher boundary.
It does not substitute for that next mobile layer.

Use Node 24.13.1 or newer within major 24, as required by the project:

```sh
node scripts/encryption-rehearsal.mjs
node --test tests/encryption-rehearsal.node-test.mjs
```

The default `synthetic` engine uses real Node SQLite and real filesystem
operations. It copies plaintext; it does not implement or mock SQLCipher. It
reports native encryption and mobile acceptance as **blocked**. No input database
path is accepted. All records come from the checked-in fixture. The generated
workspace is removed after the run. JSON output can be retained as test evidence.

With an independently provisioned SQLCipher CLI on PATH:

```sh
node scripts/encryption-rehearsal.mjs --engine sqlcipher
```

This mode requires `PRAGMA cipher_version` and a CLI with `-json` and `-readonly`
support. It never falls back to ordinary SQLite. The CLI receives fabricated
keys through stdin, not command arguments or files. It exports a plaintext copy
through `ATTACH ... KEY` and `sqlcipher_export`, sets `user_version` and
`application_id` explicitly, and closes the connection before verification.
Encrypted verification checks cipher integrity, failure to read schema with a
wrong key or no key, and an encrypted-to-plaintext export roundtrip. Host CLI
success is not evidence for the Expo bridge or an Android upgrade.

## Replacement and recovery

The fixture includes current mood fields, retained legacy attachment columns,
legacy scale metadata, recorded UTC offsets, entry references, nullable values,
emotions and junction rows, indexes, a view, a trigger, an empty table, BLOBs,
int64 values and an AUTOINCREMENT sequence above the maximum current ID. The
verifier compares schema, typed values in every table, sequence state, encoding,
`user_version`, `application_id`, `integrity_check` and `foreign_key_check`.

| Phase after which the child process exits | Files available for reopen |
| --- | --- |
| Plaintext copy closed | Original active file and separate copy |
| Separate target exported and closed | Original active file, copy and unverified target |
| Target verified and roundtrip checked | Original active file and verified target |
| Original renamed | Preserved original and verified target |
| Target promoted | Preserved original and active target |
| Active target reopened and verified | Preserved original and verified active target |

Each case starts with a new fixture. A child process exits without cleanup at
the selected boundary. Recovery runs in the parent through new connections. It
accepts the active file only after complete verification; otherwise it opens the
preserved plaintext original. It does not trust a phase marker, overwrite an
original, or promote an unverified target. Recovery runs twice. The original
must remain byte-identical. No original deletion phase exists in this slice.

The synthetic engine cannot distinguish an encrypted file from a plaintext file.
Its `verified-active` result means schema/content verification only. Tests also
cover truncated files, changed content/metadata, broken foreign keys, missing
indexes, changed sequences and failure when no intact copy remains.

These are abrupt process-exit boundaries on the host filesystem. They do not
prove mobile rename durability, power-loss safety, interruption during a native
export call, concurrent writers, available disk space, or key persistence. The
fixture is closed and has no WAL sidecars. A real copied database must first be
quiesced and checkpointed, with all native statements finalized and handles
closed; copying only the main file of a live WAL database is unsafe.

## Native proof gate

Capability audit on 2026-10-08:

- Linux x86_64 host; Node 24.21.0 and Bun 1.4.2.
- No `sqlcipher` executable on PATH and no discoverable SQLCipher shared library.
- Android SDK exists outside PATH at `/home/codex/android-sdk`, with platform 36,
  build tools 35/36, ADB 37.0.1 and emulator tooling. SDK presence does not prove
  a compatible SQLCipher build or an authorized device session.
- No Xcode on this Linux host. No device action, native build, install or launch
  was performed. The current authorization excludes device actions and paid builds.
- Locked installed sources: `expo-sqlite` 55.0.20 and `expo-crypto` 55.0.19.
  SQLCipher's header explicitly requires attached-database export for plaintext
  conversion. Expo SQLite exposes SQL execution, but no dedicated key API.
  Expo Crypto exposes AES-GCM/AAD, but no PBKDF2, scrypt or Argon2 API.

To close the native gate, Max must provide or authorize an isolated SQLCipher
runtime and an unsigned disposable Expo Android rehearsal build with SQLCipher
enabled only in that separate harness. It must have a separate app identifier,
storage and entry point, with no imports of the normal `db/client.ts` or bootstrap.
Authorize a disposable emulator session explicitly. No credentials, personal
device, personal records or production database are needed.

Capture runtime/build versions and actual results for the same fixture and
replacement phases. Also interrupt inside export, verification and replacement
calls; test WAL checkpoint/close, disk exhaustion, lost/wrong keys, pending Expo
statements and reopen after process kill. Retain the original until recovery has
been verified. Prove install/start and a fabricated pre-change upgrade. Synthetic
or browser evidence cannot close these requirements.

## Future migration integration, subject to a separate authorization

Persist and read back a fresh random 32-byte key in the native keystore before
creating a keyed target. Failure or a missing key must preserve the plaintext
original. Never generate a replacement key for an existing encrypted file.
Do not copy the current iOS plaintext-rekey assumption to Android. `PRAGMA key=?`
and `key(?)` are syntax errors; use a separately reviewed native key API or the
validated fixed-shape raw hex literal shown in this rehearsal. Ordinary paths
and values should use supported bindings. No user passphrase enters SQL.

Run conversion before publishing the normal database handle or mounting readers,
reminder writes, bootstrap and background backups. Close all handles before any
rename. Serialize against the write queue, retain the original and identify
recovery candidates from verified contents and key state. Do not downgrade an
unreadable encrypted database to a new empty plaintext database.

Preserve [the synchronization contract introduced by PR 114](mood-data-synchronization.md).
An eventual authorized migration must invalidate service/store query resources
only after a confirmed database replacement, reject stale reads from the previous
handle, and avoid publishing partial success. The rehearsal imports none of those
app modules and changes no live synchronization behavior. Native handle lifecycle
issue 113 remains a separate dependency for integration.

## Encrypted export design, deferred

Do not add a passphrase field until a supported password KDF has been selected,
independently reviewed and measured on Android/iOS. Candidate implementations
must supply PBKDF2-HMAC-SHA-256, scrypt or Argon2id with known-answer tests, random
salt and bounded work parameters. A single digest of a password is insufficient.
No KDF or encrypted export implementation is selected by this PR.

Use a versioned envelope with a fixed magic value, format version, KDF identifier
and parameters, salt, cipher identifier, nonce, ciphertext and authentication
tag. Specify a canonical byte encoding for the header and authenticate those
exact bytes as AES-GCM AAD. Propose a 32-byte derived key, fresh salt of at least
16 bytes, a fresh 12-byte nonce and 16-byte tag. Confirm these through independent
review before freezing the format. Specify UTF-8 password handling without silent
normalization. Store no password or derived key. Keep the optional encrypted
format distinct from existing plaintext JSON backups; do not silently change
automatic backups or therapy exports.

Before running a KDF, reject unsupported versions, unknown algorithms, invalid
lengths and parameters outside hard memory/time/input bounds. Authenticate before
parsing or importing decrypted data. Wrong password, truncation and tampering
must fail without changing the database. Reuse existing import validation and
transaction behavior after authentication; publish synchronization invalidation
only after commit. Native known-answer, roundtrip and tamper tests, plus product
review of recovery limits, are required before any export rollout.

Production encryption/export changes also require the four root/in-app legal
documents, matching Last Updated dates and legal parity tests to move together.
The current plaintext disclosures remain accurate. No compatibility code is
added to the app by this rehearsal. Retained fixture columns represent stored
legacy data that a future migration must preserve, not a restored attachment feature.
