# Round 19 provisional Month allocation

This candidate gives Month real width in the FlashList header allocation.
Native success remains unverified. The parent owns dependency checks and native checks.
Source arithmetic cannot establish native bounds, date visibility, or touch behavior.

## Scope and data shape

The base is `6dd4865c6b65e3636c198da4a4bf0eaa9db6d954`, which has Round 17 content.
The linked work is issue 170.
The existing `HistoryView` union selects Days or Month.
The calendar still renders seven equal flex columns from `firstDayOfWeek`,
`daysInMonth`, and the existing day-data map.
There is no new state, interface, option, dependency, or data path.

The production edits are limited to `history.tsx` and `MoodCalendar.tsx`.
`CalendarDay.tsx` stays byte-for-byte equal to the base.
Its static 44 by 46dp Pressable, Today border, date text, dot, accessibility
labels and hints, and callbacks stay intact.

## Evidence read

The parent evidence directory is
`/home/codex/work/moodinator/.agents/artifacts/hill-climb/20261029-both-modes/`.
I read these files and inspected the screenshot.

- `round18-decision.json` rejects the candidate with nine narrow edge controls.
- `round18-calendar-345-light-tree.json` reports Day 3 at x924px with width106px.
  Day 4 starts at x50px with width108px. At density 3.125 these widths are
  33.92dp and 34.56dp.
- Both controls share ancestor indices 84, 76, 69, 56. Each reports x50px and
  width980px. The ScrollView ancestor 54 reports x0px and width1080px.
- `round18-calendar-345-light.png` shows the wider card and grid.
- `round18-clipped-edge-touch.json` records that x22px opened Day 4 outside
  its reported bounds. This does not establish a dead touch strip.
- `calendar_bounds_gate.py` requires each day to measure 44 by 46dp within
  0.5dp tolerance. It also checks date containment and neighboring overlap.
- `round18-calendar-gate-sensitivity.json` records nine size failures and
  26 overlaps for the earlier native negative controls in all four states.
  Its synthetic valid, overlap, clipped, and missing-date cases test only
  the validator. They do not prove app behavior.

The rejected `22112ec` diff widened children with negative margins while the
FlashList header allocation stayed at 16dp per side.
The source candidate below does not use that approach.

## Layout sketch A, selected

Keep the existing FlashList. Set its actual horizontal content inset to 4dp
only for Month. Days keeps 16dp.
The header root keeps its current gap and vertical spacing.
Give the History title row 12dp of positive local margin.
Give the segmented control 26dp of positive local margin.
That26dp replaces its existing 14dp NativeWind margin in Month.
The segmented control already accepts a style prop.

Remove only horizontal padding from the calendar card.
The card, gesture clip view, animated grid, and rows fill the wider header.
Give the calendar header, legend, error content, and summary 26dp of positive
local margin. These siblings do not narrow the grid's ancestor chain.
Retain the existing vertical 14dp card padding.

The intended source ancestry is:

```text
SafeAreaView and FlashList viewport       x0, width W
  FlashList content and header allocation x4, width W - 8
    History header root                  x4, width W - 8
      MoodCalendar card                  x4, width W - 8
        GestureDetector native view      x4, width W - 8
          Animated grid and each row     x4, width W - 8
            Each CalendarDay column      width (W - 8) / 7
              Centered Pressable         width44, height46
```

GestureDetector uses the existing view with `overflow: hidden`.
There is no negative margin or absolute offset in this path.
Every day target fits its own column in the two requested source sketches.
The weekday header uses the same full-width seven-column distribution.

| Viewport | Allocated grid width | Column width | Space beyond44dp per column |
| --- | --- | --- | --- |
| 320dp | 312dp | 44.571429dp | 0.571429dp |
| 345.6dp | 337.6dp | 48.228571dp | 4.228571dp |

This arithmetic predicts no horizontal overlap.
The unchanged 46dp target, vertical 2dp padding per side, 7dp dot slot, and
3.5dp row gap give a 60.5dp row pitch in the source.
That predicts 14.5dp between vertically adjacent target edges.
Pixel rounding still requires native measurement.

The intended content positions are unchanged:

| Content | Base left inset | Candidate left inset | Width in both |
| --- | --- | --- | --- |
| History title row | 16dp | 4 + 12 =16dp | W - 32dp |
| Segmented control | 16 + 14 =30dp | 4 + 26 =30dp | W - 60dp |
| Calendar header and summary | 16 + 14 =30dp | 4 + 26 =30dp | W - 60dp |

The card itself moves from 16dp to 4dp per side.
Its palette, radius, shadows, and vertical spacing stay intact.
Summary content and styles stay intact apart from the margin needed to
retain the same width and position.
Days keeps its 16dp list inset and its existing header props and card code.

## Layout sketch B, rejected

Render Month in a separate full-width RNScrollView.
Keep Days in the existing FlashList with 16dp content padding.
For Month, allocate a 4dp scroll-content inset and use the same local 12dp
title margin and 26dp content margins as sketch A.
The ancestry would be viewport, Month ScrollView, 312dp content at 320dp,
card, grid, rows, then 44.571429dp columns.
This has the same source width budget and avoids the FlashList header path.

Sketch B changes the scroll renderer and adds a conditional container.
It also requires shared header and refresh-control plumbing.
Sketch A changes fewer lines and keeps the existing scrolling structure.
There is no native evidence that FlashList itself must be replaced.

## Verification and limits

The requested native matrix remains open at 320dp and 345.6dp, text 1.0 and 1.35,
in light and dark themes.
The fixed target sizes and equal-column source geometry do not depend on
theme or text scale. Full date digits still need screenshot and native-tree
checks, especially for populated Today cells at text 1.35.
No font size or text-scale behavior changes in this candidate.

No install, test suite, lint, typecheck, build, device action, issue write,
upload, push, PR, or merge runs in this child.
No independent review runs because the user requires this child to work alone.
The parent decides whether to take this candidate into native verification.
Max owns final acceptance. Issue 170 remains unchanged.

The source checks and final local review results follow below.

### Local results

- Passed. A read-only Python source check reversed the allowed layout edits
  and reproduced the base source tokens, including quoted text.
  It checked that only the two production files changed.
- Passed. Exact file comparisons preserve `CalendarDay.tsx`,
  `CalendarWeekHeader.tsx`, `CalendarHeader.tsx`, `ForecastCard.tsx`, and
  `DisplayMoodItem.tsx`.
- Passed. Added source lines contain no negative padding or margins.
  CalendarDay retains its 44 by 46dp target.
- Passed. `git diff --check` reports no whitespace errors.
- Passed. Self-review and deslop review found no new state, interfaces,
  defensive logic, type escapes, dependencies, comments, or unrelated edits.
  The calendar-header wrapper exists only to inset that sibling without
  narrowing the grid ancestors.
- Blocked by the assigned scope. Native bounds, overlap, digit visibility,
  Today border, multiple-entry dot, interaction, and visual preservation
  remain unverified on this candidate.
- Not run by instruction. Tests, lint, typecheck, builds, and CI.
- Not requested. Independent review, PR, merge, and product acceptance.

### Principles used

Fix Root Causes changed the allocation at the History list boundary instead
of extending a child beyond a narrower ancestor.
Model the Domain kept the existing view union and seven-column structure.
Prove It Works kept all native claims unverified and limited the passed
claims to the source artifact that this child inspected.

### Next action

The parent can build this committed candidate and inspect every native
ancestor, all 31 day bounds, date digits, and neighboring overlap in the
eight requested width, text-scale, and theme combinations.
The parent must also compare Days and both card styles with the base.
Native evidence decides whether this candidate is accepted or rejected.
