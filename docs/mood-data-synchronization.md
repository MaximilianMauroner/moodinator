# Mood data synchronization

SQLite holds durable mood history. `moodService` exposes database operations to
application code. Ordinary entry writes use `createMoodEntryWorkflow` through
`useMoodsStore`; successful writes update the history window, change its revision,
and invalidate subscribed mood queries.

`useMoodsStore.moods` is the loaded history window. It is not a complete copy of
the database. Mutation refreshes preserve that window's size so Undo does not
remove a restored entry from an already loaded later page. A new filter or an
explicit initial load starts at 50 entries. Offset pagination pauses until a
refresh confirms the new window. Unfiltered writes adjust the count at commit;
filtered membership and counts remain subject to SQL confirmation. History marks
its count as pending refresh while stale. A failed follow-up read does not undo a
successful write or discard the confirmed unfiltered row.

`moodQueries` provides keyed range, month, summary and recent-entry reads.
`moodQueryCache` owns deduplication, pending requests, errors, invalidation and
stale-response rejection. `useMoodQuery` subscribes React views to those results.
Only subscribed queries reload on a write. The last subscription releases the
query after a microtask, allowing React's immediate effect resubscription.
Selected ranges use distinct keys; a previous range cannot publish into a new
selection. Errors retain prior data with a stale flag until an explicit retry or
another write. No automatic retry loop hides native failures.

Forecast, calendar and Insights use complete SQL results for their own ranges,
not the paginated history window. Recorded timezone grouping remains in their
domain calculations. The forecast's open day detail stores the selected day key
and derives its entries from the current forecast query. Empty days stay open
with the existing empty state.

Bulk changes call `useMoodsStore.getState().invalidate()` after a confirmed
commit. This refreshes history and invalidates the same subscribed queries used
by ordinary writes. Import publishes its change before optional preset sync so
a preset error cannot hide committed data. Historical emotion changes, developer
seed/clear, bootstrap changes and full developer reset use this notification
path. New write callers must use store actions or this bulk notification.

The Android build 46 `NativeDatabase.prepareAsync` shared-object error remains
unresolved. It occurs before SQL preparation; it is not evidence of damaged mood
records. Its diagnosis and native acceptance are tracked separately in issue 113.
Node SQLite and rendered tests cannot verify Expo's native object bridge.
