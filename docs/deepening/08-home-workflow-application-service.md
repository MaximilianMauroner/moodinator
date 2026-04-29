# Deepening #8 — The Home tab is acting as the real Mood Entry application service

**Status: not started**

## What is wrong

`src/app/(tabs)/index.tsx` currently owns too much of the **Mood Entry**
workflow:

- loading and refreshing **Mood Entries**
- creating **Quick Entry** and **Detailed Entry** submissions
- editing existing **Mood Entries**
- updating timestamps
- undo and restore behavior
- coordinating modal state with persistence actions
- triggering migration bootstrap behavior

The helper hooks around it are thin and inconsistent. `useMoodModals` mostly
holds UI state. `useMoodItemActions` still depends on screen-owned setters and
even accepts a no-op `setLastTracked`, which is a clear sign that the current
seam does not match the real workflow ownership.

`useMoodsStore` owns part of the behavior, `moodService` owns thin persistence
helpers, and the screen stitches the rest together. That makes the Home tab the
real application service for **Mood Entry** work even though it is supposed to
be just a screen.

Deletion test: if you deleted the orchestration logic from the screen, the app
would immediately lose core workflow behavior. The complexity is real and
load-bearing. It should live behind a deeper seam than a tab screen.

## Files

| File | Role |
|---|---|
| `src/app/(tabs)/index.tsx` | Screen currently orchestrates the main **Mood Entry** workflow |
| `src/shared/state/moodsStore.ts` | Owns part of the in-memory **Mood Entry** state and CRUD updates |
| `src/hooks/useMoodItemActions.ts` | Thin action helper with awkward setter dependencies |
| `src/hooks/useMoodModals.ts` | Modal state helper |
| `src/services/moodService.ts` | Persistence seam, but mostly shallow |

## Candidate direction

Create a dedicated **Mood Entry workflow** module that owns the application
behavior for the Home tab.

Possible responsibilities:

- loading and invalidating the active **Mood Entry** list
- creating **Quick Entry** and **Detailed Entry** submissions
- editing and deleting **Mood Entries**
- undo/restore flows
- timestamp-change flows
- exposing screen-ready commands and derived state

Possible interface shape:

```ts
loadMoodEntries()
createQuickEntry(values)
createDetailedEntry(values)
editMoodEntry(id, values)
deleteMoodEntry(id)
restoreMoodEntry(snapshot)
changeMoodEntryTimestamp(id, timestamp)
```

The screen would then focus on presentation:

- render the list
- show modals
- wire UI events to workflow commands

The workflow module could sit on top of `moodService` and `useMoodsStore`, or
it could absorb part of the store. The important part is that the sequencing
rules stop living in `index.tsx`.

## Expected benefits

- **Locality**: workflow bugs around create/edit/delete/undo/timestamp changes
  land in one module instead of being split between the screen, hooks, and
  store.
- **Leverage**: the Home screen gets a much smaller interface and stops
  managing persistence order directly.
- **Testability**: workflow behavior can be tested through one interface
  without mounting the full tab screen.
- **Extensibility**: future changes to **Quick Entry**, **Detailed Entry**, or
  undo behavior have a single seam to attach to.

## Decisions still needed

- **Where should the workflow module live?**
  Options: a hook in `src/features/home`, a store-backed module, or a deeper
  service above `moodService`. The key is to avoid another thin wrapper.

- **What is the relationship between the workflow module and `useMoodsStore`?**
  The store already owns in-memory **Mood Entries**. Either the workflow module
  becomes the store's command surface, or the store becomes an implementation
  detail behind it.

- **Should Quick Entry and Detailed Entry remain separate commands?**
  Domain-wise both create a **Mood Entry**, but the workflow rules and analytics
  around the two entry paths may diverge later.

- **Does migration bootstrap belong here?**
  Probably not. The Home screen currently runs emotion migration work, but that
  should move to app bootstrap rather than being absorbed into the workflow
  module.

- **What is the undo contract?**
  Does undo restore only immediately deleted **Mood Entries**, or should the
  workflow module support a more general optimistic action model? This affects
  how much state the module needs to retain.
