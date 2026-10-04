# Inner weather redesign: implementation plan

Status: implemented on branch `feat/inner-weather-redesign` (2026-09-29). Native visual check pending.

Design source: the local design exploration (rounds 13 and 14, direction S3
with the 4/3/4 picker), kept outside the repository.

## Result

The app keeps its data, scale, and features. It gets a new visual layer:

- Each level 0 to 10 has a weather sign (Ionicons), its word, and its number.
- The check-in picker has rows of 4, 3, and 4: clear (0 to 3), cloudy
  (4 to 6), and rain (7 to 10).
- History reads like a forecast: one row per day with its lightest-to-heaviest
  range. A day opens a detail view. A month view shows weather per day.
- Insights read as "your climate": time-of-day weather, then drivers.
- Ratings 9 and 10 keep the entry, then show support first in a sheet.
- Colors stay Soft Sage with slightly livelier mood colors, in dark and light
  mode.

The stored 0 to 10 value does not change. No data migration.

## Decisions (2026-09-29)

1. Tap behavior: one tap saves the entry, then a detail sheet offers feelings,
   context, energy, and a note, with Undo. Long press opens the full entry
   modal.
2. Tabs: Today, History, and Insights. Settings moves behind a gear in the
   header.

## Phases

Each phase is a working app on its own. Each phase ends with the checks in
"Verification".

### Phase 1: tokens and weather map

- Add a level-to-weather map next to `src/constants/moodScaleInterpretation.ts`
  (icon name and mood color per level).
- Update the mood colors in `src/constants/moodScale.ts`,
  `src/constants/colors.ts`, and `tailwind.config.js` to the Soft Sage values
  from the design.
- The existing contrast tests must pass
  (`__tests__/constants/moodScaleContrast.test.ts`, `__tests__/theme/*`).

### Phase 2: check-in picker (visual only)

- Change `src/components/home/UnifiedMoodSelector.tsx` from 4/4/3 to 4/3/4
  weather tiles. Keep the collapse to a pill row, and show icons there too
  (`CollapsedMoodSelector.tsx`).
- Update `MoodButtonsDetailed.tsx` for the detailed-labels setting.
- Keep every accessibility label exactly
  ("Mood Rating 5 of 10, Neutral. Lower numbers are better."), because the
  Maestro flows find tiles by it.
- The tap still opens the current modal in this phase.

### Phase 3: one-tap keep and the detail sheet

- A tap saves through the existing `handleEntrySave` path, then shows a detail
  sheet for that entry with Undo.
- Reuse the existing entry parts (`EmotionPicker`, context chips,
  `EnergySlider`, notes) in the sheet. Keep the testIDs `entry-notes` and the
  "Save entry" text that the QA flows use, or update the flows in the same
  change.
- Long press keeps opening the full modal.

### Phase 4: support-first sheet

- Keep the rules in `src/lib/crisisSupport.ts` (threshold 9, the same actions:
  call, text, find a helpline, not now).
- Replace the alert in `src/lib/showCrisisSupportAlert.ts` with a sheet in the
  new style. It opens after the save, as today.
- The existing `__tests__/lib/crisisSupport.test.ts` must pass unchanged.

### Phase 5: History tab

- Move the history list from Home to a new History tab in
  `src/app/(tabs)/_layout.tsx`.
- Forecast rows per day (icon, average, range bar, entry marks), using the
  existing history data and filters in `src/features/history/`.
- Restyle `src/components/calendar/` (`CalendarDay`, `DayDetailModal`) for the
  month and day views. Keep the calendar legend text that
  `tests/native-ui.node-test.mjs` checks, or update the test with the change.
- Keep the testIDs on `DisplayMoodItem.tsx` and `history-count`.

### Phase 6: Insights as climate

- Restyle `InsightsScreen.tsx` cards: time-of-day weather from `rhythm.ts`,
  drivers from `drivers.ts`, trend from `dailySeries.ts`. No new
  calculations.
- Keep `insights-loaded-summary`.

### Phase 7: light mode and native pass

- Compose light mode on every changed screen. Do not only invert dark mode.
- Run the native QA flows on an Android emulator and update the Maestro flows
  and `scripts/run-native-matrix.js` where names changed.
- Update the Play Store screenshots only when asked.

## Verification

- For each phase: `bun run lint`, `bun run typecheck`, `bun run test:run`,
  `bun run test:qa`, and `bun run verify:color-tokens`.
- `bun run verify` currently ends red at `verify:android-release-config`
  because of an untracked local `android/app/build.gradle`. This failure is
  unrelated to the redesign, so run the tracked checks one by one.
- For phases 2 to 7: screenshots from an Android emulator in dark and light
  mode, compared with the design page.

## Out of scope

- No new features (for example, a trusted contact) and no change to storage,
  export, backup, reminders, or app lock.
- No change to the scale labels or their meaning.

## Delivery

Work on a feature branch. I commit or open a pull request only when asked.

## Outcome (2026-09-29)

- All seven phases are implemented on `feat/inner-weather-redesign`
  (PR #85), rebased onto `main` after #82.
- Review fixes after the first Codex review:
  - A one-tap entry stores the mood only; energy stays unanswered.
  - Severe ratings show support first; "Not now" continues to the detail
    sheet or the Undo toast, so a mistaken 9 or 10 can be removed.
  - The month calendar reloads after any entry change.
  - Today and the forecast pad their query by 26 hours on each side
    (recorded offsets from UTC-12 to UTC+14) and bucket by the recorded
    local day.
  - A second tap during a pending save is ignored.
  - After "Not now", the follow-up waits until the support sheet has closed,
    because Android does not show a modal that opens during that close.
  - History keeps its load-error footer with Retry.
  - The climate card states averages with entry counts, not a most-common
    condition.
  - Native QA waits for a `forecast-ready` marker and captures Today first.
- Changes from the plan:
  - Collapsed picker pills keep the number on the mood tint, without an icon.
  - `rhythmCellColor` stays in `utils/rhythm.ts`; moving it was not needed.
  - The Insights calendar mode moved to History (Month). The Insights entry
    detail modal was only reachable from that calendar and was removed.
  - The QA runner scripts and Maestro flows use the Today, History, and
    Insights tabs and the settings gear (testID `open-settings`).
- Overlap with PR #83 (descriptive Insights): both change
  `InsightsScreen.tsx`, `UnifiedMoodSelector.tsx`, the Insights tests, and the
  native matrix. The second PR to merge must take #83's charts-only Insights,
  keep the climate card and History-owned calendar from this PR, and drop
  Findings from the QA matrix and `.maestro/flows/insights.yaml`.
- Release: this change does not touch versions or release configuration. The
  accepted Internal candidate (0.1.9 / code 44) does not include it. Before a
  build with this change ships, the Play listing copy and screenshots that
  describe "tap for a quick entry" on Home must be updated.
- Not verified here: human product acceptance on a physical device.

## Today layout (2026-09-30)

Chosen in design rounds 15 to 17 (T2a, "thumb zone"):

- The picker is docked above the tabs with larger tiles, so the input is
  always visible and within thumb reach. It no longer collapses into a pill
  row; the collapse animation, its snap logic, and the jump-to-top button are
  removed (this replaces the collapse notes in phase 2 above).
- The top shows the current weather (newest entry) and up to two earlier
  entries with their emotions, context, and first note line. More entries
  link to History, which keeps the full list and the entry actions.
- One tap still keeps the entry and opens the full "Add detail" sheet.
- The native smoke flow opens entry actions from History.
