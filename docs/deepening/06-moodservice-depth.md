# Deepening #6 — moodService is mostly a shallow pass-through

**Status: not started**

## What is wrong

Most methods on `moodService` are one-line delegations to the repository with
no added behaviour:

```ts
async getAll(): Promise<MoodEntry[]> {
  return getAllMoods();          // pass-through
}
async delete(id: number): Promise<void> {
  await deleteMood(id);         // pass-through
}
async update(...): Promise<void> {
  await updateMood(...);        // pass-through
}
```

Deletion test: delete the pass-through methods and the callers call the
repository directly — complexity does not concentrate, it disperses very
slightly. The service is not earning depth for these methods.

There is a real bug hiding inside the thin interface: `getLastEntry` calls
`getAllMoods()` (a full table scan) and returns the first result. At scale this
is a performance problem dressed up as a convenience method.

The methods that do earn their keep: `getToday`, `getYesterday`, and
`getLastEntry` (despite the bug) — these encapsulate date math that would
otherwise leak into callers.

## Files

| File | Role |
|---|---|
| `src/services/moodService.ts` | 247 lines; ~15 methods; most are pass-throughs |
| `db/moods/repository.ts` | Raw SQL; the actual implementation |

## Candidate direction: deepen rather than delete

Rather than deleting the service, deepen it so the pass-throughs become real
depth. Candidates for what should live at the service seam:

**Fix the `getLastEntry` bug:**
Add a `getLastEntry` query to the repository that uses `ORDER BY timestamp DESC LIMIT 1`
instead of a full table scan.

**Push cache invalidation behind the seam:**
Currently `useMoodsStore` manages its own in-memory cache and the service
knows nothing about it. If the service owned invalidation signals (or if the
store subscribed to service events), callers would not need to manually
coordinate cache state.

**Centralise error handling:**
Repository errors propagate as raw SQLite exceptions. A service layer is a
natural place to wrap them in domain-meaningful errors.

**Remove the legacy duplicate:**
`insertMood` and `insertMoodEntry` in the repository execute identical SQL with
different argument shapes. `moodService.insertLegacy` preserves the old
signature one layer up. Both should be collapsed to a single `insert(input: MoodEntryInput)`.

## Expected benefits

- **Locality**: cache, error policy, and query strategy all live at one seam.
- **Leverage**: callers get genuine depth behind a small interface rather than
  a thin wrapper over the repository.
- **Bug fix**: `getLastEntry` stops doing a full table scan.

## Decisions still needed

- **Should cache invalidation move into the service?**
  This would couple `moodService` to `useMoodsStore`, or require a
  publish-subscribe mechanism. That is a significant architectural change.
  Alternatively, keep the store managing its own invalidation and just fix
  the service methods to be deeper individually.

- **Should the repository methods be made unexported after the service is
  deepened?** If all callers go through the service, there is no reason to
  keep the repository methods as public exports. TypeScript does not enforce
  module-private exports, but explicit patterns (e.g. a barrel that only
  exports the service) can achieve the same effect.

- **What is the right error type?** Options: wrap all SQLite errors in a
  `MoodStorageError` with a code; rethrow with a domain message; or stay silent
  and return `null`/`undefined` on failure. The choice affects whether callers
  need try/catch or can use conditional checks.

- **Is `moodService.insertLegacy` used anywhere in production?**
  Check usages before removing. If it is only used in tests or one-off code,
  delete it. If it is in a migration path, understand what it is migrating
  from before removing the call site.

- **Should the typed `MoodServiceInterface` be kept?**
  It currently documents the interface as an explicit TypeScript type. This is
  valuable if there are or will be multiple adapters. If the service will always
  be the real SQLite adapter, the interface adds indirection without providing
  a real seam.
