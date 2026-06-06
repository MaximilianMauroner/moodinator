# Moodinator Issues

Vertical-slice issues generated from the 2026-04-29 architecture pass, the 2026-04-29 Google Play readiness pass, the 2026-05-02 local build report, and the 2026-05-26 thermo-nuclear code quality review. Each slice is sized to be independently grabbable.

Legend: **AFK** = can ship without a human-in-the-loop decision. **HITL** = needs a design or product call first.

Ordering: priority — P0 (release-blocking or active data-loss) first, then data-integrity follow-throughs, then foundational architecture, then HITL design follow-ups, then build/config cleanup, then monitoring.

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
- #27 (Historical Update writes need an atomic backend command first)

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
