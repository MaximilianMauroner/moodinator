# Deepening #1 — Chart data extraction out of ChartComponents

**Status: implemented**

## What was wrong

`src/components/charts/ChartComponents.tsx` mixed React components with
substantial data-processing logic: daily aggregation, linear gap interpolation,
weekly quartile calculation, sampling, and a Tailwind-to-hex colour map.
`analyticsService.ts` imported its data functions from that component file,
inverting the dependency direction (service → component).

The duplicate `colorMap` in `ChartComponents.tsx` and `useInsightsData.ts` was
also silently broken: it mapped old Tailwind class names (`text-sky-500`,
`text-green-500`) that no longer appear in `moodScale.ts`. Every colour lookup
fell back to `#FFD700`. The bug was invisible because nothing alerted on it.

## Decisions made in grilling

| Question | Decision |
|---|---|
| Where does the data module live? | `src/lib/moodChartData.ts` — shared lib, not feature-scoped |
| Where do presentation helpers go? | `src/lib/moodPresentation.ts` — not chart-specific |
| Where does chart-library config go? | `src/components/charts/chartConfig.ts` — rendering concern |
| Replace `colorMap` with what? | `moodScale[n].textHex` via `getMoodHex(value, isDark?)` |

## What was created

- **`src/lib/moodChartData.ts`** — pure functions: `processMoodDataForDailyChart`,
  `processWeeklyMoodData`, `getDaysInRange`, `sampleDataPoints`,
  `getQuartiles` (private). Types: `DailyDataPoint`, `WeeklyDataPoint`.
  No React imports.
- **`src/lib/moodPresentation.ts`** — `getMoodHex`, `getMoodInterpretation`,
  `getTrendInterpretation`, `getMoodScaleColor`, `getMoodScaleBg`.
  Fixes the broken colour lookup.
- **`src/components/charts/chartConfig.ts`** — `getBaseChartConfig`.
- **`src/components/charts/ChartComponents.tsx`** — stripped to `MiniWeeklyChart`
  only (~90 lines).

## What was found during TDD

`processWeeklyMoodData` closed over `new Date()` internally, making it
non-deterministic and untestable with historical fixture dates.
Fixed by adding `referenceDate: Date = new Date()` as an optional parameter.
All production callers pass no argument; tests pass a fixed date.

## Tests written

- `__tests__/lib/moodChartData.test.ts` — 15 tests covering empty input,
  real-day aggregation, multi-entry averaging, linear gap interpolation, the
  `numDays` cutoff window, day-of-month labels, the median-not-mean contract
  for weekly aggregates, sampling boundary conditions.
- `__tests__/lib/moodPresentation.test.ts` — 18 tests covering `getMoodHex`
  light/dark/fallback/rounding, `getMoodInterpretation` label/class/rounding,
  full 0–10 scale coverage, `getTrendInterpretation` all five branches and
  icon name validity.

## Still open

- `processWeeklyMoodData` produces weekly aggregates in reverse-chronological
  order. No test currently asserts that order. If a chart depends on it
  implicitly, a future change to the sort could silently break rendering.
- The quartile formula uses `Math.floor(n * 0.5)` for the median, which picks
  the upper-middle element for even-length arrays. This is not traditional
  median behaviour. No decision has been made to change it, but it should be
  documented as an explicit choice rather than an accident.
- `getMoodInterpretation` still has a fallback block for values outside 0–10
  that uses old standard Tailwind classes (`text-sky-500`, etc.). These are
  now unreachable for valid **Mood Ratings**, but if the **Mood Scale** ever
  expands those fallbacks will silently apply wrong colours.
