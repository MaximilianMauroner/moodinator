# Privacy Policy

**Last Updated: July 21, 2026**

## Introduction

Moodinator ("we", "our", or "the app") is a local-first mood tracking application. This Privacy Policy explains what information the app handles, where it is stored, when it can leave your device, and what you can delete.

## Information Stored on Your Device

Moodinator stores information you choose to enter or configure, including:

- **Mood data:** ratings on the 0–10 scale, timestamps, notes, emotions, context tags, energy values, and related history
- **Settings:** entry preferences, display preferences, onboarding state, and other app configuration
- **Reminders:** local notification titles, messages, schedules, permission state, and scheduling identifiers
- **App lock data:** whether app lock and biometrics are enabled, PIN length, failed-attempt state, and a salted hash of your PIN
- **Backup metadata:** the selected backup folder and the time of the latest backup

This information is processed and stored locally. Moodinator has no developer-operated server, user account system, cloud synchronization, advertising, or analytics. We do not receive your mood data or app settings.

## Storage and Security

Mood data is stored in the app's local SQLite database inside the operating system's app sandbox. On Android, Moodinator does **not** apply database-level encryption to that SQLite database. The app sandbox, device encryption, screen lock, and other platform protections may reduce access, but app lock is not database encryption.

If you set an app-lock PIN, Moodinator stores a salted hash—not the plaintext PIN—in the operating system's secure storage. Biometric enrollment and biometric matching are handled by the operating system; Moodinator does not receive or store your fingerprint, face, iris, or biometric template.

No security measure can guarantee absolute protection. Use a device passcode, keep the operating system updated, and protect access to unlocked devices and exported files.

## Local Notifications

Moodinator schedules reminder notifications locally on your device after you enable them and grant permission. Reminder titles and messages may be visible on the lock screen or in notification history, depending on your device settings. Moodinator does not use remote push notifications.

## Exports and Backups

Mood-history exports and backups are plaintext JSON files. Therapy exports are plaintext CSV files. Moodinator does not encrypt these files. On Android, a JSON export is written to a folder you select. On iOS, JSON exports are written temporarily to the app cache and offered to the operating-system share sheet. Therapy CSV exports are also written temporarily to the app cache and offered to the share sheet. If sharing is unavailable, the app can offer to copy the full JSON or CSV content to the device clipboard, where other apps may be able to read it.

Moodinator attempts to delete its temporary cache export after the export flow, but an interrupted or failed share can leave a temporary file until the operating system clears the app cache. You may choose another app or destination through the operating system, including a cloud-backed storage provider. After data is copied, shared, or saved outside Moodinator's private storage, the destination provider's and operating system's practices apply.

Moodinator registers a periodic backup task with the operating system. The operating system decides whether and when it runs; execution is not guaranteed. After backup storage is available, the task may create a backup automatically and throttles successful backups to at most once per week. On Android, no backup can be created until you select a folder. On iOS, the app's Documents area is the default. Moodinator's retention cleanup keeps the eight newest app-managed `moodinator-backup-*.json` files it can identify in its managed backup locations and deletes older identified backups. This cleanup does not delete arbitrary exports, renamed copies, clipboard contents, or copies held by another app or provider.

## External Support Actions

For ratings 9 and 10, Moodinator offers actions to call or text U.S. 988 and advises users elsewhere to contact a local crisis helpline. If you choose a 988 action, the app asks the operating system to open the phone or messaging app. Moodinator does not monitor entries, contact emergency services, or send your mood entry to a support service. Your carrier and operating system may process the call or message under their own terms and privacy policies.

## Data Sharing and Sale

We do not operate servers that receive your Moodinator data, and we do not sell it. Moodinator contains no advertising or analytics SDKs. Data can leave the app when you deliberately export, share, copy, import, or open an external support action; when an OS-scheduled periodic backup runs after backup storage is available; or when the operating system handles device backup or transfer outside our control.

## Your Control and Deletion

You can:

- Delete an individual mood entry.
- Use **Settings > Data & Backups > Delete Mood Data** to delete mood history, including mood rows, mood–emotion link records, and database emotion records used by that history.
- Export or back up mood history before deleting it.

"Delete Mood Data" does **not** delete the user-visible Emotion List presets, context-tag presets, other app settings, reminders, app-lock settings or secure-storage PIN hash, or export and backup files saved outside the app. Uninstalling normally removes app-sandbox data, but external files remain, secure storage and platform backups may behave differently by operating system, and platform backup or device-transfer features may retain or restore data. Review and delete external files through the destination where you saved them.

Because Moodinator has no account and we do not hold a server-side copy of your data, there is no developer-side account or data-deletion request for us to perform. Delete data in the app, uninstall it, and remove any external copies from their destinations.

## Children's Privacy

Moodinator is not directed at children under 13. Because we do not receive app data, we do not knowingly collect personal information from children through developer-operated servers.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will identify changes by updating the "Last Updated" date. Review this policy periodically.

## Contact and Source

Questions about this Privacy Policy can be sent to **support.moodinator@lab4code.com**.

Source repository: <https://github.com/MaximilianMauroner/moodinator>
