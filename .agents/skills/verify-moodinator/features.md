# Feature map

Reusable procedure map. Reuse the recording-trust matrix
and runtime inventory in [Native QA](../../../docs/native-qa.md).

| ID | Journey and expected result | Existing procedure/source | Cleanup |
| --- | --- | --- | --- |
| M1 | Fresh onboarding, quick tap, Undo and detailed entry. One committed mood only; rejected/cancelled writes show no false success. 0 is best, 10 worst. | Native QA first-use matrix; mood service/store and draft tests | Clear only QA fixture. |
| M2 | Read/edit/date change/delete/Undo after paging and restart. Exact row identity persists; no duplicate/skipped history. | Native QA smoke/filter inventory | Dispose QA data. |
| M3 | Findings/Charts/Calendar ranges with known fabricated ratings and insufficient samples. Associations, not causes; recorded offsets remain stable across timezone travel. | Native QA insight fixtures and qa:timezone | Runner restores timezone. |
| M4 | Presets, custom emotions/context, quick-entry fields, themes and reduced motion. Next entry uses selected settings; narrow/large-text controls remain reachable. | qa:matrix and manual inventory | Runner restores display/motion settings. |
| M5 | JSON/CSV export, import replacement, malformed import, Android folder permissions, manual backup and retention, local deletion/offline restart. Plaintext and external-copy limits stay disclosed. | Native QA portability matrix; settings/data source | Owned synthetic destinations only; remove own exports. |
| M6 | PIN, biometrics/recovery, reminders and notification quick-log after restart. Physical-device terminated-process delivery remains separate. | Native QA protection/reminders matrix; appLock/notifications | Restore owned permissions/alarms. |
| M7 | Large history scroll/edit/undo, repeated routes and 30-second idle observations. No decorative continuous frames; performance claims need comparable captures. | qa:stress, Native QA performance protocol | Restore profile; stop owned AVD. |
| M8 | Privacy/terms/about and crisis-support links. Local-only limits and wellness scope match current app. Inspect link destination without sending messages. | README, legal docs and settings screens | Dismiss external draft. |

All native rows require a run-owned matching QA build and device/profile.
An installed SDK alone does not prove readiness. Historical smoke records
do not prove the current revision. A screenshot needs visual review; a
unit test cannot establish touch, gesture, haptic or device-notification behavior.
