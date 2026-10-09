# Automatic first-open database encryption

The feature migrates existing mood data when the updated native app first opens.
There is no migration button or export/import step. Fresh installs create a keyed
database before normal schema writes. Later opens use the current encrypted
database and keep later writes.

`db/client.ts` shares one startup promise with all repository and background
callers. App bootstrap awaits it before mounting mood screens. Startup failures
keep screens closed and offer a retry without deleting data or creating an empty
replacement.

## Storage and recovery

`db/encryption/startup.ts` uses a stable `moodinator.encrypted-v2.db` filename.
The nonsensitive `moodinator.startup-v2.db` coordinator records versioned pending
intent before staging. An exclusive native SQLite lock, rollback journal and
`synchronous=EXTRA` serialize startup and make state commits durable.

Migration checkpoints and verifies `moodinator.db`, copies it to a separate
`moodinator.migration-copy.db`, and exports from that copy using a separately
keyed `ATTACH` and `sqlcipher_export`. It never rekeys plaintext. Verification
checks schema, all typed data including int64/NUL/BLOB values, sequences,
metadata, foreign keys, SQLite integrity, cipher integrity, encrypted header,
and wrong/keyless schema-read failure. Normal initialization uses an unpublished
handle. A keyed cold reopen must match the initialized database before completion
commits. Required source/copy cleanup completes before app access.

Pre-enforcement installs can contain orphan `mood_emotions` links after normal
deletion. Conversion retains those rows and compares the known legacy constraint
violations together with exact schema/content. Hidden SQLite rowids can change
during export and are not relationship identity. Unrelated violations remain
fatal. Published target connections enable and verify foreign-key enforcement
after export and on each keyed reopen, so new deletes cascade without creating
more orphans. This compatibility remains while supported databases can hold
those stored legacy rows; its removal requires a reviewed data-repair policy or
proof that supported stored databases no longer need it.

A positively pending attempt can rebuild staging only after source/key/runtime
verification. Completed state requires the existing V2 key and active database;
it cannot generate a replacement key or fall back to an old original after new
writes. Unknown/corrupt/missing state with recovery artifacts retains files and
fails closed. Key loss cannot be repaired by reinstalling or clearing storage.

V2 keys are random 32-byte values held in native secure storage. `PRAGMA key`
uses a validated fixed-shape raw hex literal because prepared key pragmas are
invalid. ATTACH path/key values use Expo statement bindings. Existing V1 keys
remain bare-hex passphrases during conversion; this compatibility is needed
while pre-V2 installs exist and must not be removed until those upgrades are no
longer supported.

The pnpm patch in `patches/expo-secure-store@55.0.18.patch` makes Android reject a
failed SharedPreferences commit. Readback alone can observe memory after a failed
commit. Pending startup repeats persistence and readback before conversion.
Remove this patch only when the installed Expo version propagates that failure.

Database encryption does not encrypt settings outside SQLite or plaintext
JSON/CSV exports and backups. Password-based export encryption is a separate
feature requiring a reviewed KDF and authenticated versioned envelope.

## Verification procedure

Use only fabricated data, a separate QA package and a newly owned disposable
emulator. A browser, Expo Go, Node adapter or host CLI cannot establish Expo
native acceptance. Follow the `build` skill and its coding-vm resource helper.
Build before emulator execution; do not overlap them or bypass busy admission.

The Android runner below supports Linux/x86_64 with KVM only. Its APK library
checks and emulator command do not support Android on a macOS ARM64 host.
Mac users must use [the iOS simulator procedure](./ios-encryption-check.md) for
iOS/Keychain evidence. Android ARM64 host support is a separate tooling change.

1. Run focused startup and bootstrap tests, then the required CI-equivalent
   `pnpm run verify` and `pnpm run test:nightly` under guarded admission.
2. From a clean committed checkout, run `pnpm run qa:prepare`. In its printed
   temporary workspace install locked dependencies through the build helper.
3. Set `MOODINATOR_VARIANT=qa` and `MOODINATOR_QA_ENCRYPTION_PROOF=1` for prebuild
   and build. Run the documented clean Android prebuild with
   `MOODINATOR_QA_PREPARE_NATIVE=1`, then unset that prebuild-only flag and run
   `pnpm run qa:seal-native`. Do not change copied/generated source after sealing.
   iOS uses its own native seal. Older version-3 Android seals without a platform
   field remain Android-only compatibility until old prepared workspaces retire.
4. Build the non-debuggable local QA release without release credentials, with
   one Gradle worker, one native compiler job, bounded JVM/Metro memory, no
   persistent Gradle/Kotlin daemon, and the effective 3 GiB/zero-swap group guard.
   Preserve the artifact hash, source/config evidence, native libraries, build
   exit, peak memory and cleanup result.
5. Create a fresh API35+ `moodinator-issue45` AVD in an owned `/tmp` directory,
   with KVM, two cores and 1024 MiB RAM. Ensure its selected port is unused.
   Run the evidence runner through the build helper from the sealed workspace:

   ```sh
   pnpm exec tsx scripts/run-native-encryption.mts \
     --avd-root=/tmp/owned-native-proof/avd --avd=moodinator-issue45 \
     --port=5580 --apk=/tmp/owned-native-proof/app-release.apk \
     --out=/tmp/owned-native-proof/evidence
   ```

   Set `ANDROID_HOME` to the local SDK. The runner launches/cleans only its own
   emulator, rejects an occupied serial and a non-QA/debuggable APK, checks
   source provenance, installs only `com.lab4code.moodinator.qa`, and clears
   only that owned test package's data. It verifies actual Expo SQLCipher version
   and storage factory execution, exact export/roundtrip, fresh app schema,
   later writes and cold keystore reopen, wrong/lost keys, missing/unknown state,
   missing active file with stale original, retained legacy orphan links and
   active FK enforcement, a crashed plaintext source with committed WAL data,
   independent native lock exclusion,
   abrupt Android process stops at all ten phases, repeated recovery, and actual
   `getDb` first-open/shared-handle initialization. JSON reports contain results,
   not mood contents or keys. Each crash case uses its own fixture namespace.
   The ten callbacks test phase boundaries. Do not report an interruption inside
   native export or native disk-full handling as proved by that boundary matrix;
   each needs a focused actual native failure case and retained/reopened data.
6. Inspect the native app screenshot. Complete onboarding, inspect fabricated
   history and details, add/edit/delete a new fabricated mood, and cold-open again
   to confirm retained changes. Run the existing native smoke/sync journeys to
   check the merged #114 behavior. Keep UI journey results separate from SQL proof.
7. Max runs the [local Mac handoff](ios-encryption-check.md) on a new owned iOS
   simulator. It reuses this QA fixture/proof engine for plaintext and V1
   passphrase upgrades, Keychain cold reopen and interrupted startup. iOS
   acceptance remains user-owned and unexecuted until Max returns results.
   No agent Mac access or device/settings changes are needed. Linux Android
   evidence does not establish iOS acceptance.

As an early diagnostic, the same production TypeScript state machine can run
against real SQLCipher 4.2+ CLI processes:

```sh
pnpm exec tsx scripts/verify-encryption-host.mts /absolute/path/to/sqlcipher
```

This uses fresh temporary databases and kills its own native sessions at every
phase. It does not exercise the Expo bridge, SecureStore or mobile filesystem.

## Evidence status

On 2026-10-08, 23 focused state/error tests and 23 bootstrap/layout/legal/config
tests passed, as did targeted lint. Real host SQLCipher 4.5.6 passed all 16
production-state-machine cases, including preserved legacy orphan links,
committed-WAL recovery and ten abrupt phase interruptions. Earlier foundation
native CLI proof also passed. Expo build/emulator execution and native product
journeys remain pending shared resource admission. Full feature acceptance and
activation are not established by these results. Record current-head CI,
independent source reviews, required approvals and platform acceptance separately
in issue #117 and the implementation PR.
