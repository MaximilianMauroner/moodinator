# Moodinator Issues

Vertical-slice issues generated from the 2026-04-29 architecture pass, the 2026-04-29 Google Play readiness pass, and the 2026-05-02 local build report. Each slice is sized to be independently grabbable.

Legend: **AFK** = can ship without a human-in-the-loop decision. **HITL** = needs a design or product call first.

Ordering: priority — P0 (release-blocking or active data-loss) first, then data-integrity follow-throughs, then foundational architecture, then HITL design follow-ups, then build/config cleanup, then monitoring.

---

# P0 — Release-blocking & data integrity

## 1. Decide automatic-backup direction

**Status:** Resolved on 2026-05-21.

**Decision:** Keep the feature. Per current Expo SDK 55 docs, `expo-background-task` works on both iOS (BGTaskScheduler) and Android (WorkManager) with the New Architecture; the previous "disabled" note was outdated. Task is already registered at `src/app/_layout.tsx:59`. iOS timing is best-effort by design — UI copy adjusted accordingly under #2.

---

## 2. Implement chosen automatic-backup path

**Status:** Resolved on 2026-05-21 (re-enable path).

- UI section retitled `Periodic Backups` with helper footer: "Backups run automatically when your device is idle and on a stable connection. The system decides when, so timing may vary."
- "Weekly backup created successfully." → "Backup created successfully." on manual trigger.
- "Select a folder for automatic backups" → "Select a folder for periodic backups".
- `db/backgroundBackup.ts` JSDoc updated to reflect best-effort scheduling; worker body extracted to `runBackgroundBackupTask` for testability.
- Tests added: `__tests__/db/backgroundBackup.test.ts` covers throttle (isBackupNeeded → false), success path, createBackup-fail path, unexpected-throw path, registration (new + already-registered + error swallowed), and the iOS-simulator skip-log path.
- Verification gate: Android emulator + iOS simulator skip log. Physical device run not required for this slice.

---

## 3. Emotion deletes preserve historical mood entries

**Status:** Resolved on 2026-05-21.

Achieved by the snapshot-per-row architecture rather than an explicit "archived" flag — the outcome (gone from future selection, still attached to past entries) is the same. Concretely:

- The user-facing Emotion List Editor delete path (`handleConfirmRemoveEmotion` in `src/app/settings/emotions.tsx`) only mutates the AsyncStorage preset list via `setEmotions` and never touches the moods database.
- The lower-level `deleteEmotion` only removes the row from the `emotions` table; cascading `mood_emotions` rows go with it, but the per-row JSON snapshot on `moods.emotions` (read by `toMoodEntry`) is untouched, so lists, insights, and exports continue to render the historical label.
- `removeEmotionFromMoods` does not exist in the codebase.
- Coverage: `__tests__/services/emotionService.test.ts: "deletes an emotion from future selection without rewriting past mood entries"`, `__tests__/shared/state/settingsStore.test.ts: "removing an emotion from the list does not touch the moods table"`, and `__tests__/db/repository.test.ts: "preserves historical emotions on a mood snapshot even when the emotions table has no matching row"`.

---

## 4. Context tag deletes preserve historical mood entries

**Status:** Resolved on 2026-05-21.

Context tags only live in two places: the AsyncStorage preset list (`CONTEXT_TAGS_KEY`) and the per-row JSON snapshot on `moods.context_tags`. The Context Tag List Editor delete path (`handleConfirmRemoveContext` in `src/app/settings/contexts.tsx`) only mutates AsyncStorage via `setContexts`; nothing rewrites mood rows. Coverage: `__tests__/shared/state/settingsStore.test.ts: "removing a context tag from the list does not touch the moods table"` and `__tests__/db/repository.test.ts: "preserves historical context tags on a mood snapshot regardless of current context tag list"`.

---

## 5. Remove deprecated `androidStatusBar.translucent`

**Status:** Resolved on 2026-05-21.

The entire `androidStatusBar` block is absent from `app.json` (verified by grep across `app.json` and `android/`). `bunx expo-doctor` reports 18/18 checks passed with no warnings about the deprecated field. The release-build status-bar rendering check is implicit — there is no longer a setting that could affect it; the app relies on Android edge-to-edge defaults.

---

# P1 — Data integrity follow-throughs

## 6. Emotion renames default to future-only

**Status:** Resolved on 2026-05-21.

Confirmed via tests that the bare rename paths (`updateEmotion` on the SQL emotions table and `setEmotions` on the AsyncStorage preset list) do not touch the JSON snapshot stored on `moods.emotions`. The historical-update flow is the only path that rewrites past entries, and it is opt-in via `emotionService.applyRenameHistoricalUpdate`. New rename + recategorize future-only tests added in `__tests__/services/emotionService.test.ts`; rename-via-settings test added in `__tests__/shared/state/settingsStore.test.ts`. Read path (`toMoodEntry`) already reads from the per-row JSON snapshot, so insights/exports continue to show historical labels.

---

## 7. Context tag renames default to future-only

**Status:** Resolved on 2026-05-21.

Context tags are stored only in AsyncStorage (`CONTEXT_TAGS_KEY`) and per-row JSON on `moods.context_tags`. Mutating the preset list via `setContexts` (the only "rename" surface) never touches the moods database. New future-only rename test added in `__tests__/shared/state/settingsStore.test.ts`; the existing `toMoodEntry` test confirms historical snapshots survive list changes.

---

## 8. Persist mood scale reference on each mood entry

**Status:** Resolved on 2026-05-21.

`mood_scale_json` column already existed and was being written on every new and updated entry. Added a `backfillMoodScaleJson` migration in `db/moods/migrations.ts` wired into `initializeDatabase`; it sets the current scale snapshot on any row with NULL or empty `mood_scale_json`. SQLite does not allow promoting an existing column to NOT NULL retroactively, so the backfill is the load-bearing guarantee. Read path (`deserializeMoodScale`) still falls back to the current scale for safety. Tests cover backfill of NULL rows, preservation of already-set rows, no-op when all rows are set, and empty-string treatment in `__tests__/db/migrations.test.ts`.

---

## 9. Align backup vs data export terminology

**Status:** Resolved on 2026-05-21.

- "Full Backup" segment in `ExportModal` renamed to "Full Export" — the modal exclusively serves Data Export.
- `handleManualBackup` in `src/app/settings/data.tsx` renamed to `handleRunBackupNow`; the user-visible label "Run Backup" was already correct.
- Privacy Policy and Terms of Service (.md + in-app screens) updated to reserve "Backup" for periodic recovery exports and "Data Export" for manual full exports. "Last Updated" bumped to May 21, 2026 on both.
- Confirmed no "manual backup" wording remains in UI, code, or legal docs.

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
