# Moodinator Issues

Vertical-slice issues generated from the 2026-04-29 architecture pass, the 2026-04-29 Google Play readiness pass, and the 2026-05-02 local build report. Each slice is sized to be independently grabbable.

Legend: **AFK** = can ship without a human-in-the-loop decision. **HITL** = needs a design or product call first.

Ordering: priority — P0 (release-blocking or active data-loss) first, then data-integrity follow-throughs, then foundational architecture, then HITL design follow-ups, then build/config cleanup, then monitoring.

---

# P0 — Release-blocking & data integrity

## 1. Decide automatic-backup direction

**Type:** HITL (release-blocking)

### What to build

The Settings UI presents **Automatic Backups**, but background backup registration is currently disabled due to an `expo-task-manager` / New Architecture compatibility issue. Decide: re-enable and verify on Android release builds, or remove the promise from UI and legal copy.

### Acceptance criteria

- [ ] Decision documented (re-enable vs remove)
- [ ] Decision recorded in `ISSUES.md` and any relevant ADR
- [ ] #2 unblocked with chosen path

### Blocked by

None — can start immediately. Release-blocking for Play Store submission.

---

## 2. Implement chosen automatic-backup path

**Type:** AFK

### What to build

Execute the decision from #1. If re-enable: verify task registration, folder selection, permission persistence, backup creation, and cleanup on an Android release build. If remove: scrub UI copy, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, and in-app legal screens of automatic-backup wording.

### Acceptance criteria

- [ ] If re-enabled: end-to-end Android release test of registration → backup → cleanup
- [ ] If removed: no remaining mention of "Automatic Backups" in UI or legal
- [ ] Legal "Last Updated" dates bumped if copy changed

### Blocked by

- #1

---

## 3. Emotion deletes preserve historical mood entries

**Type:** AFK

### What to build

Stop bulk-removing deleted emotions from historical mood entries. Introduce an archived/inactive state so the emotion disappears from future selection while remaining attached to past **Mood Entry Snapshots**. Currently a data-loss bug — deleting an emotion silently rewrites history.

### Acceptance criteria

- [ ] Deleting an emotion in the Emotion List Editor moves it to archived, not removed-from-history
- [ ] Existing mood entries that referenced the deleted emotion still show that label in lists, insights, and exports
- [ ] `removeEmotionFromMoods` is gone or only runs through an explicit Historical Update
- [ ] Repository tests cover the archived flow

### Blocked by

None — can start immediately.

---

## 4. Context tag deletes preserve historical mood entries

**Type:** AFK

### What to build

Mirror #3 for context tags. Deleting a context tag from the Context Tag List removes it from future selection but leaves it attached to past mood entries.

### Acceptance criteria

- [ ] Deleting a context tag preserves historical references
- [ ] Existing mood entries still show the deleted context tag in lists, insights, and exports
- [ ] Tests cover historical-preservation behavior

### Blocked by

None — can start immediately (independent of #3, different storage path).

---

## 5. Remove deprecated `androidStatusBar.translucent`

**Type:** AFK

### What to build

Drop `androidStatusBar.translucent` from `app.json`. The setting is deprecated due to Android edge-to-edge enforcement and has no effect. Rely on current edge-to-edge patterns. Cheap release-prep cleanup.

### Acceptance criteria

- [ ] `androidStatusBar.translucent` removed from `app.json`
- [ ] `expo prebuild` no longer warns about it
- [ ] Status bar still renders correctly on a release Android build

### Blocked by

None — can start immediately.

---

# P1 — Data integrity follow-throughs

## 6. Emotion renames default to future-only

**Type:** AFK

### What to build

Renaming an emotion in the Emotion List Editor changes future selection only. Existing mood entries keep their original label as a snapshot. This is the default behavior with no historical update applied.

### Acceptance criteria

- [ ] Renaming an emotion does not mutate any existing mood entry
- [ ] New mood entries use the new name; old entries keep the old name
- [ ] Insights and exports show the historical label on historical entries
- [ ] Tests cover rename-without-historical-update

### Blocked by

- #3 (archived state must exist first to model "in-list vs in-history")

---

## 7. Context tag renames default to future-only

**Type:** AFK

### What to build

Renaming a context tag changes future selection only. Existing mood entries keep their original label as a snapshot.

### Acceptance criteria

- [ ] Renaming a context tag does not mutate any existing mood entry
- [ ] New entries use the new name; old entries keep the old name
- [ ] Insights and exports show the historical label on historical entries
- [ ] Tests cover rename-without-historical-update

### Blocked by

- #4

---

## 8. Persist mood scale reference on each mood entry

**Type:** AFK

### What to build

Add a mood-scale reference column to the mood entries schema so a historical **Mood Rating** can be interpreted against the **Mood Scale** that existed when its entry was created. Backfill existing rows with the current scale identifier. This is the foundation for future configurable scales — the read path comes in #15.

### Acceptance criteria

- [ ] Schema migration adds a non-nullable mood-scale reference per entry
- [ ] Repository writes the current scale id on every new entry
- [ ] Backfill migration sets the current scale id on all existing rows
- [ ] Migration tested against a fixture database

### Blocked by

None — can start immediately.

---

## 9. Align backup vs data export terminology

**Type:** AFK

### What to build

Audit user-facing copy, function names, settings labels, and legal text. Rename manual full-database export flows to **Data Export** and reserve **Backup** for automatic recovery exports. Keep `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, and in-app legal screens synchronized.

### Acceptance criteria

- [ ] No "manual backup" wording in UI, code, or legal docs
- [ ] Function and component names reflect the **Data Export** vs **Backup** boundary
- [ ] Legal docs and in-app legal screens reflect the new terminology
- [ ] "Last Updated" dates bumped on any legal doc that changed

### Blocked by

- #2 (avoids copy churn if #1 removes the Backup feature entirely)

---

# P2 — Foundational architecture

## 10. Deepen mood scale interpretation module

**Type:** AFK

### What to build

A single mood scale module that callers ask for the display and semantic interpretation of a mood value, instead of combining constants themselves. Callers should be able to pass a numeric mood value and get back the rounded value, label, color (hex, not Tailwind class), and accessibility text — without knowing that lower is better.

### Acceptance criteria

- [ ] One module owns mood value → label, color (hex), rounded value, accessibility text
- [ ] `DisplayMoodItem`, `ChartComponents`, `useInsightsData`, and any other caller use the module instead of manually combining constants
- [ ] Unit tests cover edge values (0, 10) and a representative mid value
- [ ] No remaining Tailwind-class-to-hex mapping outside the module

### Blocked by

None — can start immediately.

---

## 11. Deepen mood entry workflow module

**Type:** AFK

### What to build

Make `moodService` a workflow seam that owns create, edit, reschedule, delete, restore, and load-history as coherent operations — including cache/store updates, refresh-after-edit behavior, and migration side effects. Callers (`Home`, `useMoodItemActions`, the store) should call workflow methods, not compose low-level repository steps.

### Acceptance criteria

- [ ] `moodService` exposes user-level workflow methods that handle store updates internally
- [ ] `useMoodItemActions` and `(tabs)/index.tsx` call workflow methods, not repository functions
- [ ] No UI module imports `@db/db` directly (services-only seam, per AGENTS.md)
- [ ] Workflow tests cover create, edit, reschedule, delete, restore, and undo against a fake adapter

### Blocked by

None — can start immediately.

---

## 12. Consolidate settings storage module

**Type:** AFK

### What to build

A single settings module owns persistence, defaults, parsing, and migration. `settingsStore` hydrates from the module and updates through it; `entrySettings` is folded in or reduced to a thin re-export. Storage-key knowledge and corrupted-storage handling live in one place.

### Acceptance criteria

- [ ] One settings module owns storage keys, defaults, parsing, and migration
- [ ] `settingsStore` only orchestrates state — no direct AsyncStorage/SecureStore calls
- [ ] No duplicate default values between `settingsService` and `entrySettings`
- [ ] Tests cover corrupted-storage parsing and default-preference migration once

### Blocked by

None — can start immediately.

---

## 13. Deepen data portability module

**Type:** AFK

### What to build

A data portability module owns export ranges, import validation summaries, backup metadata, and manual backup operations. Platform file picking stays as an adapter at the edge. `src/app/settings/data.tsx` and `ExportModal` consume the module rather than orchestrating document picking, backup state, and summary text themselves.

### Acceptance criteria

- [ ] One portability module owns export ranges, import validation, backup metadata
- [ ] Document picker and filesystem access remain as edge adapters
- [ ] Settings UI and `ExportModal` call into the module, not directly into `db/backup` or `db/moods/importExport`
- [ ] Tests validate export/import/backup outcomes without rendering settings screens

### Blocked by

None — can start immediately.

---

## 14. Deepen mood insights module

**Type:** AFK

### What to build

Move mood aggregation, period filtering, streaks, trend math, pattern detection, and mood-scale interpretation into one mood insights module. UI modules in `src/features/insights` and `src/components/charts` should render results rather than compute them.

### Acceptance criteria

- [ ] One insights module owns aggregation, period filtering, streaks, trend math, pattern detection
- [ ] `useInsightsData`, `ChartComponents`, and Home reuse the module
- [ ] Tests target the module interface with fixture mood histories, not UI-adjacent helpers
- [ ] Deleting the module would remove the actual complexity (depth test passes)

### Blocked by

- #10 (uses the mood scale interpretation seam)

---

## 15. Read path interprets ratings via stored scale

**Type:** AFK

### What to build

Update `analyticsService`, `useInsightsData`, `ChartComponents`, and `patternDetection` to read the stored scale reference and interpret historical ratings using it. The interpretation should go through the module from #10.

### Acceptance criteria

- [ ] Insights, charts, and pattern detection use the stored scale reference, not the current scale
- [ ] Comparisons across entries with different scales either normalize or flag the mismatch (decide which in code review)
- [ ] Tests use fixtures with mixed scales

### Blocked by

- #10 (scale interpretation module)
- #8 (stored reference must exist)

---

## 16. Import/export/backup preserves scale metadata

**Type:** AFK

### What to build

Update `importExport`, `backup`, and the data portability module from #13 to serialize the mood-scale reference per entry. Importing data without a scale reference (older exports) must fall back to the current scale with a documented assumption.

### Acceptance criteria

- [ ] Data export includes per-entry scale reference
- [ ] Backup format includes per-entry scale reference
- [ ] Import of legacy exports without scale data succeeds and applies a documented fallback
- [ ] Round-trip tests verify a full export + import preserves scale on every entry

### Blocked by

- #8

---

# P3 — HITL design follow-ups

## 17. Historical Update opt-in flow for emotion renames

**Type:** HITL (UX design)

### What to build

Design and implement an explicit opt-in flow during emotion rename that, if confirmed, applies the new name to existing mood entries as a deliberate **Historical Update**. Needs a UX decision on confirmation copy, scope (all-time vs date range), and undo behavior.

### Acceptance criteria

- [ ] Rename UI offers an explicit "also update past entries" choice with clear copy
- [ ] Choosing it applies the rename to existing mood entries in a single transaction
- [ ] Default remains future-only (#6)
- [ ] Tests cover both branches

### Blocked by

- #6 (future-only default is the no-op baseline this opts out of)

---

## 18. Historical Update opt-in flow for context tag renames

**Type:** HITL (UX design)

### What to build

Mirror #17 for context tags. Opt-in flow that applies a rename to existing mood entries as an explicit Historical Update.

### Acceptance criteria

- [ ] Rename UI offers an explicit "also update past entries" choice
- [ ] Choosing it applies the rename to existing mood entries
- [ ] Default remains future-only (#7)
- [ ] Tests cover both branches

### Blocked by

- #7

---

## 19. Therapy export includes scale context

**Type:** HITL (decide fields)

### What to build

Therapy export needs enough mood-scale context for exported ratings to be interpreted outside the app. Needs a product call on which scale metadata to include (range, direction, label per value) and how to present it in the export format.

### Acceptance criteria

- [ ] Decision documented on what scale context the therapy export includes
- [ ] Therapy export includes the agreed metadata
- [ ] Sample export reviewable by a non-developer reader and self-explanatory
- [ ] Tests cover the export format

### Blocked by

- #16

---

# P4 — Build & config cleanup

## 20. Explicit build environment

**Type:** AFK

### What to build

Make the local Android build environment explicit. Set `NODE_ENV` in build scripts, define preview EAS env vars (or document that none are expected), and decide whether `ANDROID_NDK_HOME` should be pinned outside the SDK-managed flow.

### Acceptance criteria

- [ ] `NODE_ENV` is set explicitly for `bun run build` and `bun run build:preview`
- [ ] Preview EAS env vars are defined in EAS or documented as "none required"
- [ ] `ANDROID_NDK_HOME` decision is documented (set or rely on SDK-managed)

### Blocked by

None — can start immediately.

---

## 21. Clean redundant `tools:replace` manifest directives

**Type:** AFK

### What to build

Inspect the generated Android manifest merge inputs and remove or simplify `tools:replace` directives that are not replacing anything. The build currently emits stale-override warnings for `FileSystemFileProvider` and `ExpoCropImageActivity`.

### Acceptance criteria

- [ ] No "tagged ... to replace other declarations but no other declaration present" warnings at build time
- [ ] No regression in manifest merge output

### Blocked by

None — can start immediately.

---

## 22. Triage Gradle 10 deprecations

**Type:** AFK (investigation)

### What to build

Run an Android build with `--warning-mode all` and classify each Gradle deprecation as app-code, Expo tooling, or third-party. File follow-up issues only for app-code findings.

### Acceptance criteria

- [ ] `--warning-mode all` output captured
- [ ] Each deprecation classified (app / Expo / third-party)
- [ ] App-code deprecations get follow-up issues; the rest are documented as upstream

### Blocked by

None — can start immediately.

---

## 23. Normalize `NO_COLOR` / `FORCE_COLOR` in build environment

**Type:** AFK

### What to build

Pick one of `NO_COLOR` or `FORCE_COLOR` for the local build environment. The current setup sets both, and Node warns repeatedly that `NO_COLOR` is ignored.

### Acceptance criteria

- [ ] Only one of `NO_COLOR` / `FORCE_COLOR` is set during builds
- [ ] No repeated "ignored due to FORCE_COLOR" warning in build logs

### Blocked by

None — can start immediately.

---

# P5 — Monitoring (no action required)

## 24. Watch upstream Android manifest namespace warnings

**Type:** AFK (monitoring)

### What to build

Track upstream releases for `@react-native-async-storage/async-storage`, `react-native-haptic-feedback`, `react-native-safe-area-context`, `react-native-vector-icons`, and `@shopify/react-native-skia`. Upgrade when patched versions remove the `package="..."` manifest warnings.

### Acceptance criteria

- [ ] Each listed package is upgraded to a version that no longer emits the namespace warning, or the issue is closed when the warning becomes irrelevant

### Blocked by

None — pure monitoring.

---

## 25. Watch upstream Kotlin/Java deprecation noise

**Type:** AFK (monitoring)

### What to build

Track upstream releases for `react-native-pager-view`, `react-native-safe-area-context`, `react-native-webview`, `react-native-screens`, `react-native-gesture-handler`, `react-native-worklets`, `react-native-reanimated`, `expo-modules-core`, `expo`, `expo-constants`, and `@shopify/react-native-skia`. Upgrade when patched versions remove the deprecation warnings. Only patch locally if a warning becomes release-blocking.

### Acceptance criteria

- [ ] Listed packages tracked; upgrades land when available
- [ ] No local patches without a release-blocking trigger

### Blocked by

None — pure monitoring.

---

## 26. Track bundler cache cold-start cost

**Type:** AFK (monitoring)

### What to build

No action required today — Metro's "Bundler cache is empty" warning only affects build time. Track this only if local build performance becomes a problem.

### Acceptance criteria

- [ ] Issue stays open as a placeholder; close if cold-start time becomes a measurable pain point

### Blocked by

None — pure monitoring.

---

# Completed

## Align Expo SDK Package Versions

**Status:** Resolved on 2026-05-03.

Updated the Expo SDK 55 package set in `package.json` and `bun.lock`, then rebuilt `node_modules` from the refreshed lockfile. Verification passes: `bunx expo install --check`, `bunx expo-doctor`, `bun run lint`, `bunx tsc --noEmit`.

## Clean Release Verification Warnings

**Status:** Resolved on 2026-05-03.

`bun run lint` completes without warnings after release-cleanup changes. TypeScript also passes with `bunx tsc --noEmit`. Files touched: `src/app/notifications/[id].tsx`, `src/components/HapticTab.tsx`, `src/components/NoteModal.tsx`, `src/components/charts/ChartComponents.tsx`, `src/components/charts/DailyTab.tsx`, `src/components/charts/OverviewTab.tsx`, `src/components/entry/LocationPicker.tsx`, `src/components/entry/SameAsYesterdayButton.tsx`, `src/components/entry/VoiceMemoRecorder.tsx`, `src/lib/haptics.ts`, `src/shared/state/moodsStore.ts`.
