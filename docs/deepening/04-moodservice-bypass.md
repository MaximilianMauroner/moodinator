# Deepening #4 — Insights and Calendar bypass the moodService seam

**Status: not started**

## What is wrong

`moodService` exists as a typed seam between UI code and the database, but
several screens and hooks import directly from `@db/db`, bypassing it entirely.
Each bypass creates its own copy of the **Mood Entry** array in local `useState`.

The result is disconnected state: a **Mood Entry** created on the Home screen
(through `useMoodsStore`) is not reflected in the Insights screen or the
Calendar until those screens trigger their own fresh DB fetch. Because the
fetches are independent, there is no shared invalidation.

**Direct DB imports that bypass `moodService`:**

| File | Function imported | Why it bypasses |
|---|---|---|
| `src/features/insights/hooks/useInsightsData.ts` | `getAllMoods` | No service method for "all moods" fit for insights |
| `src/components/calendar/useCalendarData.ts` | `getMoodsByMonth` | No service method for month-scoped query |
| `src/features/settings/screens/SettingsScreen.tsx` | `getAllMoods` | Convenience; no reason to bypass |
| `src/app/therapy-export.tsx` | `getMoodsWithinRange` | No service method for range query |
| `src/features/settings/components/ExportModal.tsx` | `exportMoods` | Export utility, more defensible |
| `src/app/settings/developer.tsx` | `clearMoods`, `seedMoods` | Dev tools, defensible |

The first three are the main friction. The export and developer cases are
defensible bypasses.

## Files

| File | Role |
|---|---|
| `src/services/moodService.ts` | Typed seam; missing several filtered-query methods |
| `db/moods/repository.ts` | Implements the actual SQL queries |
| `src/features/insights/hooks/useInsightsData.ts` | Calls `getAllMoods` directly |
| `src/components/calendar/useCalendarData.ts` | Calls `getMoodsByMonth` directly |
| `src/features/settings/screens/SettingsScreen.tsx` | Calls `getAllMoods` directly |
| `src/app/therapy-export.tsx` | Calls `getMoodsWithinRange` directly |

## Candidate direction

Add the missing methods to `moodService` and route the three non-defensive
bypasses through it:

```ts
// New methods on moodService:
getByMonth(year: number, month: number): Promise<MoodEntry[]>
getInRange(from: number, to: number): Promise<MoodEntry[]>
```

`SettingsScreen.tsx` can use the existing `moodService.getAll()`.

The Insights hook and Calendar hook both maintain their own local `useState`
for the mood array. After routing through the service, the question of shared
invalidation remains open (see below).

## Expected benefits

- **Locality**: all DB access policy (error handling, type coercion, query
  routing) lives at one seam.
- **Leverage**: adding a second adapter (e.g. in-memory mock for tests) becomes
  possible without touching hooks. Currently mocking the DB layer for hook
  tests requires mocking `@db/db` at the module level.
- **Seam integrity**: the service seam becomes real rather than hypothetical.
  At one adapter it is a convention; at two adapters it is a real seam.

## Decisions still needed

- **Should `getAllMoods` still exist on the repository after this change?**
  It is still needed by `moodService.getAll()`. But the name is a footgun —
  it invites direct import. Consider whether the repository methods should be
  unexported (module-private) after all callers go through the service.

- **Should the Insights hook still own its own `allMoods` array?**
  Routing through `moodService` does not eliminate the disconnected copies —
  each hook still calls its own fetch and stores the result locally. A deeper
  fix would be to have `useMoodsStore` own all in-memory **Mood Entries** and
  have the Insights hook select from that. But that is a larger change that
  depends on whether `useMoodsStore` ever loads all moods (currently it paginates).

- **Should the Calendar use the store or its own fetch?**
  The Calendar queries by month; the store loads a paginated recent window.
  If the store's window does not cover the viewed month, the Calendar needs its
  own fetch. This is a reasonable design, but the direct DB import should still
  become a service call.

- **What is the error-handling contract at the service seam?**
  The repository throws on SQL errors; the service currently lets those
  propagate. Should the service catch and wrap DB errors, or pass them through?

- **Should `getMoodsWithinRange` in `therapy-export.tsx` be added to the
  service?** It is used only for **Therapy Export** generation. Options: add
  `getInRange` to the service, or create a `therapyExportService` that owns
  the export logic and makes a single service call internally.
