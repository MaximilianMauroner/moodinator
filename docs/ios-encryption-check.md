# Local Mac encryption check

Max owns this iOS simulator run. Acceptance is unexecuted until he returns its
results. This uses the same production startup, native storage factory, bundled
fabricated fixture and QA proof actions as the Android runner. It creates a new
simulator and installs only `com.lab4code.moodinator.qa`. It never selects a
physical device or an existing simulator. No personal data or signing is needed.

Use the exact reviewed PR #118 source SHA supplied with the handoff. A later
source change needs its affected evidence refreshed before accepting that build.
Prerequisites are existing Xcode with an installed iOS Simulator runtime,
CocoaPods, Node 24 and Bun 1.3.14. If one is missing, return that error; the runner
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
bun install --frozen-lockfile
export MOODINATOR_VARIANT=qa MOODINATOR_QA_ENCRYPTION_PROOF=1
export EXPO_OS=ios EAS_BUILD_PLATFORM=ios MOODINATOR_METRO_MAX_WORKERS=1
export NODE_OPTIONS=--max-old-space-size=768
MOODINATOR_QA_PREPARE_NATIVE=1 node node_modules/expo/bin/cli prebuild --platform ios --clean --no-install
(cd ios && pod install)
node scripts/seal-native-qa.js --platform=ios
bun scripts/run-native-encryption-ios.ts --out="$MOODINATOR_IOS_WORK/evidence" --keep-simulator
)
```

Stop at the first failed command. Do not use `build`, release or EAS commands.
The runner builds Release for `iphonesimulator` with signing disabled, one Xcode
job and a bundled app, so no Metro server is needed. It records Mac/Xcode,
source/app identity, resource samples and `/usr/bin/time` build memory in the
evidence folder. Build and simulator execution do not overlap. Only its owned
build process group receives cancellation signals.

The suite creates five fabricated original moods, exact int64/NUL/BLOB values,
legacy columns, links, sequences and schema objects. It verifies plaintext and
V1 passphrase conversion, exact retention/roundtrip, keyed fresh initialization,
later writes/cold Keychain reopen, wrong/keyless rejection, lost-key retention,
unknown/missing state and native lock exclusion. Separate cold actions test
committed WAL recovery and actual SIGKILL at all ten phase boundaries, followed
by two exact reopen checks. The driver resolves the QA process inside its own
simulator and verifies its executable path before signalling it. It also seeds
the actual app database and exercises shared `getDb()` first-open startup twice.

## Check the visible app

After a successful suite, the runner opens its own Simulator in the normal app.
Complete onboarding. In History, inspect the five fabricated original moods,
including the best `0`, worst `10`, notes and linked emotions. Add a new mood with
note `QA iOS retained after restart`, edit that note, and delete only that new
mood. Cold-open between the add/edit/delete steps using the printed simulator ID:

```sh
xcrun simctl terminate <printed-simulator-ID> com.lab4code.moodinator.qa
xcrun simctl openurl <printed-simulator-ID> 'moodinator-qa:///?proof=journey'
```

Each committed change must survive restart, and the five originals must remain.
There must be no migration button/export-import step or empty replacement after
reopen. Record a screenshot of the retained history. A suite pass does not prove
these visible interactions. The initial launch capture needs visual review.

Return `evidence/report.json`, the source SHA/Xcode/iOS version and a short
add/edit/delete/restart pass or failure result. On setup/build failure, return
the failed command and its first error instead. Do not return databases or keys.
Interruption inside native export and native disk/write failure are still
separate unexecuted gates; phase-boundary results do not waive them.

After retaining evidence, shutdown/delete only the printed owned simulator with
`xcrun simctl shutdown <ID>` and `xcrun simctl delete <ID>`. Remove only the two
printed disposable workspace paths when their evidence is saved. Failure runs
automatically dispose their owned simulator and retain their evidence.
