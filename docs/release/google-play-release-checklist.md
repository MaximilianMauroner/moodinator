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
- Disable haptics in settings and confirm tab/mood button presses no longer vibrate.
- Create a reminder. Confirm it is paused by default, then enable it and verify the permission prompt appears before scheduling.
- Deny reminder permission, enable a reminder, and confirm the reminder row reports that it is not scheduled. Grant permission in Android settings, return to Moodinator, and confirm the app retries reminder recovery.
- Export data, import a valid export, then attempt an invalid import. Confirm invalid import fails before the destructive replace prompt and existing entries remain.
- Start an import and choose "Export Current Data First" from the replace prompt. Confirm the export sheet opens and the selected import is not applied.
- Delete local mood data from Settings -> Data & Backups, choose Cancel, and confirm Home/Insights data remains unchanged.
- Delete local mood data again, choose Delete Data, and confirm Home/Insights show no entries afterward. Relaunch and confirm they remain empty. Saved exports/backups outside the app should remain outside the deletion scope.
- Press Android Back during onboarding page 2+, PIN setup confirmation, lock-screen PIN entry, mood entry later steps, and mood entry add-emotion/context overlays. Confirm Back moves one step/sheet backward before exiting or exposing app content.
- Background and relaunch the app. Confirm enabled reminders remain scheduled or report a recoverable unscheduled state.

## Human gates still required

- Decide Android backup and data-at-rest policy before final Data Safety answers.
- Publish or confirm the public privacy policy URL.
- Complete the Play Console Data Safety form from the final approved policy.
- Confirm production signing credentials and Play app version code in EAS/Play Console before submission.
