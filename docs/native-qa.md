# Native QA

Run the Maestro flow on a disposable Android emulator and record the result in
the task tracker. Passing unit tests or parsing YAML does not verify native
layout, gestures, haptic strength, or frame timing.

## Historical smoke record (old head only)

On Android 15 / API 35 emulator `emulator-5554` (QA emulator record `491382`),
the provisional QA APK built from old head
`6dbb79465e6e2cdaceb6d13b3631a1d4d4f8f5d5` passed the synthetic-data smoke
journey without a crash: all four onboarding pages, quick save, edit note,
relaunch with persistence, delete, and empty plus filled Insights. APK
SHA-256: `2c84c16dcebe1d7e61f4182c6f9979c325ea7aa0ec84b69864370bd05c18b3e6`.
Evidence folder: `/tmp/moodinator-native-smoke-20260917T184657Z`. The emulator
was safely stopped. This is historical evidence and is not verification of the
current PR head.

Two observations remain unconfirmed on the current head and need bounded
scroll/touch/layout checks: possible lower-energy-chip/footer overlap, and
transient empty-card text not visible in the first screenshot. No screenshot
URL is asserted here.

## Recording-trust acceptance matrix

This matrix separates source and test evidence from native proof. A passing
static check does not establish that a new user understood the action or that a
native control remained reachable.

| First-use journey | Source/test expectation | Native candidate evidence still required |
| --- | --- | --- |
| Clean install and purpose | Onboarding explains private mood journaling, the 0–10 scale (0 best, 10 worst), quick versus detailed entry, local-only limits, and the next action. | Fresh install reaches Home after onboarding; a newcomer can identify the first mood action without developer terminology. |
| First quick entry | One mood is sufficient; the awaited create callback is the persistence boundary; success acknowledgement appears only after commit. | Tap one mood, save, observe one neutral acknowledgement and one history row; cancel and rejected writes produce no false success. |
| Detailed entry | Emotions, context, energy, and notes remain optional/configurable; keyboard and draft-discard behavior are covered by source/tests. | Long-press opens the detailed form; notes remain reachable with the keyboard; save/reject/cancel preserve the correct draft. |
| Recorded time | History, accessibility, detail, calendar, and related toasts use the recorded offset; original timestamps are not rewritten. | Verify cross-midnight positive, negative, and half-hour offsets, change device timezone, and confirm the displayed day/time stays stable. |
| Read/edit/delete | History actions edit, change date/time, delete, and undo through the mood service/store. | Edit persists after restart; date/time changes are intentional; delete removes one row and Undo restores the same data. |
| Insights | Zero, one, and multiple records have no-data/insufficient-sample states; findings describe associations, not causes. | Check Findings, Charts, Calendar, ranges, refresh, and populated fixtures on a clean QA install. |
| Settings and portability | Presets affect the next entry; JSON import replacement is confirmed; export, backup, deletion, and external-copy limits are disclosed. | Verify preset application, malformed import recovery, selected Android backup folder, manual backup, deletion scope, restart, and offline use. |
| Protection and reminders | Optional app lock, biometrics, and local reminders are separate existing functionality. | Verify PIN/biometric recovery and reminder delivery after restart on the exact candidate; physical-device notification behavior remains separate. |

## Evidence boundary and remaining runtime inventory

Current source/test evidence covers the service/store persistence workflow,
canonical timezone calculations, entry draft behavior, filters, Insights
analysis, and error paths. Native proof must still cover the complete matrix
above plus narrow screens, large system text, light/dark themes, reduced motion,
accessibility labels, touch-target edges, and rapid repeated taps. In
particular, verify the Home mood selector, Last Entry copy/preview gesture,
history swipe actions, action menus, date/time editor, calendar day details,
app-lock recovery, notifications after process restart, JSON/CSV sharing,
Android folder permissions, backup retention, delete-data boundaries, and
offline/restart recovery. Maestro is optional; if unavailable, retain adb
hierarchy and screenshot evidence instead.

## Exact current-candidate requirements

The candidate must identify the exact source SHA and build configuration. It
must use the isolated QA package `com.lab4code.moodinator.qa` for destructive
fixtures, and the release package `com.lab4code.moodinator` only for a separate
owner-approved release check. Confirm version name/code, target API 36, merged
release manifest, generated permissions, and the absence of debug-only paths.
Run `bun run verify:android-release-manifest` against the generated candidate,
retain the package checksum and screenshots beside the candidate evidence, and
never call historical APKs or screenshots current. Use fabricated data only;
do not install into a device containing personal Moodinator data.

The Android database remains unencrypted by Moodinator and JSON/CSV
exports/backups remain plaintext. This slice does not redesign encryption,
backup, or deletion semantics. Play-facing copy must continue to describe
personal wellness journaling and descriptive self-reflection only: no
diagnosis, treatment, medical-device, causal-insight, monitoring, guaranteed
backup, or emergency-response claims.

## Isolated Android setup

Use the separate `com.lab4code.moodinator.qa` app on a disposable emulator. The
smoke flow clears that app's data at launch. Do not point the flow at the normal
Moodinator package or a device that holds personal mood data.

1. Run `bun run qa:prepare` from the originating checkout. Use the isolated
   workspace path and prepared source SHA printed by that command for the QA
   build; the workspace intentionally has no `.git` directory.
2. Install dependencies, run a clean Android prebuild with
   `MOODINATOR_VARIANT=qa MOODINATOR_QA_PREPARE_NATIVE=1`, then run
   `bun run qa:seal-native`. Unset `MOODINATOR_QA_PREPARE_NATIVE`; sealed builds reject
   that prebuild-only flag. Build and install with `MOODINATOR_VARIANT=qa`. Confirm that
   the installed package is `com.lab4code.moodinator.qa` before continuing.
3. Install Maestro and Android SDK platform tools. Start one disposable emulator.
4. Run `bun run qa:smoke -- emulator-5554 --out /tmp/moodinator-native-smoke-current`
   with the actual emulator serial. The runner first verifies its executing
   workspace against the sealed prepared manifest, then checks the emulator and QA package before invoking
   `.maestro/smoke.yaml`.
5. Record the commit, Android API level, emulator profile, build type, command,
   result, and artifact paths in the task tracker.

On hosts with limited RAM, check available memory before builds, dependency installs
and emulator launches. Compile before starting the emulator; do not overlap native
compilation, the emulator and broad test runs. In the disposable checkout, cap Metro
workers with `MOODINATOR_METRO_MAX_WORKERS=1` and Gradle with `--max-workers=1`; bound
JVM and Node heaps to fit the available memory. Do not edit `metro.config.js` or any
other tracked file after `qa:prepare`: QA configuration verifies every copied tracked
file and every sealed generated Android input against the prepared manifest and
rejects unlisted project inputs. Only dependency, Expo-state, and native build-output
directories are excluded. Run `qa:prepare` again for a different source tree. Stop or reduce an owned workload if memory
pressure keeps rising.

Use an installed build that starts directly into the app. If a debug build opens
an Expo development launcher, resolve that setup before running the flow. The
flow does not dismiss unexpected screens or skip failed steps.

## Automated smoke coverage

The flow checks all four onboarding pages, creates a detailed neutral mood with
an emotion, energy, and note, restarts the process, and reads the saved fields in
the edit form. It then updates the note, reopens the form to check it, opens
and refreshes Insights, and leaves the action menu open immediately before
Delete. The smoke runner captures the one exact timestamp/note/rating identity,
activates Delete from the live hierarchy, proves that identity absent, then
inspects and taps the transient `undo-delete` control at its current bounds and
proves the same identity is restored exactly once. The production five-second
toast duration is not changed.

The flow expects fresh QA data, the default entry fields, and English app text.
It uses accessibility labels for actions and test IDs for repeated controls.
An unexpected permission prompt, missing control, save failure, or different
entry count must fail the run. Investigate the failure before updating selectors.

## Manual checks

Record pass, fail, or not tested for each item. Include reproduction steps for
failures. Use fabricated data only.

| Area | Check | Expected result |
| --- | --- | --- |
| Emotion feedback | Select three emotions, try a fourth, remove one from the summary, then select another. | One short event per valid change. No event or state change for the blocked fourth selection. |
| Context feedback | In Quick, Detailed, and Edit Entry with context enabled, select and deselect a context tag. Cancel a press by dragging off the chip. | One short event per accepted change. No event for a canceled press. |
| Energy feedback | Select 0, select 10, tap the selected level, then set and clear energy. | Zero is retained as a value. Tapping the selected level and Clear both remove it. One short event per change. |
| Preference | Turn haptics off in Settings. Repeat emotion, context, energy, save, and navigation actions. Restart and repeat. | Fields still work. App feedback remains silent after restart. |
| Android modal feedback | Record the device, API level, build revision, and app/system vibration settings. Compare selection feedback on Home and in each entry modal. Toggle the system touch-feedback setting and repeat. | Selection remains brief in modals. Record system-setting behavior: Expo selection uses the vibrator service, so it is not equivalent to Android view feedback. The in-app off setting must always silence it. |
| Restrained feedback | Select the current emotion category again, then change it. Copy the previous entry once. | No event for an unchanged category. One result event after copying, without an initial buzz. |
| Device feedback | Repeat on a real Android device and, when available, an iPhone. | Feedback is brief and consistent. Emulator silence is not evidence of physical feedback quality. |
| Touch | Use a narrow screen and large system text. Tap the edges of emotion chips, summary chips, each energy level, Clear, and Refresh. | Controls remain separate and reachable. Labels do not overlap. Energy wraps in numeric order. |
| Keyboard | Open detailed entry, focus notes, type several lines, hide the keyboard, move back, then save. | Notes and footer remain reachable. The first Back action dismisses the keyboard where applicable. |
| Readability | Check light and dark themes, especially energy levels 7 through 10. | Numbers, selection, and removal hints remain legible. |
| Reduced motion | Enable the system's reduced motion setting. Visit onboarding, Insights, and app lock, then select and save fields. | No continuous decorative motion. Feedback does not block input. |
| Gestures | Swipe a history row right to edit and left to delete. Undo the deletion. | The intended row changes. Restored data matches the original. |
| Draft errors | Change a note, close the form, choose Keep editing, then close and discard. | Keep editing preserves the draft. Discard leaves the saved entry unchanged. |
| Save errors | In an isolated test build, make the storage write reject through a local debugger or test harness. Submit a populated draft, restore storage, and retry. | Save failed appears. The form and draft remain. Retrying creates one entry. No production error switch is required. |
| Load errors | In an isolated test build, make the history or Insights read reject, then restore it and refresh. | The error is visible. Loading ends. Retry recovers. Existing entries remain intact. |
| Import errors | Import malformed JSON through the normal Settings import action. | The error is visible and existing entries are unchanged. |

If fault injection is unavailable, mark save and load errors as not tested.
Do not substitute disabling networking: the app stores its data locally.

## Large history and performance

The stress runner generates relative-time fabricated exports itself, pushes each
one to the disposable emulator, and imports it through the normal Settings flow.
The pristine fixture has positive `QA match` records and negative `QA other`
records; 60 records match the combined 90-day/mood/emotion/context/note filter
before the boundary edit cycles. Edited notes retain their original fabricated
text so exact-note indexed lookup remains active; 60 records still match until
the dedicated refresh mutation removes one. The standalone generator remains
available for manual setup: `bun run qa:fixtures -- 1000 /tmp/moodinator-fixtures-1000.json` and repeat with 10,000 entries. Use a fresh
QA dataset between sizes. Do not load fixtures into the normal app.

The repeatable stress runner performs that import through Android's document
picker, then scrolls to the 51st, 501st, and 951st entries for a 1,000-entry
fixture. For 10,000 entries it reaches the 51st normally, then uses an exact
fabricated-note filter as a bounded indexed lookup for the 5,001st and 9,951st
entries instead of trying to render nearly 10,000 cards inside a 30-second
Maestro step.
Each route edits, deletes, and restores the recycled row. It then derives the
combined 90-day, mood, emotion, context, and note filter from the post-edit
fixture (60 matching identities for either size). While the filter is active,
it edits the first matching note so the mutation-triggered refresh must remove that exact
identity and decrement the count; a cached result fails the flow. The runner
uses only fabricated data and writes evidence outside the repository:

```bash
bun run qa:stress -- emulator-5554 --size 1000 --label baseline --runs 2 --out /tmp/moodinator-native-stress-baseline-1000
bun run qa:stress -- emulator-5554 --size 1000 --label current --runs 2 --out /tmp/moodinator-native-stress-current-1000
bun run qa:stress -- emulator-5554 --size 10000 --label baseline --runs 2 --out /tmp/moodinator-native-stress-baseline-10000
bun run qa:stress -- emulator-5554 --size 10000 --label current --runs 2 --out /tmp/moodinator-native-stress-current-10000
```

Use new empty output directories for each command. Each run records the source
SHA, a wall-clock-independent SHA-256 workload hash, and a performance-device
profile. The workload hash normalizes timestamps against the fixture's rounded
anchor and covers the pristine, cycle-edited, and filter-refresh-edited fixture
payloads plus the import, startup, and fully materialized cycle/filter flows that
are executed. The profile includes the AVD name and Android system fingerprint, CPU
ABI/count, total RAM, physical/override resolution and density, configured peak
refresh, and the active display mode/actual refresh reported by Android. It also
records `dumpsys gfxinfo` frame counters, repeated `dumpsys meminfo`
captures, an `atrace` scroll trace when the emulator permits it, and thermal
snapshots immediately before and after every measured run. The imported app
process stays alive across all measured cycle and filter flows. Compare
the baseline/current `summary.json` files only when the normalized workload
hash, complete performance-device profile, each corresponding run's before/after
thermal snapshots, fixture size, and run count match. A recreated AVD must not
be treated as comparable merely because it reused an emulator serial. Their `sourceSha`
values may differ across revisions, but each summary must match its own
provenance-bound installed QA binary. A
failed required memory, gfx, or trace capture produces `status: failed` or
`blocked` with `acceptance: not-accepted`; optional thermal diagnostics are
labelled separately. The runner deliberately does not calculate or claim a
performance improvement.

Use an Android profile or release build for measurements. Record the device,
build, dataset size, refresh rate, thermal state, and measurement tool. Keep
these conditions the same when comparing runs.

1. Scroll through history and return to the newest entry. Edit, delete, and undo
   a row after several recycled rows have appeared. Check for stale notes,
   collapsed rows, blank cards, and repeated entries.
2. Open Insights, switch the date range, and refresh. Check that loading ends and
   totals match the imported data for the selected period.
3. Capture startup and scroll frame timing with Android Studio System Trace or
   Perfetto. Record slow frames and pauses. Retain the capture with the task.
4. Leave Home, Insights, onboarding, and app lock idle for 30 seconds each after
   transitions finish. Capture rendering work. Decorative icons and rhythm dots
   should not keep producing animation frames. A busy operation or lockout
   countdown must be assessed separately.
5. Repeat the route several times and compare memory after the app settles.
   Investigate retained growth before calling the run clean.

Do not report a performance improvement without comparable captures. The
prepared smoke flow is a functional check and does not measure frame rate.

## Insights, filters and recorded dates

Use fabricated entries with known ratings. Seed five entries tagged Outside at mood
2 and five untagged entries at mood 6 inside the selected range. Findings should
say Outside entries average 4.0 better, with 5 with and 5 without. Removing one
tagged entry must remove that comparison and identify the sample shortfall.
Charts must show the same driver numbers. Check 7, 30, 90 and All ranges, including
empty periods and isolated days. Missing dates must leave gaps in the trend; an
isolated day with multiple ratings must still show its min/max range.

On a narrow device and with large text, verify Findings/Charts/Calendar and all
four ranges remain reachable without overlapping labels. Check both themes and
reduced motion; capture 30 idle seconds on Charts after transitions settle.

The reproducible visual matrix sets Android font scale to 1.3 and covers light,
dark, normal-motion, and reduced-motion states. It explicitly writes and reads
back nonzero animation scales for normal motion, restores the emulator's font
scale, theme, and animation settings in a `finally` path, and verifies a
fabricated note plus exact history count before each screenshot. Run it after
the QA app has imported only fabricated data:

```bash
bun run qa:matrix -- emulator-5554 --fixture-note 'QA match 0001: fabricated native stress record.' --fixture-count 1000 --out /tmp/moodinator-native-matrix-current
```

The matrix retains one screenshot per state. A successful command proves state
setup, fixture identity, and capture only; its evidence remains pending visual
review for clipping/readability, and reduced-motion behavior still needs a live
manual check. Android timezone travel should be
run on a fresh fabricated fixture with its recorded `utcOffsetMinutes` and
verified at UTC plus a second zone. The dedicated journey imports 100 entries,
travels through UTC and Pacific/Auckland, and compares the row's accessibility
date/time label:

```bash
bun run qa:timezone -- emulator-5554 --out /tmp/moodinator-native-timezone-current
```

It reads the device timezone back after every request and records requested vs
actual values. It restores the emulator's timezone settings in a `finally`
path. If the emulator refuses or ignores a timezone, the observation is
`tested: false`, the evidence is `blocked`/`not-accepted`, and the command exits
nonzero; it cannot produce `stableRecordedLabel: true`.

On Home, open Filter history and apply note text, mood 7 or worse, an emotion,
a context and a date range separately, then combine them. Verify empty results,
Clear filters and a failed refresh after deleting a filtered row. Scroll past two
50-entry pages, refresh, then edit/delete/undo: no duplicate or skipped rows.
Home's streak and the Insights history total must ignore Home's filters.

For timezone checks, create an entry near midnight, note its calendar date and
rhythm time slot, change the QA device timezone, and reopen the same period.
The recorded date/time slot must stay the same. Export/import the fixture and
repeat. Legacy fixtures with no recorded offset intentionally use the current
device timezone. Note-only edits and undo preserve the original offset; changing
the timestamp records the offset for the selected time.

Android encryption and notification quick-log delivery require their separately
tracked migration rehearsal and physical-device spike. Emulator success does not
establish terminated-process notification behavior on a physical device.

The smoke also opens Findings, Charts and Calendar with its one-entry fixture,
checks the insufficient-sample message and the empty driver comparison, and
returns to Findings. It does not establish populated chart correctness or
large-history performance; use the fabricated comparisons above for those.

The Undo probe begins only after the final Maestro flow has completed at the
open action menu. The runner captures an exact timestamp-based row/note/rating
identity, clears any prior Undo control, taps Delete from the inspected bounds,
waits for exact identity absence, and only then polls the five-second transient
control. It uses `adb shell uiautomator dump --compressed /dev/tty`, matches
stable resource IDs (with the existing accessibility label as a fallback), and
derives every tap point from current bounds. Disabled/invisible controls,
hierarchy failure, or a late control fail the evidence; no production toast
duration is changed.
