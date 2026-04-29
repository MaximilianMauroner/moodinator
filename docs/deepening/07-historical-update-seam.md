# Deepening #7 — Historical Update for Emotions leaks into the UI layer

**Status: not started**

## What is wrong

The Emotions settings screen currently orchestrates two different concerns:

- editing the current **Emotion List**
- deciding whether and how that change should affect past **Mood Entries**

That second concern is a **Historical Update** concern from `CONTEXT.md`, but
the current seam exposes it as generic methods on `moodService`:

- `updateEmotionCategory`
- `removeEmotion`
- `getEmotionNames`

The result is that `src/app/settings/emotions.tsx` becomes the real
application-level module for history semantics. The screen decides when past
**Mood Entries** should change, when only future selection should change, and
how to reconcile the **Emotion List** with history.

This is especially risky because the domain rules and current implementation
are already out of alignment. `CONTEXT.md` says deleting an **Emotion** from
the **Emotion List** prevents future selection but does not remove it from
existing **Mood Entries**. The code path still calls `moodService.removeEmotion`
from the UI, which makes the history-mutation policy hard to audit and easy to
get wrong.

Deletion test: if you removed the orchestration from the screen, the required
complexity would not disappear. It would reappear somewhere else because
someone still has to own **Historical Update** semantics. That means the logic
is real, but it is sitting behind the wrong seam.

## Files

| File | Role |
|---|---|
| `src/app/settings/emotions.tsx` | UI currently coordinates Emotion List edits and history updates |
| `src/services/moodService.ts` | Exposes history-mutation methods as generic mood helpers |
| `src/shared/state/settingsStore.ts` | Owns the current in-memory **Emotion List** |
| `CONTEXT.md` | Defines **Historical Update**, **Emotion List**, and **Mood Entry Snapshot** rules |

## Candidate direction

Create a dedicated module for **Historical Update** decisions around
**Emotions** instead of letting the screen compose this behavior ad hoc.

Possible interface shape:

```ts
applyEmotionHistoricalUpdate(...)
removeEmotionFromFutureSelection(...)
importEmotionsFromMoodEntries(...)
```

The screen should issue intent-level commands:

- update the current **Emotion List**
- optionally apply a **Historical Update**
- import emotion names from past **Mood Entries**

The deeper module should own:

- whether a change touches only future selection or also past history
- how **Mood Entry Snapshot** rules are preserved
- what warnings or confirmations the UI needs before a history change
- how history-derived imports are merged into the current **Emotion List**

This may live as a dedicated `emotionHistoryService`, a deepened
`emotionService`, or a broader module around **Emotion List** management. The
important part is that the UI stops being the place where snapshot semantics
are assembled.

## Expected benefits

- **Locality**: all **Historical Update** rules for **Emotions** live in one
  module instead of leaking across screens and generic mood helpers.
- **Leverage**: the Emotions screen becomes a thin adapter that asks for a
  domain action instead of composing storage mutations itself.
- **Correctness**: the implementation can be brought back in line with
  `CONTEXT.md` in one place, especially for the rule that deleting an
  **Emotion** should not rewrite existing **Mood Entries** by default.
- **Testability**: history semantics can be tested through one interface
  instead of through Alert flows and UI callbacks.

## Decisions still needed

- **Is `Historical Update` a first-class module or part of `emotionService`?**
  A dedicated module gives the concept an explicit seam. Folding it into
  `emotionService` keeps fewer modules but risks mixing list management with
  history mutation.

- **Decided: category changes are future-only by default.**
  Changing an **Emotion Type** updates future selection behavior first. It
  should only rewrite past **Mood Entries** through an explicit
  **Historical Update** action confirmed by the person.

- **Decided: removal never rewrites past `Mood Entries`.**
  Removing an **Emotion** from the **Emotion List** prevents future selection
  only. Existing **Mood Entry Snapshots** keep their original emotion data.

- **Decided: rename is an explicit `Historical Update` only.**
  Renaming an **Emotion** should not silently rewrite past **Mood Entries**.
  If a person wants history updated, that is a separate, explicit action.

- **Decided: imports from past `Mood Entries` stay in the same seam.**
  `getEmotionNames`-style history reads belong with this module, but as a
  read-only query plus an explicit "apply additions" command for the current
  **Emotion List**.

- **How should UI confirmations be modeled?**
  The module can return a structured consequence summary for the screen to
  display before applying a **Historical Update**, rather than hardcoding the
  copy and consequences inside the screen.

## Current design stance

The seam should separate four intent-level actions:

- update the current **Emotion List** for future selection
- preview a possible rename **Historical Update**
- apply a confirmed rename **Historical Update**
- preview a possible category-change **Historical Update**
- apply a confirmed category-change **Historical Update**
- query past **Mood Entries** for importable emotion names, then apply selected
  additions to the current **Emotion List**

That means the screen should stop calling low-level methods like
`updateEmotionCategory`, `removeEmotion`, and `getEmotionNames` directly as if
they were ordinary list-edit operations.

## Confirmed decisions

- **Rename and category-change use separate commands.**
  They should not share one generic "apply emotion historical update"
  operation. Their UI copy, confirmations, and consequences are different
  enough to justify separate interfaces.

- **Previews return exact counts.**
  The preview surface should report the exact number of affected
  **Mood Entries**, not just a boolean or approximate summary.

- **Historical Updates apply globally to all matching snapshots.**
  Once the person confirms a rename or category-change **Historical Update**,
  the operation should update all matching **Mood Entry Snapshots** across the
  full local history, not only a filtered subset.

- **The seam lives inside `emotionService`.**
  A separate `emotionHistoryService` is not needed yet. The important part is
  that `emotionService` exposes a clearly separated command set for
  future-selection edits versus explicit **Historical Update** operations.

- **Matching is case-insensitive on normalized emotion names.**
  Global **Historical Updates** should match logically identical emotion names
  such as `happy` and `Happy`, not only exact case-sensitive strings.

- **Rename rejects collisions by default.**
  If a rename target already exists in the current **Emotion List**, the
  operation should reject the rename rather than silently merging history into
  the existing name.
