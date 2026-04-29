# Architecture Deepening Opportunities

Date: 2026-04-29

Vocabulary follows `CONTEXT.md` for product concepts. Architecture terms used below:
**module** (interface + implementation), **depth** (leverage behind a small interface),
**seam** (where an interface lives), **locality** (change concentrated in one place),
**deletion test** (would deleting the module concentrate or disperse complexity?).

---

## Deepening A — Emotion List and Historical Update

**Status: not started**

## What is wrong

The domain rule in `CONTEXT.md` is clear: deleting an **Emotion** from the
**Emotion List** prevents future selection but does not remove it from existing
**Mood Entries**. Edits to an **Emotion** apply to existing **Mood Entries** only
through an explicit **Historical Update**.

The module interface does not match this rule. `src/app/settings/emotions.tsx`
calls `moodService.removeEmotion(value)` after removing an **Emotion** from
future selection. The repository's `removeEmotionFromMoods` is currently a
no-op for **Mood Entries**, but the name implies mutation of historical data.
A future developer reading the name would reasonably expect it to touch past
**Mood Entries** — and might one day make it do so.

The same mismatch exists for `updateEmotionCategory`: the name implies
changing the **Emotion Type** across existing **Mood Entries**, but the
implementation only upserts the category table and returns `{ updated: 0 }`.

Deletion test: if you deleted the misleading method names and replaced them
with domain-accurate ones, the caller code would need to change — which means
the names are currently doing work (encoding an expectation) that they should not be.

## Files

| File | Role |
|---|---|
| `src/app/settings/emotions.tsx` | Screen for managing the **Emotion List**; calls the misleadingly named service methods |
| `src/services/moodService.ts` | Exposes `removeEmotion` and `updateEmotionCategory` |
| `db/moods/repository.ts` | `removeEmotionFromMoods` is a no-op; does not reflect the domain rule |
| `db/moods/emotions.ts` | Emotions table DDL and queries |
| `CONTEXT.md` | Defines the **Historical Update** rule and **Mood Entry Snapshot** invariant |

## Candidate direction

Create a deeper **Emotion List** module that separates three behaviours with
names that match the domain:

- `removeFromFutureSelection(emotionName)` — removes from the **Emotion List**,
  leaves existing **Mood Entries** untouched
- `applyHistoricalUpdate(from, to)` — explicit rename that applies to past
  **Mood Entries**, behind a confirmation flow
- `updateEmotionType(emotionName, newType)` — updates the type without touching
  **Mood Entry Snapshots** (or explicitly triggers a **Historical Update** if
  that is the decided behaviour)

The screen issues domain-level commands and does not know whether an
**Emotion** is stored in AsyncStorage, SQLite, or both.

## Expected benefits

- **Locality**: **Mood Entry Snapshot** preservation rule has one home.
- **Leverage**: future developers cannot accidentally call "remove from history"
  when they mean "remove from future selection" — the names prevent it.
- Clearer confirmation flow for **Historical Updates**.
- Smaller, directly testable **Emotion List** interface.

## Decisions still needed

- Does changing an **Emotion Type** count as a **Historical Update**, or does
  the snapshot store only the name (making the type a display concern, not a
  historical one)?
- Should **Emotion Type** be snapshotted per **Mood Entry** forever, or should
  historical entries reference the current type unless explicitly exported?
- Should the SQLite emotion table be the source of truth for the **Emotion
  List**, or should AsyncStorage remain the source of truth?
- What should the return value of future-selection commands be: the updated
  **Emotion List**, a count, or void?
- Should the **Historical Update** confirmation flow be built now, or should
  the domain interface be added first with the UI deferred?

---

## Deepening B — Entry Customization settings duplication

**Status: not started**

## What is wrong

**Entry Customization** preferences — **Emotion List**, **Context Tag List**,
**Quick Entry** field visibility, **Therapy Export** field selection — are
spread across two modules that both parse the same AsyncStorage keys with
overlapping logic.

`src/lib/entrySettings.ts` and `src/services/settingsService.ts` both implement
`parseEmotionList`, both handle legacy string-array formats, both apply
defaults, and both sanitize **Therapy Export** fields. They do not coordinate.

The Home screen reads through `useEntrySettings` → `entrySettings.ts`; the
Settings screen writes through `useSettingsStore` → `settingsStore.ts`.
A write in Settings is only reflected in Home after a re-focus event, because
the two paths maintain separate in-memory copies. The gap is silent — no error
fires when the copies diverge.

Deletion test: delete either module and the complexity reappears in the other
callers. Neither is earning depth because neither hides the parsing rules from
callers — callers just call a different copy of the same logic.

## Files

| File | Role |
|---|---|
| `src/lib/entrySettings.ts` | Parses AsyncStorage keys, applies defaults; used by hook and store directly |
| `src/hooks/useEntrySettings.ts` | Re-reads AsyncStorage on every focus into local `useState`; used by Home screen |
| `src/shared/state/settingsStore.ts` | Zustand store; initialises from same AsyncStorage keys on mount |
| `src/services/settingsService.ts` | Second parallel path; overlapping parse and sanitize logic |
| `src/app/(tabs)/index.tsx` | Consumes `useEntrySettings` for the **Quick Entry** form |
| `src/features/settings/screens/SettingsScreen.tsx` | Writes through `useSettingsStore` |
| `src/app/settings/quick-entry.tsx` | **Entry Customization** settings screen |
| `src/app/therapy-export.tsx` | Reads settings directly via `entrySettings.ts` |

## Candidate direction

Make `useSettingsStore` the single source of truth. `entrySettings.ts` becomes
a pure parsing/defaults module with no AsyncStorage access — it provides
`parseEmotionList`, default constants, and type helpers that the store calls
once on initialisation. `useEntrySettings` becomes a selector over the store
(or is deleted and its call sites updated). All writes go through store actions;
the store persists to AsyncStorage as a side effect.

## Expected benefits

- **Locality**: the **Emotion List** and **Context Tag List** live in one place.
  An edit in Settings is immediately visible in Home without a focus cycle.
- **Leverage**: callers stop managing re-fetch timing.
- **Testability**: `entrySettings.ts` becomes a set of pure parse functions
  testable without mocking AsyncStorage.
- One set of migration and fallback rules instead of two.

## Decisions still needed

- Should `settingsService.ts` survive as the AsyncStorage adapter that the
  store calls, or be merged into the store's init action?
- What is the store's initialisation contract? If a screen mounts before the
  store finishes its AsyncStorage read, it shows defaults briefly. Should there
  be a loading gate, or should the store be initialised before navigation begins?
- Should `useEntrySettings` be deleted or kept as a thin selector wrapper?
  Keeping it preserves call-site compatibility but adds indirection.
- Where do AsyncStorage key constants live? Currently scattered across
  `entrySettings.ts` and `settingsService.ts`. A single
  `src/shared/storage/keys.ts` would make them auditable.
- Should a failed AsyncStorage write revert the store state (pessimistic), or
  should the store update immediately and retry in the background (optimistic)?

---

## Deepening C — Mood Scale interpretation scattered across the codebase

**Status: not started**

## What is wrong

The **Mood Scale** has one non-obvious invariant — lower is better — and a
current fixed range of 0–10. Despite `moodScaleInterpretation.ts` making a
start at centralising this, many modules still carry their own assumptions:

- Direct `moodScale[index]` array access (index = value, no bounds check)
- Hard-coded `0`, `10`, and neutral `5`
- Inline "lower is better" comments and manual comparisons
- Repeated label/colour lookup logic that duplicates `getMoodInterpretation`
- Direct average rounding and clamping

The domain says a **Mood Rating** should be interpreted against the **Mood
Scale** that was active when its **Mood Entry** was created, not the current
scale. Most utilities assume the current fixed scale. `CONTEXT.md` explicitly
notes the scale should remain conceptually modifiable — so baking 0–10 or
"lower is better" into callers as permanent assumptions is a future risk.

Deletion test: delete `moodScaleInterpretation.ts` and the complexity scattered
across callers grows but does not concentrate. The module is not yet earning
its keep because callers still reach past it.

## Files

| File | Role |
|---|---|
| `src/constants/moodScale.ts` | **Mood Scale** data array; source of all label, colour, hex values |
| `src/constants/moodScaleInterpretation.ts` | Partial centralisation: clamp, compare, snapshot, display |
| `src/lib/moodPresentation.ts` | Presentation helpers added in deepening #1; uses `moodScale` directly |
| `src/lib/moodChartData.ts` | Chart data processing added in deepening #1; hard-codes neutral fallback `5` |
| `src/features/insights/utils/patternDetection.ts` | Compares mood values directly; no scale abstraction |
| `src/features/insights/hooks/useInsightsData.ts` | Inline `getMoodLabel` / `getMoodColor` per-hook helpers |
| `src/components/calendar/MoodCalendar.tsx` | Direct `moodScale[index]` access for colours |
| `src/components/calendar/useCalendarData.ts` | Own colour/label resolution logic |
| `src/components/charts/RawDataTab.tsx` | Direct `moodScale[index]` access |

## Candidate direction

Deepen `moodScaleInterpretation.ts` (or a successor module) so it is the
only place that knows the scale's direction, range, neutral value, and
display properties. Everything a caller might need:

- `clampMoodRating(value)` — already exists
- `compareMoodRatings(a, b)` — already exists
- `getNeutralRating()` — replaces hard-coded `5`
- `getMoodLabel(value)` — single lookup
- `getMoodHex(value, isDark?)` — already in `moodPresentation.ts`; could consolidate here
- `getMoodTailwindColor(value)` — already in `moodPresentation.ts`
- `interpretRatingAgainstSnapshot(value, snapshot)` — for future scale evolution
- `isBetterRating(a, b)` — already exists

Callers that currently use `moodScale[index]` directly switch to these
helpers. The scale data array becomes a private implementation detail.

## Expected benefits

- **Leverage**: every screen, chart, and insight gets scale-aware behaviour
  from one interface. Changing the scale direction or range is a one-file change.
- **Locality**: the inverted-scale rule has one home. No more comments spread
  across files explaining "lower is better."
- **Testability**: scale behaviour tested once rather than implicitly across
  every feature that touches mood values.

## Decisions still needed

- How much future scale flexibility is actually planned: range and direction
  only, or also labels and colours?
- Should `MoodEntry` consumers pass the full `MoodEntry` (with its stored
  `moodScale` snapshot) into interpretation helpers, or is it acceptable to
  always use the current active scale for display purposes?
- Should averages have a distinct type (e.g. `MoodRatingAverage`) to prevent
  passing a decimal average where a discrete **Mood Rating** is expected?
- Should `moodScale` remain a public export as an array, or become opaque so
  callers cannot bypass the helpers with direct index access?
- How should **Statistics**, **Patterns**, and **Insights** handle **Mood
  Entries** whose stored scale snapshot is incompatible with the current scale:
  omit them, normalise, or surface an explicit limitation to the person?

---

## Deepening D — Insights and Statistics pipeline

**Status: not started**

## What is wrong

**Statistics**, **Patterns**, **Insights**, and **Streak** logic are split
across a service, a React hook, and feature-specific utilities. None of it is
directly testable.

`useInsightsData` mixes four concerns in one file: fetching (`getAllMoods`
called directly from `@db/db`, bypassing `moodService`), period navigation
state, domain computation (`calculatePeriodStats`, `getMoodsInPeriod`), and
React lifecycle. The 75-line `calculatePeriodStats` function is unexported and
untested. `detectPatterns` in `patternDetection.ts` is pure but also untested.

`calculateStreak` exists in two places with different return shapes:
`analyticsService.ts` returns `number` (dead code — no UI uses it);
`patternDetection.ts` returns `{ current, longest }` (used by the UI).

`analyticsService` computes some **Statistics** independently from what
`useInsightsData` computes. Calendar and raw-data screens compute their own
averages with direct **Mood Scale** assumptions.

Deletion test: delete `calculatePeriodStats` and the complexity reappears in
whatever screen tries to show period **Statistics** — it was earning its keep,
just in the wrong place.

## Files

| File | Role |
|---|---|
| `src/features/insights/hooks/useInsightsData.ts` | Mixes DB fetch + period navigation + Statistics + Pattern detection |
| `src/features/insights/utils/patternDetection.ts` | Pure `detectPatterns` + `calculateStreak` used by UI; no tests |
| `src/services/analyticsService.ts` | Duplicate `calculateStreak` returning plain `number`; dead code |
| `src/components/charts/*` | Chart tabs compute their own summary values |
| `src/components/calendar/*` | Calendar computes its own colour/label resolution |

## Candidate direction

Extract the three core computations into a pure module (e.g.
`src/lib/insightsMath.ts`):

```ts
calculatePeriodStats(current: MoodEntry[], previous: MoodEntry[]): PeriodStats
calculateStreak(moods: MoodEntry[]): { current: number; longest: number }
detectPatterns(moods: MoodEntry[]): Pattern[]
getMoodsInPeriod(moods: MoodEntry[], period: TimePeriod, date: Date): MoodEntry[]
```

Delete the orphan `calculateStreak` in `analyticsService.ts`. The hook
becomes a thin adapter: fetch → pass to pure functions → manage navigation
state. Tests cover domain logic directly without React.

## Expected benefits

- **Locality**: all **Statistics**, **Streak**, and **Pattern** logic in one
  file. A domain rule change lands in one place.
- **Leverage**: the hook's interface shrinks to state management. Analytics
  service and Insights hook converge on shared functions.
- **Testability**: Vitest tests over plain `MoodEntry[]` arrays, no React tree.

## Decisions still needed

- Should this deepen `analyticsService`, or should a separate `insightsService`
  own the domain computation while `analyticsService` keeps chart aggregation?
- Are chart aggregates (`processMoodDataForDailyChart` etc., already in
  `moodChartData.ts`) part of the same **Statistics** module, or intentionally
  separate?
- Should `PeriodStats` include `trendDirection` (a UI-facing string) or only
  raw numbers, leaving direction labels to the presentation layer?
- What minimum sample sizes and confidence thresholds should be named domain
  constants rather than hidden implementation details inside `detectPatterns`?
- Should the service fetch **Mood Entries** itself, or accept
  already-loaded entries from the caller (better for testability but requires
  callers to manage fetch timing)?

---

## Deepening E — Mood Entry type wider than the accepted product surface

**Status: not started**

## What is wrong

`CONTEXT.md` states that photos, voice memos, and location are not accepted
domain concepts until they work reliably, and should be removed from the
product and code for now. Despite this, `MoodEntry` still includes three
dormant fields:

```ts
photos: string[];
location: Location | null;
voiceMemos: string[];
```

The database schema preserves columns for these fields. The serialization layer
reads and writes them. UI components for all three exist and are importable.

This widens the **Mood Entry** interface beyond what the product intentionally
supports. The fields are privacy-sensitive: they can contain file URIs and
location coordinates. If any export path, backup, or third-party integration
accidentally includes them, the person's data is exposed without a deliberate
privacy review.

Deletion test: if you deleted the three fields from `MoodEntry` and the schema,
the complexity would concentrate in one decision point: what to do with any
existing data stored in those columns. The fields are earning nothing today
except risk surface.

## Files

| File | Role |
|---|---|
| `db/types.ts` | `MoodEntry` type includes `photos`, `location`, `voiceMemos` |
| `db/moods/schema.ts` | DDL preserves dormant columns |
| `db/moods/serialization.ts` | Serialises and deserialises the dormant fields |
| `db/moods/importExport.ts` | May include dormant fields in **Data Export** and **Data Import** |
| `src/components/entry/PhotoAttachment.tsx` | UI for dormant photo feature |
| `src/components/entry/VoiceMemoRecorder.tsx` | UI for dormant voice memo feature |
| `src/components/entry/LocationPicker.tsx` | UI for dormant location feature |
| `CONTEXT.md` | States these are not accepted domain concepts; flags for removal |
| `PRIVACY_POLICY.md` | May implicitly cover dormant fields |
| `TERMS_OF_SERVICE.md` | Same concern |

## Candidate direction

Remove `photos`, `location`, and `voiceMemos` from the active `MoodEntry`
TypeScript type and from the UI layer. For the database: retain the columns as
dormant schema fields (no migration needed) but stop reading or writing them.
Any future reintroduction goes through an explicit design and privacy review
pass as `CONTEXT.md` already requires.

## Expected benefits

- **Locality**: privacy-sensitive fields have a clear boundary — they do not
  exist in the active interface.
- **Leverage**: a narrower **Mood Entry** type means every function that
  accepts a `MoodEntry` has less surface to reason about.
- Reduced accidental inclusion in **Data Export**, **Therapy Export**, and
  **Backup**.
- Clearer alignment between the active product, the code, and the legal
  documents.

## Decisions still needed

- Should the three fields be removed from the TypeScript type now, or kept but
  typed as `never` / `undefined` to document their dormant state?
- If data already exists in those database columns for some users, what is the
  correct handling on **Data Import** and **Backup** restore: discard, preserve
  silently, or surface to the person?
- Should the UI component files (`PhotoAttachment.tsx` etc.) be deleted
  entirely, or kept behind a feature flag so they are easy to reactivate?
- Does removing or reintroducing any of these fields require simultaneous
  updates to `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`?
- Should `db/moods/importExport.ts` explicitly strip these fields from exports
  even if they exist in the database, or should unknown fields pass through
  to preserve forward compatibility?

---

## Cross-cutting observations

### Service-layer leaks

Several UI and hook modules import directly from `@db/db` or storage APIs,
bypassing the service-layer convention. Not all bypasses are equally harmful —
the main question is whether the seam has enough adapters and invariants to be
real. Known bypasses:

| File | Bypasses |
|---|---|
| `src/features/insights/hooks/useInsightsData.ts` | `getAllMoods` from `@db/db` |
| `src/features/settings/screens/SettingsScreen.tsx` | `getAllMoods` from `@db/db` |
| `src/app/therapy-export.tsx` | `getMoodsWithinRange` from `@db/db` |
| `src/features/settings/components/ExportModal.tsx` | `exportMoods` from `@db/db` |
| `src/hooks/useNotifications.ts` | Direct storage access |
| `src/hooks/useEntrySettings.ts` | Direct AsyncStorage access |
| `src/app/(tabs)/index.tsx` | Direct AsyncStorage for emotion migration |

The first three are the highest priority. See `docs/deepening/04-moodservice-bypass.md`
for the targeted fix.

### Test surface priorities

The highest-value untested targets:

- **Mood Entry Snapshot** preservation when **Emotion List** changes (Deepening A)
- Settings parsing and migration for old formats (Deepening B)
- **Mood Scale** comparison, display, and direction rules (Deepening C)
- `calculatePeriodStats`, `detectPatterns`, `calculateStreak` without React (Deepening D)
- Export/import behaviour for dormant **Mood Entry** fields (Deepening E)

### Relationship to `docs/deepening/`

`docs/deepening/` contains a parallel set of candidates surfaced in the same
review session, focused on different friction points. There is intentional
overlap (settings duplication, insights pipeline) — the two documents approach
the same problems from slightly different angles and should be reconciled before
starting work on the overlapping areas.

## Suggested order

1. **Deepening C** (Mood Scale interpretation) — broad leverage, moderate risk;
   benefits every subsequent item that touches mood values.
2. **Deepening B** (settings duplication) — self-contained; fixes the most
   immediately user-visible desync bug.
3. **Deepening A** (Emotion List / Historical Update) — domain correctness fix;
   cleaner after settings is consolidated.
4. **Deepening D** (Insights pipeline) — easier after the scale module is deep
   and the service bypasses (see `deepening/04`) are closed.
5. **Deepening E** (Mood Entry type) — touches storage, serialization, and
   legal docs; do last to avoid scope creep.
