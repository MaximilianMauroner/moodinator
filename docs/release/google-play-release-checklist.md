# Google Play Release Checklist

Use this checklist before submitting a production Android build.

## Automated gate

Run:

```sh
bun run verify
bun run verify:android-release-config
npx expo config --type public
```

`bun run verify` runs lint, TypeScript, unit tests, and Expo Doctor. Expo Doctor must be green before release. `verify:android-release-config` requires Expo to block `android.permission.SYSTEM_ALERT_WINDOW`, confirms the production EAS profile is not configured as an APK, and checks any available native manifests. A main-manifest declaration is accepted only when it uses `tools:node="remove"`; generated release manifests under Gradle's `merged_manifest`, `merged_manifests`, and `packaged_manifests` outputs must not contain the permission at all. A clean managed checkout without an `android` directory is supported, so run the gate again after a local native release build whenever those generated manifests are available.

## Build

Use the production EAS profile:

```sh
bun run build:production
```

The Play Store submission artifact must be an Android App Bundle (`.aab`). Preview APKs are for internal testing only.

After every production build, inspecting the final bundle manifest is mandatory. Use [bundletool](https://developer.android.com/tools/bundletool) with the actual artifact path:

```sh
java -jar /path/to/bundletool.jar dump manifest \
  --bundle=/path/to/moodinator.aab \
  --module=base
```

Inspect the dumped `<uses-permission>` entries and confirm `android.permission.SYSTEM_ALERT_WINDOW` is absent before uploading the bundle to Google Play. The config checker and intermediate Gradle manifests are safeguards, but the bundled manifest is the release authority.

## Android smoke test

- Install the production-signed build on a clean Android device or emulator.
- Launch the app, complete onboarding, and confirm the scale explains that `0` is best and `10` needs the most support.
- Add a low-severity entry and a `9` or `10` entry. Confirm the severe entry saves and shows support actions.
- From the severe-entry support dialog, confirm **Call 988 (U.S.)** opens the dialer and **Text 988 (U.S.)** opens messaging. Confirm the dialog advises other users to contact a local crisis helpline, says to use the local emergency number for immediate danger, and says Moodinator does not monitor entries or contact/dispatch emergency services.
- Disable haptics in settings and confirm tab/mood button presses no longer vibrate.
- Create a reminder. Confirm it is paused by default, then enable it and verify the permission prompt appears before scheduling.
- Deny reminder permission, enable a reminder, and confirm the reminder row reports that it is not scheduled. Grant permission in Android settings, return to Moodinator, and confirm the app retries reminder recovery.
- Export data, import a valid export, then attempt an invalid import. Confirm invalid import fails before the destructive replace prompt and existing entries remain.
- Start an import and choose "Export Current Data First" from the replace prompt. Confirm the export sheet opens and the selected import is not applied.
- Delete local mood data from Settings -> Data & Backups, choose Cancel, and confirm Home/Insights data remains unchanged.
- Delete local mood data again, choose Delete Data, and confirm Home/Insights show no entries afterward. Relaunch and confirm they remain empty. Saved exports/backups outside the app should remain outside the deletion scope.
- Press Android Back during onboarding page 2+, PIN setup confirmation, lock-screen PIN entry, mood entry later steps, and mood entry add-emotion/context overlays. Confirm Back moves one step/sheet backward before exiting or exposing app content.
- Background and relaunch the app. Confirm enabled reminders remain scheduled or report a recoverable unscheduled state.

## Proposed Play Console answers

These answers describe the source in this release candidate. Reconfirm them against the production-signed Android App Bundle and every bundled SDK before submitting.

### Data Safety

Google defines collection as transmitting data off the device. It documents a specific user-initiated exception for **sharing**, but that exception must not be treated as a blanket exemption from collection. See [Google Play's Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469).

**Final Data Safety answers are unresolved. Do not submit the form until the Play owner and legal reviewer approve the classification against the final production AAB and SDK scan.**

Use this conservative candidate for that review:

- **Does your app collect or share any of the required user data types?** Candidate: **Yes** for collection because Moodinator can deliberately write user data to a user-selected cloud-backed destination.
- **Data collected:** Candidate: optional **Health info** and **Other user-generated content**, collected for **App functionality**, when the user deliberately exports or backs up mood history to a cloud-backed destination. Confirm the exact Play Console data-type mapping with the Play owner/legal reviewer.
- **Data shared:** Unresolved. A transfer to another app or provider that occurs only after the user's specific export/share action may qualify for Google's user-initiated sharing exception. Confirm each flow and destination model; do not apply that exception to the separate collection question.
- **Is all collected user data encrypted in transit?** Candidate: **No**. Moodinator writes plaintext JSON or CSV through operating-system destinations and does not control every selected provider or its transit behavior. Do not claim encryption in transit or use this answer to imply data-at-rest encryption.
- **Can users request deletion of collected data?** Unresolved for the form classification. Moodinator has no account or developer-held server copy. Its in-app Delete Mood Data control cannot delete files or copies in user-selected destinations; users must delete those through the destination provider.
- **Account creation / account deletion URL:** No account creation; no account-deletion URL.
- **Independent security review:** No, unless a qualifying review is completed before submission.
- **Ads:** No ads.

Relevant implementation facts that must remain consistent with the form:

- Android Auto Backup is disabled.
- The Android SQLite mood database is app-sandboxed but not encrypted by Moodinator.
- JSON exports/backups and therapy CSV exports are plaintext.
- Moodinator has no remote-notification registration, developer API, analytics SDK, or advertising SDK.

### Health apps declaration

Google requires every Play app to complete the declaration and lists mood/mental-health tools under health features. See [Health apps declaration guidance](https://support.google.com/googleplay/android-developer/answer/14738291) and [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511).

- **Does the app provide health features?** Yes.
- **Feature category:** Mental and Behavioral Health.
- **Medical device app:** No. Moodinator is a personal wellness journal and is not presented as regulated medical-device software.
- **Health Connect or health permissions/data APIs:** None.
- **Clinical, diagnostic, treatment, or emergency-service functionality:** None. Moodinator does not diagnose, treat, cure, or prevent a medical condition; it does not monitor users or contact/dispatch emergency services.
- **Store-listing disclaimer:** Include this exact sentence in the app description: "Moodinator is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment."
- **Privacy policy:** Supply the final public, active, non-geofenced HTML URL in Play Console and retain the in-app policy screen.

## Human gates still required

- Confirm the release keeps Android Auto Backup disabled and explicitly accepts an app-sandboxed but non-encrypted Android SQLite database. Any decision to add encryption is a separate implementation and legal-review task.
- Scan the final production AAB and its dependency/SDK report for undeclared transmission, permissions, analytics, advertising, crash reporting, and push-token behavior. If findings differ, revise the app or the proposed answers before submission.
- Publish and verify the public privacy policy as active, non-geofenced HTML (not a PDF), then enter its URL in Play Console.
- Have the publisher/legal owner approve the privacy policy, health disclaimer, publisher identity, and the still-generic governing-law provision before release. Do not invent an entity or jurisdiction in the repository.
- Complete and save the Data Safety and Health apps declarations in Play Console using the approved final build and policy; treat the answers above as proposed, not pre-approved by Google.
- Add the required medical-device disclaimer to the Play Store description and verify it matches the in-app and root Terms.
- Confirm the Play Store target audience. If children are included, run a separate Families-policy review before submission.
- Confirm production signing credentials and Play app version code in EAS/Play Console before submission.
