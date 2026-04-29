# Deepening #5 — Emotion migration bootstrap living inside the Home screen

**Status: not started**

## What is wrong

`src/app/(tabs)/index.tsx` (the Home screen) contains ~40 lines of emotion
migration orchestration inside a `useEffect`:

- Reads a migration-complete flag from AsyncStorage
- If not migrated, reads the current **Emotion List** from AsyncStorage
- Converts string-array format to object format
- Writes the result back to AsyncStorage
- Updates `useSettingsStore`
- Handles retry logic for failed reads

This runs every time the Home screen mounts. It is not a Home screen concern.
The Home screen's job is to display **Mood Entries** and accept new ones.

Deletion test: if you removed this block, the migration would stop running —
but the complexity would not disappear, it would surface as a regression for
users on old data formats. The block was earning its keep. It is in the wrong
place, not unnecessary.

A second problem: if the user navigates directly to a Settings screen before
mounting Home (unlikely but possible), the migration never runs. The migration
should not depend on which screen the user visits first.

## Files

| File | Role |
|---|---|
| `src/app/(tabs)/index.tsx` | Lines ~172–215: emotion migration effect |
| `src/lib/entrySettings.ts` | `parseEmotionList` — the parser the migration uses |
| `src/shared/state/settingsStore.ts` | `setEmotions` — the store updater called after migration |
| `db/client.ts` | `initializeDatabase` — the existing app bootstrap entry point |
| `src/app/_layout.tsx` | Root layout — the natural place for app-startup concerns |

## Candidate direction

Move the migration into the app bootstrap path, either in `_layout.tsx`'s
startup effect or as a step inside/alongside `initializeDatabase`.

A dedicated `runMigrations` (or `runSettingsMigrations`) function could be
called once at app startup, before any screen mounts. The Home screen's
`useEffect` is deleted.

```ts
// src/lib/settingsMigrations.ts
export async function runSettingsMigrations(): Promise<void> {
  const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
  if (alreadyMigrated) return;
  // ... parse and rewrite emotion list ...
}
```

Called once in `_layout.tsx`:
```ts
useEffect(() => {
  runSettingsMigrations();
}, []);
```

## Expected benefits

- **Locality**: migration logic has one home and runs once, predictably, before
  any screen mounts.
- **Leverage**: the Home screen interface shrinks to its actual job. No screen
  needs to know about data format history.
- **Correctness**: migration runs regardless of navigation order.

## Decisions still needed

- **Should migrations be synchronous or awaited before navigation?**
  If the app renders screens before the migration completes, a screen might
  read the old **Emotion List** format before the migration writes the new one.
  Options: block navigation until migration completes (add a loading gate in
  `_layout.tsx`), or make the store tolerant of both formats so the migration
  becoming a background cleanup.

- **Where exactly does the bootstrap live?**
  Options:
  1. Inside `initializeDatabase` in `db/client.ts` (keeps all startup in one
     place, but mixes storage concerns with SQLite concerns)
  2. A separate `runSettingsMigrations` called from `_layout.tsx`
  3. Part of the `useSettingsStore` initialisation action (migration happens
     when the store hydrates)

- **Should migration be versioned?**
  The current flag is a single boolean. If a second migration is added later,
  a version number (e.g. `SETTINGS_MIGRATION_V=2`) would be safer than a
  boolean. Worth deciding at the same time as the move.

- **What happens if the migration fails?**
  The current code silently catches errors and logs them. Should a failed
  migration surface a user-visible message, or stay silent and retry on next
  launch?

- **Is this the only settings migration, or are there others?**
  Check for similar patterns elsewhere in the codebase before designing the
  abstraction. One migration might not warrant a full versioned migration
  runner.
