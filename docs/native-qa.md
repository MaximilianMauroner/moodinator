# Native QA

Run the Maestro flow on a disposable Android emulator and record the result in
the task tracker. Passing unit tests or parsing YAML does not verify native
layout, gestures, haptic strength, or frame timing.

## Isolated Android setup

Use the separate `com.lab4code.moodinator.qa` app on a disposable emulator. The
smoke flow clears that app's data at launch. Do not point the flow at the normal
Moodinator package or a device that holds personal mood data.

1. Run `bun run qa:prepare` from the repository. Use the isolated checkout path
   printed by that command for the QA build.
2. Build and install its Android app with `MOODINATOR_VARIANT=qa`. Confirm that
   the installed package is `com.lab4code.moodinator.qa` before continuing.
3. Install Maestro and Android SDK platform tools. Start one disposable emulator.
4. Run `bun run qa:smoke -- emulator-5554` with the actual emulator serial. Keep its guard enabled. It checks the emulator and QA
   package before invoking `.maestro/smoke.yaml`.
5. Record the commit, Android API level, emulator profile, build type, command,
   result, and artifact paths in the task tracker.

Use an installed build that starts directly into the app. If a debug build opens
an Expo development launcher, resolve that setup before running the flow. The
flow does not dismiss unexpected screens or skip failed steps.

## Automated smoke coverage

The flow checks all four onboarding pages, creates a detailed neutral mood with
an emotion, energy, and note, restarts the process, and reads the saved fields in
the edit form. It then updates the note, reopens the form to check it, deletes
the entry, restores it with Undo, and opens and refreshes Insights.

The flow expects fresh QA data, the default entry fields, and English app text.
It uses accessibility labels for actions and test IDs for repeated controls.
An unexpected permission prompt, missing control, save failure, or different
entry count must fail the run. Investigate the failure before updating selectors.

## Manual checks

Record pass, fail, or not tested for each item. Include reproduction steps for
failures. Use fabricated data only.

| Area | Check | Expected result |
| --- | --- | --- |
| Emotion feedback | Select three emotions, try a fourth, remove one from the summary, then select another. | One short event per valid change. No event or state change for the blocked fourth selection. |
| Context feedback | In Quick, Detailed, and Edit Entry with context enabled, select and deselect a context tag. Cancel a press by dragging off the chip. | One short event per accepted change. No event for a canceled press. |
| Energy feedback | Select 0, select 10, tap the selected level, then set and clear energy. | Zero is retained as a value. Tapping the selected level and Clear both remove it. One short event per change. |
| Preference | Turn haptics off in Settings. Repeat emotion, context, energy, save, and navigation actions. Restart and repeat. | Fields still work. App feedback remains silent after restart. |
| Android modal feedback | Record the device, API level, build revision, and app/system vibration settings. Compare selection feedback on Home and in each entry modal. Toggle the system touch-feedback setting and repeat. | Selection remains brief in modals. Record system-setting behavior: Expo selection uses the vibrator service, so it is not equivalent to Android view feedback. The in-app off setting must always silence it. |
| Restrained feedback | Select the current emotion category again, then change it. Copy the previous entry once. | No event for an unchanged category. One result event after copying, without an initial buzz. |
| Device feedback | Repeat on a real Android device and, when available, an iPhone. | Feedback is brief and consistent. Emulator silence is not evidence of physical feedback quality. |
| Touch | Use a narrow screen and large system text. Tap the edges of emotion chips, summary chips, each energy level, Clear, and Refresh. | Controls remain separate and reachable. Labels do not overlap. Energy wraps in numeric order. |
| Keyboard | Open detailed entry, focus notes, type several lines, hide the keyboard, move back, then save. | Notes and footer remain reachable. The first Back action dismisses the keyboard where applicable. |
| Readability | Check light and dark themes, especially energy levels 7 through 10. | Numbers, selection, and removal hints remain legible. |
| Reduced motion | Enable the system's reduced motion setting. Visit onboarding, Insights, and app lock, then select and save fields. | No continuous decorative motion. Feedback does not block input. |
| Gestures | Swipe a history row right to edit and left to delete. Undo the deletion. | The intended row changes. Restored data matches the original. |
| Draft errors | Change a note, close the form, choose Keep editing, then close and discard. | Keep editing preserves the draft. Discard leaves the saved entry unchanged. |
| Save errors | In an isolated test build, make the storage write reject through a local debugger or test harness. Submit a populated draft, restore storage, and retry. | Save failed appears. The form and draft remain. Retrying creates one entry. No production error switch is required. |
| Load errors | In an isolated test build, make the history or Insights read reject, then restore it and refresh. | The error is visible. Loading ends. Retry recovers. Existing entries remain intact. |
| Import errors | Import malformed JSON through the normal Settings import action. | The error is visible and existing entries are unchanged. |

If fault injection is unavailable, mark save and load errors as not tested.
Do not substitute disabling networking: the app stores its data locally.

## Large history and performance

Generate synthetic exports with `bun run qa:fixtures -- 1000 /tmp/moodinator-fixtures-1000.json` and repeat with 10,000 entries. Transfer each
file to the QA emulator, then import it through the normal Settings import flow.
Use a fresh QA dataset between sizes. Do not load fixtures into the normal app.

Use an Android profile or release build for measurements. Record the device,
build, dataset size, refresh rate, thermal state, and measurement tool. Keep
these conditions the same when comparing runs.

1. Scroll through history and return to the newest entry. Edit, delete, and undo
   a row after several recycled rows have appeared. Check for stale notes,
   collapsed rows, blank cards, and repeated entries.
2. Open Insights, switch the date range, and refresh. Check that loading ends and
   totals match the imported data for the selected period.
3. Capture startup and scroll frame timing with Android Studio System Trace or
   Perfetto. Record slow frames and pauses. Retain the capture with the task.
4. Leave Home, Insights, onboarding, and app lock idle for 30 seconds each after
   transitions finish. Capture rendering work. Decorative icons and rhythm dots
   should not keep producing animation frames. A busy operation or lockout
   countdown must be assessed separately.
5. Repeat the route several times and compare memory after the app settles.
   Investigate retained growth before calling the run clean.

Do not report a performance improvement without comparable captures. The
prepared smoke flow is a functional check and does not measure frame rate.
