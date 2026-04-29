# Architecture Deepening — Working Files

These files were produced in an architecture review session on 2026-04-29.
Each one is a working document, not a finished spec. Grilling decisions and
open questions will accumulate here as each candidate is explored.

| # | File | Status | Summary |
|---|---|---|---|
| 1 | [01-chart-data-extraction.md](01-chart-data-extraction.md) | **Done** | Extracted `moodChartData.ts`, `moodPresentation.ts`, `chartConfig.ts`. Fixed broken colour map. 33 tests written. |
| 2 | [02-settings-state-desync.md](02-settings-state-desync.md) | **Done** | Settings is split across `useEntrySettings`, `useSettingsStore`, `settingsService`, and storage helpers instead of one runtime seam. |
| 3 | [03-analytics-testability.md](03-analytics-testability.md) | Not started | `calculatePeriodStats` buried in a hook; `calculateStreak` duplicated; analytics rules split across a hook and a shallow service. |
| 4 | [04-moodservice-bypass.md](04-moodservice-bypass.md) | Not started | Three hooks/screens import directly from `@db/db`, bypassing `moodService` and holding disconnected mood arrays. |
| 5 | [05-emotion-migration-bootstrap.md](05-emotion-migration-bootstrap.md) | Not started | Emotion format migration runs inside the Home screen `useEffect` instead of at app bootstrap. |
| 6 | [06-moodservice-depth.md](06-moodservice-depth.md) | Not started | Most `moodService` methods are pass-throughs. `getLastEntry` does a full table scan. |
| 7 | [07-historical-update-seam.md](07-historical-update-seam.md) | Not started | The Emotions screen currently owns `Historical Update` decisions that should live behind a dedicated seam. |
| 8 | [08-home-workflow-application-service.md](08-home-workflow-application-service.md) | Not started | The Home tab orchestrates the real `Mood Entry` workflow instead of delegating to a deeper module. |

## Suggested order to work through

**2 before 3 and 4** — settings desync is self-contained. Fixing it simplifies the store before the analytics and bypass work touches it.

**3 before 4** — extracting `calculatePeriodStats` and `detectPatterns` into a pure module makes the Insights hook thinner, which makes the bypass fix in #4 a cleaner change.

**4 after 3** — once the hook is thin, routing its DB call through `moodService` is straightforward.

**5 at any time** — it is independent. A good first PR if you want a quick win.

**6 last** — deepening `moodService` is the payoff after #4 has moved all bypasses through it. Doing it first would deepen a seam that still has leaks.
