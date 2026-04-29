# Deepening #2 — Settings is not a module yet; it is a set of parallel seams

**Status: Done** — implemented 2026-04-29

## What is wrong

`useEntrySettings` and `useSettingsStore` both parse the same AsyncStorage
keys into separate in-memory copies of the **Emotion List**, **Context Tag
List**, and **Entry Customization** preferences. They are not connected.
`settingsService` overlaps with both, and `entrySettings.ts` still acts as a
storage adapter instead of staying a pure defaults/parsing module.

The Home screen reads through `useEntrySettings` (via
`src/hooks/useEntrySettings.ts` → `src/lib/entrySettings.ts`). The Settings
screen writes through `useSettingsStore`
(`src/shared/state/settingsStore.ts`). `settingsService.ts` exposes yet
another overlapping interface for the same settings. A change made in Settings
is only reflected in Home after a re-focus event triggers a fresh
AsyncStorage read in `useEntrySettings`. If the user edits an **Emotion** name
and immediately navigates back without a focus cycle, the Home screen still
shows the old name.

The deeper problem is that there is no single settings module. Callers need to
know too much about where defaults live, which parser is authoritative, and
whether the current source of truth is the Zustand store, a hook-local copy, a
service method, or raw helper functions.

Deletion test: if you deleted `useEntrySettings` and replaced it with a
selector over `useSettingsStore`, the complexity would not grow — it would
shrink. Likewise, deleting `settingsService` today would not reintroduce much
complexity in callers because its interface is not the real seam yet. These
modules are currently adding surface area without earning it.

## Files

| File | Role |
|---|---|
| `src/lib/entrySettings.ts` | Parses AsyncStorage keys, applies defaults, provides utility functions |
| `src/hooks/useEntrySettings.ts` | Re-reads AsyncStorage on every focus, puts result in local `useState` |
| `src/shared/state/settingsStore.ts` | Zustand store: loads the same keys on init, exposes setters |
| `src/services/settingsService.ts` | Partially overlaps; also parses same keys |
| `src/app/(tabs)/index.tsx` | Consumes `useEntrySettings` for the **Quick Entry** form |
| `src/features/settings/screens/SettingsScreen.tsx` | Writes through `useSettingsStore` |
| `src/app/therapy-export.tsx` | Reads and writes therapy export preferences through `entrySettings.ts` instead of the same runtime seam |

## Candidate direction

Make one runtime module the single source of truth for all persisted settings.
That may still be `useSettingsStore`, but the important decision is that the
other interfaces stop acting as competing seams.

- `lib/entrySettings.ts` becomes a **pure parsing/defaults module** — it reads
  no storage, writes no storage, and has no side effects. It provides
  `parseEmotionList`, default constants, and similar helpers that the canonical
  settings module calls once on initialisation.
- `useEntrySettings` becomes a selector over `useSettingsStore` (or is deleted
  entirely if its callers switch directly to store selectors).
- `settingsService.ts` either becomes the single storage adapter that the
  canonical settings module calls, or it is deleted. It should not continue as
  a parallel interface.
- All AsyncStorage reads and writes flow through the canonical settings module
  and one storage adapter beneath it.

The store already initialises from AsyncStorage on mount. The missing piece is
ensuring every write also updates the in-memory state and that all screens
subscribe to that state rather than doing their own reads.

## Expected benefits

- **Locality**: the **Emotion List**, **Context Tag List**,
  **Entry Customization**, and therapy export preferences live in one place.
  An edit in Settings is immediately visible everywhere without a focus cycle.
- **Leverage**: callers stop managing re-fetch timing and no longer need to
  know which helper or store owns which key. The module handles it.
- **Testability**: `entrySettings.ts` becomes a set of pure functions that can
  be tested without mocking AsyncStorage.

## Decisions

- **`settingsService.ts` → delete.** Deletion test passes: its parsing logic
  moves to `entrySettings.ts` (already the right home), its storage calls are
  thin enough to inline in the store. No caller loses leverage.

- **Initialisation contract → block navigation.** `_layout.tsx` already gates
  on `lockHydrated && onboardingHydrated` behind `AppBootSplash`. Add
  `settingsHydrated` to that conjunction. `hydrate()` is called once, in the
  same bootstrap `useEffect`, before the tab navigator renders. Individual
  settings screens drop their own `hydrate()` calls.

- **`useEntrySettings` → keep as a thin selector.** No `useFocusEffect`, no
  AsyncStorage. Reads from `useSettingsStore`. Preserves call-site
  compatibility for `src/app/(tabs)/index.tsx` and retains the
  `quickEntryFieldConfig` / `detailedFieldConfig` presentation computations
  which are a Home screen concern, not a store concern.

- **Key constants → all in `src/shared/storage/keys.ts`.** Move
  `EMOTION_PRESETS_KEY`, `CONTEXT_TAGS_KEY`, `QUICK_ENTRY_PREFS_KEY`,
  `THERAPY_EXPORT_PREFS_KEY` from `entrySettings.ts`, and `HAPTICS_ENABLED_KEY`
  from `settingsService.ts`, to join `SHOW_LABELS_KEY` and `DEV_OPTIONS_KEY`
  which already live there. Key strings are storage infrastructure, not domain
  logic.

- **Write order → optimistic.** Store state updates immediately (UI responds
  without delay); storage write fires async with no rollback. AsyncStorage
  failures on device are effectively impossible; silent divergence on the
  next cold launch is an accepted risk.

- **`therapyExportPrefs` → out of scope.** `therapy-export.tsx` reads and
  writes those prefs directly through `entrySettings.ts` and is self-contained
  (no other screen subscribes to therapy export prefs). Forcing it through the
  store adds a subscription for a value with no subscribers. Intentional gap —
  the store's type should carry a comment noting this.

## Implementation plan

### Step 1 — `src/shared/storage/keys.ts`
Add the five keys that are currently scattered elsewhere:
`EMOTION_PRESETS_KEY`, `CONTEXT_TAGS_KEY`, `QUICK_ENTRY_PREFS_KEY`,
`THERAPY_EXPORT_PREFS_KEY` (from `entrySettings.ts`) and `HAPTICS_ENABLED_KEY`
(from `settingsService.ts`).

### Step 2 — `src/lib/entrySettings.ts` → pure module
Remove all `async` functions and `AsyncStorage` imports. Keep and **export**:
- Types: `QuickEntryPrefs`, `TherapyExportPrefs`, `TherapyExportField`
- Constants: `DEFAULT_EMOTIONS`, `DEFAULT_CONTEXTS`, `DEFAULT_QUICK_ENTRY_PREFS`,
  `DEFAULT_THERAPY_EXPORT_PREFS`
- Pure parsing functions (currently private/duplicated): `parseEmotionList`,
  `parseStringList`, `sanitizeTherapyFields`

Key constants (`EMOTION_PRESETS_KEY` etc.) move to `keys.ts` (Step 1).

### Step 3 — `src/shared/state/settingsStore.ts`
Rewrite `hydrate()` to call `getJson`/`getBoolean` directly, using the pure
parsing functions from `entrySettings.ts`. Add `HAPTICS_ENABLED_KEY` import
from `keys.ts`. Rewrite all setters to be optimistic: call `set(...)` first,
then fire the storage write with `void`. Add a comment on the `SettingsStore`
type noting that `therapyExportPrefs` is intentionally absent (managed locally
by `therapy-export.tsx`).

### Step 4 — `src/hooks/useEntrySettings.ts`
Replace body entirely. No `useState`, no `useFocusEffect`, no AsyncStorage.
Read `emotions`, `contexts`, `quickEntryPrefs`, `showDetailedLabels` from
`useSettingsStore`. Compute `quickEntryFieldConfig` with `useMemo`.
`detailedFieldConfig` becomes a module-level constant (it never changes).

### Step 5 — `src/app/_layout.tsx`
Import `useSettingsStore`. Add `hydrateSettings` to the existing bootstrap
`useEffect` alongside `hydrateLock` and `hydrateOnboarding`. Include
`settingsHydrated` in the `hydrated` conjunction.

### Step 6 — Settings screens: drop individual `hydrate()` calls
The following screens call `hydrate()` in their own `useEffect` — remove those
calls (the store is guaranteed warm by the time they mount):
- `src/app/settings/quick-entry.tsx`
- `src/app/settings/display.tsx`
- `src/app/settings/contexts.tsx`
- `src/app/settings/developer.tsx`
- `src/app/settings/emotions.tsx`

### Step 7 — Delete `src/services/settingsService.ts`

### Tests to write
- `entrySettings.test.ts`: pure unit tests over `parseEmotionList` (old string
  format, new object format, mixed, empty array, invalid items), `parseStringList`
  (empty, valid, mixed), `sanitizeTherapyFields` (valid fields, unknown fields,
  empty). No mocks needed.
- `settingsStore.test.ts`: mock `getJson`/`getBoolean`/`setJson`/`setBoolean`.
  Test `hydrate()` populates all fields. Test each setter updates state
  immediately (optimistic) and fires the storage call.
