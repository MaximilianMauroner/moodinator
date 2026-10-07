# GitHub-hosted Android nightly

Moodinator builds an APK and AAB on a public `ubuntu-24.04` GitHub runner at
midnight Europe/Vienna, including daylight-saving changes. Manual dispatch is
available on `main` only. The job has a 90-minute limit and per-app concurrency
with `cancel-in-progress: false`. Production promotion remains manual.
The historical combined APK/AAB time was about 17–32 minutes on the earlier
host. There is no hosted benchmark yet.

## Setup and cutover

The repository needs exactly two user secrets:

- `EXPO_TOKEN`: access to the existing Expo project and remote signing credentials.
- `PLAY_SERVICE_ACCOUNT_JSON`: the full authorized Play service-account JSON.

The workflow uses its normal `GITHUB_TOKEN`, with `contents: write` only in the
release job. It writes the Play key to a mode-0600 temporary file, removes it in
an always-run cleanup step, and never prints it. Runner destruction also removes
temporary files after cancellation. The key is used for direct Google upload;
it is not passed as a file to Expo. Signing uses existing remote EAS credentials
and `--freeze-credentials`. No new signing keys are created.

Before the first dispatch, the cutover owner must stop the old Mac schedule,
confirm no release is active, reconcile with Play, and create the orphan
`release-state` branch containing `ledger.json` with the exact existing coding
ledger history. This PR does not initialize or mutate that live ledger.
Missing or empty state fails closed. Do not seed from app metadata, reuse a
number, or erase attempted SHAs. Configure both secrets before activation.
Merging installs the schedule; runs fail before reservation until setup is ready.
The parent owns secret verification and the first live dispatch.

The workflow pins action commit SHAs, Node 24.13.1, Bun 1.3.14, Java 17,
EAS 20.5.1, Android build-tools 36, and bundletool 1.18.2 with a SHA-256 check.
It checks actual disk/RAM and removes only unused tool bundles on the disposable
runner if disk is low. Preflight still requires 15 GiB free disk and 8 GiB RAM.

## Source, checks and state

Every normal build command uses `scripts/nightly-release.mjs`:

```sh
bun run release:internal
bun run release:status
node scripts/nightly-release.mjs status
```

The runner fetches `origin/main`, checks the chosen EAS stable version against
that SHA's `eas.json`, then prepares an isolated worktree of the same SHA.
Locked dependency installation, full `bun run verify`, and `bun run test:nightly`
run there before reservation. Local work is preserved. Use the coordinated
entrypoint for tester releases; direct EAS/Play uploads bypass the ledger.

All entrypoints, including local status and manual finish, use the same authority:
`MaximilianMauroner/moodinator`, branch `release-state`, file `ledger.json`.
Local access uses `GH_TOKEN` or `GITHUB_TOKEN`, otherwise a captured `gh auth token`.
Never put a token on the command line or print it. The API host is fixed to
`api.github.com`; redirects and arbitrary repository names are not accepted.
There is no SSH, local-file, cache, artifact, or dual-write ledger fallback.

The Python transition rules are unchanged. One attempt per Vienna calendar day
and per source SHA is allowed. Failed attempts consume numbers. An active
reservation blocks another source until explicit reconciliation. No-op status,
daily/source skips, and idempotent finish calls do not write state.
The adapter reads the ledger blob and writes changed state with its prior blob
SHA. A conflict, API error, or uncertain write stops without retry. A build starts
only after reservation persistence is confirmed. Missing state is never created
by the runner. The `seed` CLI is removed; the pure seed transition remains for
fixture construction and historical transition compatibility.

## Artifacts and recovery

Both artifacts must pass the existing package/version/versionCode/approved
certificate verification before upload to the fixed Play `internal` track.
The workflow retains verified APK/AAB copies and sanitized `release.json` for
30 days, including verified bundles from a failed upload. Unverified build
outputs and raw EAS logs are excluded. EAS logs remain private mode-0600 files
until cleanup; they can contain credentials and must never become Actions output
or uploaded artifacts. Local artifacts default to
`~/Downloads/lab4code-releases/moodinator/`; `RELEASE_ARTIFACTS_DIR` changes the base.
Pre-reservation failures record a sanitized stage without a reserved identity.

Cancellation or timeout does not finish an active reservation automatically.
A lost finish response can also leave it active. Inspect GitHub state, job status,
and Play Internal before reconciling. Confirm that no build/upload is running,
then record the outcome that actually occurred:

```sh
node scripts/nightly-release.mjs finish RESERVATION_ID failed
# Use succeeded only after confirming that reserved version reached Internal.
```

There is no automatic retry or fallback after an ambiguous upload or ledger write.
Closing an attempt never permits another attempt for that SHA or reuses its number.
The uploader protects existing Play review state with
`changesInReviewBehavior=ERROR_IF_IN_REVIEW`; no production track is touched.

## Remaining local compatibility

The Mac LaunchAgent generator is removed. `run-nightlies.mjs` remains only for
an installed old LaunchAgent that calls it until the cutover owner retires that
schedule. It invokes the same GitHub-backed entrypoints and cannot access the old
ledger. Remove it and its caller test after retirement is confirmed. The host
lock remains for supported local manual builds and is not persistent ledger state.

## Verification

```sh
bun run verify
bun run test:nightly
```

Tests use fixtures and mocked storage, never live ledgers or uploads. They cover
transition gates, version limits, compare-and-swap conflicts, uncertain writes,
missing state, cancellation, secret preparation, check-before-reserve ordering,
artifact verification, Internal-only upload and sanitized diagnostics.
PR CI runs the same full project and release checks without secrets. CI success
does not prove live Expo/Play access or hosted build performance. The first
hosted release and secret verification belong to the cutover owner.
