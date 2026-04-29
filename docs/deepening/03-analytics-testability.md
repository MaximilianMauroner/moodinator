# Deepening #3 — Pattern detection and Statistics are untestable through their current interface

**Status: not started**

## What is wrong

The three core analytics computations — **Statistics**, **Streak**, and **Pattern**
detection — are either buried inside a React hook or duplicated across files,
making them effectively untestable without spinning up a React component tree.

**`calculatePeriodStats`** (≈75 lines) lives unexported inside
`src/features/insights/hooks/useInsightsData.ts`. It computes average
**Mood Rating**, **Mood Rating** change from the previous period, best/worst days of
the week, most common **Mood Rating**, and **Energy Rating** average. It is the
most business-critical computation in Insights and has zero tests.

**`calculateStreak`** exists in two places with different return shapes:
- `src/services/analyticsService.ts` → returns `number` (effectively dead code,
  not used by any UI)
- `src/features/insights/utils/patternDetection.ts` → returns
  `{ current: number, longest: number }`

The UI uses only the second. The first is an orphan.

**`detectPatterns`** in `patternDetection.ts` is already pure
(`MoodEntry[] → Pattern[]`) but has no tests despite being the most complex
pure logic in the app.

The hook `useInsightsData` mixes four concerns in one file: fetching
(`getAllMoods` direct DB call), period navigation state, domain computation,
and React lifecycle. Testing any one of those concerns requires entangling
all four.

There is also no coherent analytics seam. `useInsightsData` computes period
filtering, best/worst day, averages, trend comparison, **Pattern** detection,
and **Streak** itself while `analyticsService.ts` exposes a different,
shallower surface. The result is two parallel interfaces for the same
`Statistics` and `Pattern` rules.

## Files

| File | Role |
|---|---|
| `src/features/insights/hooks/useInsightsData.ts` | Mixing DB fetch + period state + Statistics + Pattern + Streak |
| `src/features/insights/utils/patternDetection.ts` | Pure `detectPatterns` + `calculateStreak` (used) |
| `src/services/analyticsService.ts` | Contains orphan `calculateStreak` + chart-data delegation; does not currently own the real analytics rules |

## Candidate direction

Extract the three computations into a single pure module — something like
`src/lib/insightsMath.ts` or `src/features/insights/utils/insightsMath.ts`.

The module would export:

```ts
calculatePeriodStats(currentMoods: MoodEntry[], previousMoods: MoodEntry[]): PeriodStats
calculateStreak(moods: MoodEntry[]): { current: number; longest: number }
detectPatterns(moods: MoodEntry[]): Pattern[]
getMoodsInPeriod(moods: MoodEntry[], period: TimePeriod, date: Date): MoodEntry[]
```

The hook becomes a thin adapter: it fetches, passes data to these functions,
and manages the navigation/period state. The hook's test surface shrinks to
"does it call the right functions" — the real domain logic is tested directly.

Delete the orphan `calculateStreak` in `analyticsService.ts`.
Then decide whether `analyticsService.ts` becomes a real seam over these
functions or disappears as an unnecessary extra layer.

## Expected benefits

- **Locality**: all **Statistics**, **Streak**, and **Pattern** logic in one
  module. A domain rule change has one place to land.
- **Leverage**: the hook's interface shrinks to state management. Callers of
  the analytics service and the insights hook converge on the same rules
  instead of re-implementing them behind parallel seams.
- **Testability**: straightforward Vitest tests over plain `MoodEntry[]`
  arrays. No React, no DB mocks.

## Decisions still needed

- **Where does the module live?** `src/lib/insightsMath.ts` signals shared
  infrastructure. `src/features/insights/utils/insightsMath.ts` signals
  feature-scoped. The `analyticsService` in `src/services/` would import from
  a feature utils path — slightly awkward. Leaning toward `src/lib/`.

- **Should `detectPatterns` move, or stay in `patternDetection.ts`?**
  It is already in the right shape. Options: move it into the new module for
  co-location, or leave it and just add tests to it in place.

- **What is `getMoodsInPeriod`'s home?** Currently it is a private function
  inside the hook. Extracting it makes the period filtering logic testable
  independently.

- **Should `analyticsService` be deepened or deleted?** After the extraction,
  `analyticsService` would be left with chart-data delegation and
  `fetchAndProcess*` helpers. Is that enough depth to justify keeping it as a
  separate module, or should those methods move to the new module (or back to
  the hook)?

- **What is the `PeriodStats` interface?** It currently includes
  `trendDirection` (a UI-facing string enum). Should domain computations return
  raw numbers and let the presentation layer derive direction labels, or is
  `trendDirection` a legitimate domain concept?

- **Minimum sample size for `detectPatterns`**: the function currently runs on
  any non-empty array. Should minimum sample sizes be domain constants in the
  module, or left as implementation details?
