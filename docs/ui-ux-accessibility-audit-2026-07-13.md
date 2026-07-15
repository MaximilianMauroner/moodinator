# Mobile UI/UX and Accessibility Audit

Date: 2026-07-13
Scope: Entire mobile app, excluding app-lock issues fixed in the accompanying security slice.
Method: Static review of routes, screens, shared components, design/product guidance, theme tokens, and accessibility behavior. No browser or web build was used. React Doctor was attempted twice but returned no score or diagnostics, so its result is inconclusive.

## Executive summary

Moodinator has a coherent warm, botanical visual language and generally strong local-privacy messaging. The highest-value improvements are not a broad redesign: they are central fixes to touch targets, motion preferences, modal focus containment, headers, and settings controls, followed by a product-copy pass that removes pressure and gamification from streaks, coverage, and reminders.

## Priority 1

### Accessibility foundations

- **A11Y-01 — Empty-state actions can become unreachable to screen readers (S).** The parent empty state groups all descendants while also containing an action. Keep the title/description grouped, but leave the CTA as its own accessible control. Evidence: `src/components/ui/EmptyState.tsx:47-52,99-120`.
- **A11Y-02 — Repeated interactive targets are smaller than 44 pt (M).** Mood controls, plus/minus buttons, energy segments, calendar cells, and refresh actions are 32–40 pt. Establish a shared minimum-target/hit-slop policy while preserving compact visuals. Evidence: `src/components/home/CollapsedMoodSelector.tsx:112-138`, `src/components/MoodEntryModalParts.tsx:103-133,177-207`, `src/components/entry/EnergySlider.tsx:59-94`, `src/components/calendar/CalendarDay.tsx:57-65`, `src/features/insights/components/InsightsHeader.tsx:182-197,227-234`.
- **A11Y-03 — Reduce Motion coverage is incomplete (M/L).** Logging, calendar, insights, swipe/delete, and an infinite Insights pulse ignore the preference. Add one shared reduced-motion hook and apply static/zero-duration branches in reusable animation primitives before sweeping screens. Evidence: `src/features/insights/screens/InsightsScreen.tsx:149-150,188-196,207-237,272-397`, `src/components/calendar/MoodCalendar.tsx:301-316`, `src/components/ui/SegmentedControl.tsx:57-67`, `src/components/entry/EmotionPicker.tsx:65-70`, `src/components/DisplayMoodItem.tsx:266-276`.
- **A11Y-04 — Custom data-export sheets lack focus containment and responsive overflow (M).** Add modal semantics, initial focus, hidden background descendants, scrolling, and safe-area bottom padding. Apply the same pattern to the Same As Yesterday sheet. Evidence: `src/features/settings/components/ExportModal.tsx:157-165,275-309`, `src/components/entry/SameAsYesterdayButton.tsx:231-249`.
- **A11Y-05 — Therapy export controls do not communicate labels or selection state (S).** Label every switch, expose ranges as radio options with selected state, and add disabled/busy semantics to Export. Evidence: `src/app/therapy-export.tsx:343-376,391-417,542-560`.

### Design and product conformance

- **DS-01 — Colored side stripes contradict the documented visual language (S).** Remove them from Settings category and calendar-entry cards; use icon badges, full borders, or tonal headers instead. Evidence: `DESIGN.md:188,218-223`, `src/features/settings/components/SettingsCategoryCard.tsx:88-95`, `src/components/calendar/DayDetailModal.tsx:154-161`.
- **INS-01 — Streak presentation conflicts with the anti-gamification principle (M).** Flame icons, records, personal-best progress, and Active/Inactive language can pressure honest logging. Replace with neutral days-recorded context or hide it by default; update onboarding in the same slice. Evidence: `PRODUCT.md:19-21,28-29`, `src/features/insights/screens/InsightsScreen.tsx:351-355`, `src/features/insights/components/StreakBadge.tsx:94-254`, `src/features/onboarding/content.ts:31-35`.
- **SET-03 — Run Backup is an undersized, unlabeled nested action (XS).** Make it a full SettingRow action or a full-size labeled button with role, disabled, and busy state. Evidence: `src/app/settings/data.tsx:245-267`.

## Priority 2

### Accessibility and interaction

- **A11Y-06 — Calendar add is available only through long press (S/M).** Add an explicit Add mood entry action in the empty-day sheet and a custom accessibility action on calendar cells. Evidence: `src/components/calendar/CalendarDay.tsx:45-79`, `src/components/calendar/DayDetailModal.tsx:111-133`.
- **A11Y-07 — Mood history cards contain nested and duplicate actions (M).** Choose one interaction model: card plus sibling actions, or card custom actions. Evidence: `src/components/DisplayMoodItem.tsx:355-377,446-457,488-499`.
- **A11Y-08 — Recent mood rhythm is meaningless to screen readers (S).** Mark it decorative or announce a useful date/value/trend summary. Evidence: `src/features/insights/components/InsightsHeader.tsx:124-128,154-167`.
- **A11Y-09 — Onboarding pagination still animates under Reduce Motion (XS).** Pass the preference to pagination or consume the shared hook. Evidence: `src/features/onboarding/components/OnboardingPagination.tsx:39-47`, `src/features/onboarding/screens/OnboardingScreen.tsx:130-143`.

### Global design system and navigation

- **DS-02 — Header behavior drifts across routes (M).** Consolidate notifications, therapy export, and other one-off headers through shared headers; expose titles as headings and enforce 44 pt back actions. Evidence: `src/components/ui/ScreenHeader.tsx:37-89`, `src/app/notifications.tsx:149-180`, `src/app/notifications/[id].tsx:174-205`, `src/app/therapy-export.tsx:264-298`.
- **DS-03 — Insights uses parallel hard-coded palettes (M).** Move Entry Detail and Streak surfaces onto semantic theme tokens and shared surface/icon primitives. Evidence: `src/features/insights/components/EntryDetailModal.tsx:94-365`, `src/features/insights/components/StreakBadge.tsx:55-69,108-169,238-249`.

### Home and mood entry

- **HOME-01 — The signature mood selector morphs excessively during scroll (M).** Under Reduce Motion, use a static swap; fully hide the inactive selector from accessibility and pointer input during the transition; test at 200% font. Evidence: `src/app/(tabs)/index.tsx:448-538,641-716`, `src/components/home/UnifiedMoodSelector.tsx:93-131`.
- **HOME-02 — Header text shrinks rather than adapting to large text (S).** Allow greeting/date to wrap and move or hide the secondary streak chip at accessibility font sizes. Evidence: `src/components/home/HomeHeader.tsx:103-133`.
- **HOME-03 — MoodEntryModal concentrates too many UX responsibilities (L).** Do not broadly rewrite it; extract only a shared accessible sheet shell, step navigation, and preset dialog while preserving behavior. Evidence: `src/components/MoodEntryModal.tsx:136-1511`.

### Calendar and insights

- **CAL-01 — Coverage, best day, and busiest language frames check-ins as performance (S).** Use neutral logged days, entries, and average summaries, or make the summary optional. Evidence: `src/components/calendar/MoodCalendar.tsx:347-468`.
- **CAL-02 — Calendar arrows lack minimum target and disabled semantics (XS).** Apply the shared target policy and `accessibilityState.disabled`. Evidence: `src/components/calendar/CalendarHeader.tsx:49-101`.
- **INS-02 — Two-column metric cards do not adapt to narrow screens or large text (S/M).** Stack at a width/font-scale breakpoint. Evidence: `src/features/insights/screens/InsightsScreen.tsx:293-349`.
- **INS-03 — Entry Detail lacks modal focus semantics and motion handling (M).** Add focus containment, heading focus, selectable important data, semantic surfaces, and reduced-motion behavior. Evidence: `src/features/insights/components/EntryDetailModal.tsx:47-367`.

### Settings, privacy, onboarding, and notifications

- **SET-01 — Settings opens with a profile-like dashboard despite having no accounts (S/M).** Replace it with a compact privacy/status row and keep historical counts in Insights. Evidence: `src/features/settings/screens/SettingsScreen.tsx:78-99`, `src/features/settings/components/ProfileCard.tsx:17-93`.
- **SET-02 — Toggle rows have split interaction/focus behavior (M).** Build one accessible toggle-row primitive where the full row toggles exactly once and exposes switch state without nested controls. Evidence: `src/features/settings/components/ToggleRow.tsx:27-47`, `src/features/settings/components/SettingRow.tsx:34-90`.
- **SET-04 — In-app privacy copy does not describe all current local data behavior (S).** Synchronize root and in-app policy wording and Last Updated dates in one legal-reviewed slice, covering settings, reminders, energy, app lock, local backup, and export. Evidence: `src/app/settings/privacy-policy.tsx:31-84`.
- **ONB-01 — Wellness-coaching copy conflicts with the private-tool voice (S).** Replace journey, companion, grow, and mental-wellness language with neutral, concrete local mood-tracking copy across onboarding/about/settings. Evidence: `src/features/onboarding/content.ts:13-16,31-35`, `src/app/settings/about.tsx:101-103,153-156`, `src/features/settings/components/ProfileCard.tsx:43-48`.
- **NOTIF-01 — Reminder copy can feel pressuring (XS).** Replace Stay on track, build a habit, and Pro tip with optional, neutral language. Evidence: `src/app/notifications.tsx:166-177,217-246,413-432`.
- **NOTIF-02 — Notification validation is alert-only (S).** Add persistent inline errors, invalid accessibility state, live announcements, and focus the first invalid field. Evidence: `src/app/notifications/[id].tsx:88-98,266-315`.

## Positive patterns to preserve

- Warm paper/botanical palette and semantic role colors are coherent.
- Mood-scale direction is generally explained correctly where ratings appear.
- Ionicons are used consistently, including the leaf/heart/calendar/lock onboarding sequence.
- Most main flows already use scrolling, safe areas, labeled actions, and disabled states.
- Crisis support is non-blocking and presented after saving severe ratings.
- Import/export previews clearly explain replacement and external sharing consequences.

## Recommended vertical slices

1. Accessibility foundations: A11Y-01 through A11Y-04, shared touch-target and motion primitives.
2. Sensitive flows: A11Y-05, SET-03/04, notification validation, calendar-add accessibility.
3. Product tone: INS-01, CAL-01, ONB-01, NOTIF-01, and SET-01 in one reviewed copy slice.
4. Design consolidation: DS-01/02/03 and shared Settings/detail surfaces.
5. Responsive polish: HOME-01/02, INS-02/03, followed by physical-device testing.

Accessibility, privacy/legal, and crisis-adjacent slices should use **Human must merge**. Test on narrow and short devices, largest system font, VoiceOver, TalkBack, Reduce Motion, light/dark mode, and both platforms.
