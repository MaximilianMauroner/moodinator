# Local Mac encryption check

Max owns this iOS simulator run. Acceptance is unexecuted until he returns its
results. This uses the same production startup, native storage factory, bundled
fabricated fixture and QA proof actions as the Android runner. It creates a new
simulator and installs only `com.lab4code.moodinator.qa`. It never selects a
physical device or an existing simulator. No personal data or signing is needed.

Use the exact reviewed PR #118 source SHA supplied with the handoff. A later
source change needs its affected evidence refreshed before accepting that build.
The pinned Expo Router patch guards its iOS 16-only action subtitle so the app
can still build for its declared iOS 15.1 minimum. Remove that patch when the
pinned upstream version includes the same availability guard.

Prerequisites are existing Xcode with an installed iOS Simulator runtime,
CocoaPods, Node 24 and pnpm 10.34.6. If one is missing, return that error; the runner
does not install runtimes, change device settings or request credentials.

## Prepare and run

Replace `REVIEWED_SHA` only with the exact SHA in the handoff. Run this in one
Terminal session. The clone, prepared source, build and evidence are disposable
and separate from any existing Moodinator checkout or app.

```sh
(
set -eu
set -o pipefail
REVIEWED_SHA=<exact-40-character-SHA-from-handoff>
MOODINATOR_IOS_WORK=$(mktemp -d /tmp/moodinator-118-ios.XXXXXX)
git clone --filter=blob:none --no-checkout https://github.com/MaximilianMauroner/moodinator.git "$MOODINATOR_IOS_WORK/source"
git -C "$MOODINATOR_IOS_WORK/source" fetch origin "$REVIEWED_SHA"
git -C "$MOODINATOR_IOS_WORK/source" checkout --detach "$REVIEWED_SHA"
cd "$MOODINATOR_IOS_WORK/source"
MOODINATOR_IOS_QA=$(node scripts/prepare-native-qa.js | sed -n 's/^QA workspace: //p')
test -n "$MOODINATOR_IOS_QA"
cd "$MOODINATOR_IOS_QA"
printf 'Disposable source: %s\nPrepared QA: %s\n' "$MOODINATOR_IOS_WORK" "$MOODINATOR_IOS_QA"
pnpm install --frozen-lockfile
export MOODINATOR_VARIANT=qa MOODINATOR_QA_ENCRYPTION_PROOF=1
export EXPO_OS=ios EAS_BUILD_PLATFORM=ios MOODINATOR_METRO_MAX_WORKERS=1
export NODE_OPTIONS=--max-old-space-size=768
MOODINATOR_QA_PREPARE_NATIVE=1 node node_modules/expo/bin/cli prebuild --platform ios --clean --no-install
(cd ios && pod install)
node scripts/seal-native-qa.js --platform=ios
pnpm exec tsx scripts/run-native-encryption-ios.mts --out="$MOODINATOR_IOS_WORK/evidence" --keep-simulator
)
```

Stop at the first failed command. Do not use `build`, release or EAS commands.
The runner builds Release for `iphonesimulator` with Xcode ad hoc signing, one Xcode
job, this Mac’s simulator architecture, the app’s iOS 15.1 minimum applied to
all pod targets, and a bundled app, so no Metro server is needed. Ad hoc signing uses no account,
certificate or development team. Xcode embeds the simulated Keychain entitlements
required by SecureStore; disabling signing leaves Keychain access unavailable.
First launches have a 60-second command limit. Xcode caches native build products
under `.expo/ios-encryption-derived-data` in the disposable QA workspace; each run
still requires a fresh evidence directory and validates the prepared source before
and after the build. It records Mac/Xcode,
source/app identity, resource samples and `/usr/bin/time` build memory in the
evidence folder. Build and simulator execution do not overlap. Only its owned
build process group receives cancellation signals. Cancellation, timeout or
failed resource monitoring fails the run even if the build exits successfully.
The runner uses only an installed runtime and a compatible iPhone profile; it
fails if compatibility cannot be established and does not install a runtime.

The iOS driver writes each one-use action URL into its owned QA container before
cold-launching the app. This avoids iOS 26 custom-scheme confirmation prompts.
The app consumes that request once; Android keeps its initial-link launch path.

The suite creates five fabricated original moods, exact int64/NUL/BLOB values,
legacy columns, links, sequences and schema objects. It verifies plaintext and
V1 passphrase conversion, exact retention/roundtrip, keyed fresh initialization,
later writes/cold Keychain reopen, wrong/keyless rejection, lost-key retention,
unknown/missing state and native lock exclusion. Separate cold actions test
committed WAL recovery and actual SIGKILL at all ten phase boundaries, followed
by two exact reopen checks. The driver resolves the QA process inside its own
simulator and verifies its executable path before signalling it. It also seeds
the actual app database and exercises shared `getDb()` first-open startup twice.

The runner also caps the attached destination's page count and requires a real
SQLCipher `SQLITE_FULL` during export. It checks byte-identical original retention,
exact data and pending state, then retries in two cold processes. This tests native
destination write capacity; it does not fill the host volume.

For inside-export interruption, an isolated source includes 64 MiB of fabricated
blobs. The runner requires an encrypted target larger than 256 KiB and smaller
than 32 MiB, plus the current export-started action identity immediately before
SIGKILL. Process ownership is resolved before polling target growth. If export finishes too early, the run fails rather than claiming an
interruption. Two cold exact-data recovery actions follow.

## Check the visible app

After a successful suite, the runner launches the normal app on its owned
simulator. It opens the Simulator window from the selected Xcode installation
when that app is installed. A tools-only Xcode installation can use the T3 Code
Device panel instead; the report records which interface is available.
Complete onboarding. In History, inspect the five fabricated original moods,
including the best `0`, worst `10`, notes and linked emotions. Add a new mood with
note `QA iOS retained after restart`, edit that note, and delete only that new
mood. Cold-open between the add/edit/delete steps using the printed simulator ID:

```sh
xcrun simctl terminate <printed-simulator-ID> com.lab4code.moodinator.qa
xcrun simctl launch <printed-simulator-ID> com.lab4code.moodinator.qa
```

Each committed change must survive restart, and the five originals must remain.
There must be no migration button/export-import step or empty replacement after
reopen. Record a screenshot of the retained history. A suite pass does not prove
these visible interactions. The initial launch capture needs visual review.

Return `evidence/report.json`, the source SHA/Xcode/iOS version and a short
add/edit/delete/restart pass or failure result. On setup/build failure, return
the failed command and its first error instead. Do not return databases or keys.
Native partial-export and destination-write-failure results are recorded separately
from phase-boundary results. Host-volume exhaustion is not covered.

After retaining evidence, shutdown/delete only the printed owned simulator with
`xcrun simctl shutdown <ID>` and `xcrun simctl delete <ID>`. Remove only the two
printed disposable workspace paths when their evidence is saved. Failure runs
attempt to dispose their owned simulator even if report writing fails. A cleanup
failure reports its owned UUID for manual removal. Only a successful proof run and app launch can retain the simulator for the
visible app check. Failure to open an installed Simulator window still fails
the run.
