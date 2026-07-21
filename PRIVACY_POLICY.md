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

Data exports and backups are plaintext JSON files and are not encrypted by Moodinator. A temporary export remains local until you choose to save, share, or copy it. You may choose a destination or another app through the operating system; those choices can include cloud-backed storage providers. On Android, backup creation requires a user-selected folder. On iOS, the default backup location is the app's Documents area.

After data is exported, copied, shared, or saved outside Moodinator's private storage, the destination provider's and operating system's practices apply. Anyone with access to those files or the clipboard may be able to read their contents. Moodinator cannot control or delete copies stored outside the app.

## External Support Actions

For ratings 9 and 10, Moodinator offers crisis-support actions. If you choose one, the app asks the operating system to open the phone or messaging app for U.S. 988, or opens Find A Helpline at <https://findahelpline.com/>. These actions are user-initiated. Moodinator does not monitor entries, contact emergency services, or send your mood entry to those services. Your carrier, browser, operating system, or selected service may process information under its own terms and privacy policy.

## Data Sharing and Sale

We do not operate servers that receive your Moodinator data, and we do not sell it. Moodinator contains no advertising or analytics SDKs. Data leaves the app only when you deliberately export, share, copy, back up, import, or open an external support action as described above, or when the operating system handles device backup or transfer outside our control.

## Your Control and Deletion

You can:

- Delete an individual mood entry.
- Use **Settings > Data & Backups > Delete Mood Data** to delete mood entries, their mood–emotion links, and the app's saved emotion list from the local database.
- Export or back up mood history before deleting it.

"Delete Mood Data" does **not** delete app settings, reminders, app-lock settings or secure-storage PIN hash, context-tag presets, or export and backup files saved outside the app. Uninstalling normally removes app-sandbox data, but external files remain, secure storage and platform backups may behave differently by operating system, and platform backup or device-transfer features may retain or restore data. Review and delete external files through the destination where you saved them.

Because Moodinator has no account and we do not hold a server-side copy of your data, there is no developer-side account or data-deletion request for us to perform. Delete data in the app, uninstall it, and remove any external copies from their destinations.

## Children's Privacy

Moodinator is not directed at children under 13. Because we do not receive app data, we do not knowingly collect personal information from children through developer-operated servers.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will identify changes by updating the "Last Updated" date. Review this policy periodically.

## Contact and Source

Questions about this Privacy Policy can be sent to **support.moodinator@lab4code.com**.

Source repository: <https://github.com/MaximilianMauroner/moodinator>
