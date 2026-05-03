# Architecture Deepening Opportunities

Generated from an architecture pass on 2026-04-29.

These are candidate refactors, not implementation specs. Each item uses the architecture vocabulary from the `improve-codebase-architecture` skill: module, interface, implementation, depth, seam, adapter, leverage, and locality.

## 1. Deepen Mood Insights

**Files**

- `src/services/analyticsService.ts`
- `src/components/charts/ChartComponents.tsx`
- `src/features/insights/hooks/useInsightsData.ts`
- `src/features/insights/utils/patternDetection.ts`

**Problem**

Mood analytics are split across chart UI, a service module, and an insights hook. The deletion test is revealing: deleting `analyticsService` would not remove much complexity because key behavior remains in `ChartComponents` and `useInsightsData`. The module is shallow, while the actual mood-pattern rules are scattered.

**Solution**

Move mood aggregation, period filtering, streaks, trend math, pattern detection, and mood-scale interpretation into one deeper mood insights module. UI modules should render results, not own calculations.

**Benefits**

Locality improves for the inverted mood scale rule, period semantics, and chart aggregation. Leverage improves because Home, Insights, Charts, Therapy Export, and Settings can reuse the same tested behavior. Tests can target one interface with fixture mood histories instead of testing UI-adjacent helpers.

## 2. Deepen Mood Entry Workflows

**Files**

- `src/services/moodService.ts`
- `src/shared/state/moodsStore.ts`
- `src/app/(tabs)/index.tsx`
- `src/hooks/useMoodItemActions.ts`

**Problem**

`moodService` mostly mirrors repository functions, so callers still need to know workflow details: refresh after timestamp update, local restore behavior, undo behavior, migration side effects, and when to reload. Some UI code still imports `@db/db` directly, which conflicts with the project constraint to go through service-layer modules.

**Solution**

Deepen the mood entry workflow module so create, edit, reschedule, delete, restore, and load-history are coherent operations with cache/store updates and persistence rules behind the seam.

**Benefits**

Locality improves because mood entry mutation rules stop spreading across Home, hooks, stores, and repositories. Leverage improves because UI callers get user-level operations instead of composing low-level steps. Tests can verify full workflows against a fake adapter, including undo and timestamp edits.

## 3. Consolidate Settings Storage

**Files**

- `src/services/settingsService.ts`
- `src/lib/entrySettings.ts`
- `src/shared/state/settingsStore.ts`

**Problem**

Settings parsing and defaults exist in both `settingsService` and `entrySettings`. The settings store bypasses `settingsService` and mixes storage keys, global haptics side effects, and presets. This creates a shallow service and weak locality for preference migration behavior.

**Solution**

Make the settings module own persistence, defaults, parsing, and migration. The store should hydrate from that module and update through it.

**Benefits**

Locality improves for corrupted storage handling, default preference changes, and future privacy-sensitive settings. Leverage improves because settings screens, entry modals, and export preferences share one behavior source. Tests can cover storage parsing once instead of through multiple near-duplicates.

## 4. Deepen Data Portability

**Files**

- `src/app/settings/data.tsx`
- `db/moods/importExport.ts`
- `db/backup.ts`
- `src/features/settings/components/ExportModal.tsx`

**Problem**

Data portability is a user-facing privacy promise, but the workflow crosses UI, database import/export, backup folder logic, filesystem access, and summary text. The seam is unclear: UI code knows too much about document picking, backup state, import result shaping, and alert summaries.

**Solution**

Deepen a data portability module that owns export ranges, import validation summaries, backup metadata, and manual backup operations. Platform file picking can remain an adapter at the edge.

**Benefits**

Locality improves around local-only data handling and backup semantics. Leverage improves because settings, developer tools, background backups, and therapy export can share the same tested workflow. Tests can validate import/export/backup outcomes without rendering settings screens.

## 5. Deepen Mood Scale Interpretation

**Files**

- `src/constants/moodScale.ts`
- `src/components/charts/ChartComponents.tsx`
- `src/features/insights/hooks/useInsightsData.ts`
- `src/components/DisplayMoodItem.tsx`

**Problem**

Callers repeatedly know how to round mood values, map Tailwind classes to hex colors, pick labels, and account for "lower is better." This is a shallow constant table with too much interface knowledge leaking into callers.

**Solution**

Deepen the mood scale module so callers ask for display and semantic interpretation of a mood value instead of manually combining constants.

**Benefits**

Locality improves for the inverted mood scale and color semantics. Leverage improves across lists, calendar, charts, accessibility labels, and insights. Tests become small and stable: mood value in, interpretation out.

## 7. Preserve Historical Emotions Unless the User Updates History

**Files**

- `src/services/moodService.ts`
- `src/services/emotionService.ts`
- `db/moods/emotions.ts`
- `db/moods/emotionUtils.ts`
- `src/features/settings/components/EmotionListEditor.tsx`
- Emotion repository tests

**Problem**

The domain rule is that renaming or deleting an **Emotion** from the **Emotion List** affects future selection by default. Existing **Mood Entries** are snapshots; renames should change history only through a user-approved **Historical Update**, and deletes should not remove historical values. The current service/repository path appears to remove deleted emotions from historical entries through `removeEmotionFromMoods`, which erases past labels and changes historical interpretation.

**Solution**

Change emotion list edits so the **Emotion** is renamed or removed from future selection while existing entries keep their historical label by default. If the person explicitly chooses a **Historical Update** during rename, apply the rename to existing **Mood Entries** as a deliberate workflow. Deletes should not bulk-remove historical values. If the storage model needs it, introduce an archived/inactive state for selectable emotions instead of deleting or detaching historical references.

**Benefits**

Mood history remains stable and trustworthy. Users can clean up their selectable **Emotion List** without accidentally changing previous **Mood Entries**, while still having an explicit path for intentional historical corrections.

## 8. Preserve Historical Context Tags Unless the User Updates History

**Files**

- `src/services/settingsService.ts`
- `src/lib/entrySettings.ts`
- `src/features/settings/components/ListEditor.tsx`
- `src/features/settings/sections/EntryCustomizationSection.tsx`
- Context tag persistence and mood entry tests

**Problem**

The domain rule is that renaming or deleting a **Context Tag** from the **Context Tag List** affects future selection by default. Existing **Mood Entries** are snapshots; renames should change history only through a user-approved **Historical Update**, and deletes should not remove historical values. The current code needs a clear workflow for distinguishing future-only list edits from intentional historical corrections.

**Solution**

Make **Context Tag List** editing explicit about future-only renames versus a user-approved **Historical Update**. Implement or verify that default renames and removals leave existing **Mood Entries** untouched, that rename can intentionally update history, and that deletes never bulk-remove historical values.

**Benefits**

The person's mood history keeps its original context even as the selectable **Context Tag List** changes. Insights and exports remain stable because historical observations are not accidentally changed by list maintenance.

## 9. Prepare Mood Ratings for Future Mood Scale Versioning

**Files**

- `db/types.ts`
- `db/moods/schema.ts`
- `db/moods/repository.ts`
- `src/constants/moodScale.ts`
- `src/services/analyticsService.ts`
- `src/features/insights/utils/patternDetection.ts`
- import/export and backup serialization tests

**Problem**

The current version uses a fixed **Mood Scale** of 0-10 where lower values are better, but the domain model allows the **Mood Scale** range and direction to become modifiable later. A historical **Mood Rating** must be interpreted against the **Mood Scale** that existed when its **Mood Entry** was created, not against whatever scale is current later. The current storage model only persists the numeric `mood` value, which will not be enough once scales can change.

**Solution**

Before configurable **Mood Scales** ship, introduce a way for each **Mood Entry** to retain or reference the **Mood Scale** used when the **Mood Rating** was created. Update analytics, insights, charts, import/export, backups, and therapy exports to interpret historical ratings using their original scale metadata. Ensure **Data Export** and **Backup** preserve the full database state needed for exact restoration, and ensure **Therapy Export** includes enough **Mood Scale** context for exported **Mood Ratings** to be interpreted outside the app.

**Benefits**

Historical mood data remains interpretable after scale changes. Future scale customization can be introduced without corrupting old **Statistics**, **Patterns**, **Insights**, or exported data.

## 10. Align Backup and Data Export Terminology

**Files**

- `src/app/settings/data.tsx`
- `db/backup.ts`
- `src/features/settings/components/ExportModal.tsx`
- `src/lib/entrySettings.ts`
- `PRIVACY_POLICY.md`
- `TERMS_OF_SERVICE.md`
- In-app settings legal/about screens

**Problem**

The domain boundary is that **Data Export** is a manually initiated full database export, while **Backup** is an automatic full database export for recovery. Any "manual backup" wording blurs that distinction and makes it harder to reason about user intent, privacy language, and recovery behavior.

**Solution**

Audit user-facing copy, function names, settings labels, and legal text for "backup" and "manual backup" wording. Rename manual full-database export flows to **Data Export** and reserve **Backup** for automatic recovery exports. Keep legal documents and in-app settings screens synchronized if copy changes affect data storage or sharing promises.

**Benefits**

Users get clearer language about what is automatic versus user-initiated. Developers get cleaner boundaries for export, backup scheduling, recovery, and privacy-sensitive copy.

# Google Play Store Readiness Issues

Generated from a publish-readiness pass on 2026-04-29.

These are release-blocking or release-sensitive issues to resolve before submitting the Android app to Google Play.

## 13. Align Expo SDK Package Versions

**Status: Resolved on 2026-05-03.**

Updated the Expo SDK 55 package set in `package.json` and `bun.lock`, then rebuilt `node_modules` from the refreshed lockfile. Verification now passes:

- `bunx expo install --check`
- `bunx expo-doctor`
- `bun run lint`
- `bunx tsc --noEmit`

**Files**

- `package.json`
- `bun.lock`
- `app.json`
- `eas.json`

**Problem**

# Local Build Report

Generated from a successful local Android preview build on 2026-05-02.

Artifact:

- `build-1777724151485.apk`

## Build Outcome

- Build succeeded.
- No terminal errors were reported at the end of the build.

## Build Warnings

### 1. Expo Doctor dependency mismatch check failed

**Problem**

`expo doctor` reported `17/18` checks passed and failed `Check that packages match versions required by installed Expo SDK`. It listed 29 outdated packages, including `expo`, many `expo-*` modules, `react-native`, and `react-native-worklets`.

**Impact**

The APK still built successfully, but the project is drifting from the SDK 55 expected patch set. That increases risk of runtime bugs, build instability, and future upgrade friction.

**Suggested fix**

Run `npx expo install --check`, then align the reported packages to the versions expected by the installed Expo SDK.

### 2. Deprecated Android status bar config

**Problem**

Expo prebuild warned that `androidStatusBar.translucent` is deprecated due to Android edge-to-edge enforcement and has no effect.

**Files**

- `app.json`

**Impact**

No current build failure, but the config is dead and will be removed in a future Expo release.

**Suggested fix**

Remove `androidStatusBar.translucent` from app config and rely on current edge-to-edge patterns.

### 3. Missing environment configuration during build

**Problem**

The build reported:

- no preview EAS environment variables configured
- `ANDROID_NDK_HOME` not set
- `NODE_ENV` not set, so Expo continued without mode-specific `.env`

**Impact**

These did not block the build, but they make the build environment less explicit and can hide configuration drift between local, CI, and release builds.

**Suggested fix**

- Define preview env vars in EAS if they are expected.
- Set `NODE_ENV` explicitly for local build scripts if env-dependent config matters.
- Only set `ANDROID_NDK_HOME` if the project needs a fixed local NDK path outside the SDK-managed flow.

### 4. Gradle deprecation warning

**Problem**

Gradle reported:

- `Deprecated Gradle features were used in this build, making it incompatible with Gradle 10.`

It also emitted a problems report during the temporary EAS build at:

- `android/build/reports/problems/problems-report.html` inside the temporary build directory

**Impact**

The current build works, but future Gradle upgrades may break the project or its plugins.

**Suggested fix**

Run a build with `--warning-mode all` in the Android project and triage whether the deprecations come from app code, Expo tooling, or third-party dependencies.

### 5. Android manifest merge warnings in app module

**Problem**

At the end of the Gradle run, the app manifest emitted:

- `provider#expo.modules.filesystem.FileSystemFileProvider@android:authorities was tagged ... to replace other declarations but no other declaration present`
- `activity#expo.modules.imagepicker.ExpoCropImageActivity@android:exported was tagged ... to replace other declarations but no other declaration present`

**Impact**

These did not fail the build, but they indicate manifest override directives that are not currently replacing anything. That can signal stale or unnecessary manifest merge config.

**Suggested fix**

Inspect the generated Android manifest merge inputs and remove or simplify redundant `tools:replace` usage if it is not needed.

### 6. Third-party Android manifest namespace warnings

**Problem**

Several dependencies emitted warnings that `package="..."` in source `AndroidManifest.xml` is no longer used to define namespace, including:

- `@react-native-async-storage/async-storage`
- `react-native-haptic-feedback`
- `react-native-safe-area-context`
- `react-native-vector-icons`
- `@shopify/react-native-skia`

**Impact**

These are dependency-level warnings, not app-code failures. They indicate ecosystem lag against newer Android Gradle Plugin expectations.

**Suggested fix**

Track upstream package releases and upgrade when patched versions remove these manifest warnings.

### 7. Third-party Kotlin/Java deprecation noise

**Problem**

The build emitted many deprecation and unchecked-operation warnings from dependencies, especially:

- `react-native-pager-view`
- `react-native-safe-area-context`
- `react-native-webview`
- `react-native-screens`
- `react-native-gesture-handler`
- `react-native-worklets`
- `react-native-reanimated`
- `expo-modules-core`
- `expo`
- `expo-constants`
- `@shopify/react-native-skia`

Common warning themes:

- deprecated React Native Android APIs
- deprecated Android platform APIs
- deprecated Kotlin interop patterns
- unchecked casts / unsafe operations

**Impact**

No immediate build breakage, but these warnings make future RN/AGP/Gradle upgrades riskier and make real regressions harder to spot in build logs.

**Suggested fix**

Prefer package upgrades first. Only patch locally if a dependency warning becomes release-blocking.

### 8. Repeated NO_COLOR / FORCE_COLOR warning

**Problem**

Node repeatedly logged:

- `The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.`

**Impact**

Harmless, but noisy.

**Suggested fix**

Normalize local build environment variables so only one of `NO_COLOR` or `FORCE_COLOR` is set.

### 9. Bundler cache cold-start warning

**Problem**

During Gradle asset bundling, Metro reported:

- `warning: Bundler cache is empty, rebuilding (this may take a minute)`

**Impact**

Not a correctness issue. It only affects build time.

**Suggested fix**

None required unless local build performance becomes a problem.

## Side Effects Observed

- Running `bun run build` also ran the `prebuild` script and bumped the app version from `1.2.0` to `1.3.0`.

`npx expo-doctor` fails because many Expo SDK 55 packages are behind the versions expected by the installed SDK. This includes core runtime/build packages such as `expo`, `react-native`, `expo-router`, `expo-notifications`, `expo-sqlite`, `expo-file-system`, and `jest-expo`.

**Solution**

Run `npx expo install --check`, upgrade the mismatched packages to SDK-compatible versions, refresh the lockfile, and rerun `npx expo-doctor`. Re-test SQLite, notifications, file import/export, backups, app lock, and navigation after the version alignment.

**Benefits**

The production build uses a dependency set Expo expects, reducing risk of native build failures, Play Store crashes, and subtle Expo module incompatibilities.

## 15. Make Automatic Backup Behavior Match the UI

**Files**

- `src/app/_layout.tsx`
- `src/app/settings/data.tsx`
- `db/backgroundBackup.ts`
- `db/backup.ts`
- `PRIVACY_POLICY.md`
- `TERMS_OF_SERVICE.md`
- In-app privacy and terms screens

**Problem**

The Settings UI presents **Automatic Backups**, but background backup registration is disabled in the app layout due to an `expo-task-manager` / New Architecture compatibility issue. This creates a product mismatch: users may believe automatic recovery exports are running when only manual backup/export behavior may be available.

**Solution**

Either re-enable and verify background backup registration on Android release builds, or change the UI/legal copy to avoid promising automatic backups. If automatic backups remain, add release testing for folder selection, permission persistence, task registration, backup creation, and backup cleanup.

**Benefits**

The app does not overpromise data recovery behavior, and the backup feature can be trusted in a privacy-sensitive product.

## 19. Clean Release Verification Warnings

**Status: Resolved on 2026-05-03.**

`bun run lint` now completes without warnings after the current release-cleanup changes. TypeScript also passes with `bunx tsc --noEmit`.

**Files**

- `src/app/notifications/[id].tsx`
- `src/components/HapticTab.tsx`
- `src/components/NoteModal.tsx`
- `src/components/charts/ChartComponents.tsx`
- `src/components/charts/DailyTab.tsx`
- `src/components/charts/OverviewTab.tsx`
- `src/components/entry/LocationPicker.tsx`
- `src/components/entry/SameAsYesterdayButton.tsx`
- `src/components/entry/VoiceMemoRecorder.tsx`
- `src/lib/haptics.ts`
- `src/shared/state/moodsStore.ts`

**Problem**

`bun run lint` passes but reports warnings for unused variables, hook dependency arrays, missing component display names, and require-style imports. Warnings are not all release blockers, but hook dependency warnings in notification and modal code can hide stale-state bugs.

**Solution**

Fix the warnings that affect runtime correctness first, especially hook dependency warnings. Then clean unused variables and import style warnings or intentionally document why they are safe.

**Benefits**

The release branch has a cleaner signal-to-noise ratio, and future lint warnings are more likely to represent real regressions.
