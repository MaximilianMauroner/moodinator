# Conditional reminder native verification

This is a test procedure, not delivery evidence. Unit tests establish planning
and mocked service behavior only. Record each native case as pass, fail, or not
tested in the task tracker, with the exact candidate SHA, build checksum,
platform/version, device, permission settings, local timezone, clock time,
screenshots, and observed delivery time. Use a native build on iOS and Android;
no browser verification. Follow [Native QA](native-qa.md) for the disposable QA
package and isolated build. Use fabricated data only.

## Setup and observations

1. Install the exact candidate in an isolated QA app. Start with no entries,
   no ordinary reminders, and conditional reminders disabled. Complete onboarding.
2. Record the device timezone and local date. Set the conditional reminder time
   at least three minutes ahead so saving and cancellation finish before it fires.
3. For each case, capture the feature's status before and after the action. When
   available, use the native debugger's pending-notification list to record
   `no-entry-YYYY-MM-DD` identifiers, trigger dates, and total pending count.
   Do not add a production debug screen. If the pending list is unavailable,
   mark that observation unverified and record actual delivery separately.
4. Create fixtures through the normal mood entry form: mood 5, a note such as
   `QA conditional today A`, and the specified local date/time. Create yesterday,
   today, and tomorrow fixtures individually using the entry date/time editor.
   For import cases, export these fabricated entries as JSON, retain a copy with
   today's record and one without it, then import through Settings and confirm
   replacement. Check the file's timestamps before import; do not reuse fixtures
   whose dates became stale overnight.
5. Clear delivered notifications between cases and reset only the disposable
   QA app's data as needed. Leave ordinary reminders absent unless the row calls
   for them. Use a new time at least three minutes ahead for each delivery case.

## Native matrix

Run every applicable row on Android and iOS. “Today's request” means a future
request for the selected time on the device's current local calendar date.

| Case | Exact action | Expected observation |
| --- | --- | --- |
| Default and enable | With no entries, open Reminders; confirm the conditional feature is off. Enable it and grant notification permission. | A separate time control and truthful schedule status appear. At most 14 future one-shot requests exist, covering today through today + 13 calendar dates. The enabled state persists after reopening Settings. |
| Save today before delivery | Enable with the chosen time ahead. Save `QA conditional today A` through quick entry before the chosen time. Repeat independently through detailed entry. Background the app until after that time. | Today's pending conditional request is canceled after the entry commits. No conditional notification for today is observed. Future dates remain eligible. Record actual absence over the test interval; do not infer it solely from a mock assertion. |
| Other dates | With no entry today, save one entry yesterday and one tomorrow through date editing. | Yesterday cannot suppress today's request. Tomorrow's entry suppresses tomorrow's request. No request is created for yesterday. |
| Move an entry | Save one entry today, then edit its timestamp to yesterday while today's reminder time remains ahead. Move it back to today. | First edit makes today eligible again; second edit removes today's request again. Entry notes/mood edits alone cannot create duplicates. |
| Delete one of two | Save two entries today. Delete just one. | Today remains suppressed because one entry remains. |
| Delete last and undo | Delete the final entry today before the chosen time. Then Undo. Repeat deletion after the chosen time in a fresh case. | Before the time, deleting the last entry restores eligibility; Undo suppresses it again. After the time, no immediate or backfilled prompt appears. |
| Import replacement | Import the fabricated JSON containing a today entry; inspect the schedule. Import the version without today's entry while the time remains ahead. | The schedule is refreshed only after successful import. Today's request is removed and then becomes eligible again. A malformed/rejected import preserves entries and their reminder eligibility. |
| Disable | Enable, then disable the feature before the chosen time; restart the app. | Conditional requests are canceled and the feature stays disabled. Ordinary reminder requests remain as configured. |
| Ordinary collision | Configure an enabled, successfully scheduled ordinary reminder at the conditional time for today's weekday. Enable conditional reminders. Change the ordinary time by one minute, then restore it; also test a different weekday. | Same time on a selected day has one ordinary reminder and no conditional duplicate. Different times or different weekdays leave the conditional request eligible. Sunday follows Expo weekday 1. |
| Failed ordinary scheduling | In a QA debugger or test harness, make ordinary scheduling reject and retain an enabled ordinary configuration with failed status, then restore the scheduling API and refresh conditional reminders with permission granted. | An ordinary reminder that is not actually scheduled cannot suppress the conditional request. If controlled fault injection is unavailable, record this case as not tested. |
| Restart and foreground | Enable, background, reopen, terminate normally, and reopen several times before the chosen time. Repeat after local midnight. | Requests are reconciled without duplicates. The rolling horizon advances after the date change and entries for the new local day are considered. No past request is created. |
| Terminated delivery | With no entry today and a queued request, terminate the app normally and wait past the chosen time. Repeat with a today entry saved before termination. | Record whether the OS delivers the first and suppresses the second. Do not equate app-switcher termination with Android force-stop. OS permission, power policy, Focus/Summary, and force-stop may affect actual delivery. |
| Tap with app lock | Deliver a conditional reminder with the app unlocked, then repeat with app lock enabled and the app terminated. Tap the notification; cancel authentication once, then authenticate successfully. | Unlocked tap opens Home once. Locked tap reveals no mood data before authentication; cancel keeps it locked. After successful authentication/bootstrap, Home opens once, with no stale duplicate navigation on resume. Record notification, lock screen, and destination without personal data. |
| Permission denied/revoked | Deny permission on first enable. Later grant it in system settings and foreground the app. Then revoke permission and foreground again. | Desired feature state and unsuccessful scheduling status remain distinguishable. Foreground reconciliation reflects denied/restored access. No UI claim of confirmed delivery follows an API scheduling success. |
| Timezone change | With pending requests and near-midnight fabricated entries, change UTC to Asia/Kolkata, then Europe/Vienna. Foreground the app after each change. | Dates are reevaluated in the current device timezone and future requests use the selected local time. Recorded entry display may preserve its recorded offset; eligibility uses its timestamp in the current device timezone. |
| Timezone while unopened | Queue in one timezone, terminate, change timezone, and leave the app unopened through the originally scheduled instant. Then reopen. | Record the stale absolute-time behavior. Repair occurs on reconciliation after reopening; no promise is made that an unopened app repairs its queue. |
| DST spring/fall | Use Europe/Vienna around 29 March 2026 and 25 October 2026 (or the equivalent future transitions). Test 20:15, then the transition time 02:30 on independent runs. | Ordinary dates retain the selected local time, spanning 23/25-hour intervals. At 02:30, JS Date shifts the missing spring time forward and chooses the first repeated autumn time; at most one conditional request exists per date. Record native scheduling/delivery separately. |
| Horizon and capacity | Inspect dates after enabling and again after reopening the next day. In an isolated harness, populate other OS notification slots, then refresh; restore capacity and refresh again. | Horizon is today through today + 13, never an unbounded recurring trigger. Conditional requests are bounded by remaining capacity after ordinary/other requests. Capacity limitations are surfaced. Reopening replenishes the horizon. |
| Horizon without reopening | Queue the plan and leave the app unopened beyond its last queued date. A controlled clock/harness can inspect queue exhaustion, but cannot prove real elapsed-time delivery. | No requests beyond the finite horizon are promised. Record actual long-running delivery only if observed; changing the clock is a simulation. |
| Cancellation/scheduling failure | In an isolated native debugger, reject cancellation or scheduling, then restore the API and foreground again. | The app exposes an incomplete schedule and later retries reconciliation. It must not claim canceled requests are gone without a successful cancellation. Record this as not tested if fault injection is unavailable. |

## Reliability limits to preserve in handoff

- iOS and Android local notifications do not run a database predicate at fire
  time. The app plans one-shot requests in advance and cancels/rebuilds them
  after committed entry changes and on reconciliation.
- There is a crash window between the SQLite commit and native cancellation.
  If the process dies in that interval, a stale prompt may remain until the
  next successful reconciliation. A save acknowledgement is not proof that
  the OS queue was updated.
- The horizon contains only 14 local calendar dates, including today. It may
  contain fewer requests due to past times, existing entries, ordinary reminder
  collisions, or OS capacity. Opening the app replenishes it; an unopened app
  has no unlimited delivery guarantee.
- A timezone change while the app stays unopened cannot repair already queued
  absolute timestamps. Reopening reconciles the schedule in the new timezone.
- A successful scheduling API call, a pending request, and actual visible
  delivery are separate observations. Unit tests, native queue inspection,
  simulated date changes, and historical builds do not prove current-candidate
  delivery on a physical device.
