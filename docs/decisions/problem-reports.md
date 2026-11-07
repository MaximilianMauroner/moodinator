# Problem reports send only what the person types

On 7 November 2026 Max asked for a way to send a problem or an idea from the
app. Settings > About has **Report a problem or idea** for this.

- A report holds the kind, the text that the person types, an optional email
  for a reply, the app version and build, and the system name and version.
- A report never holds moods, entries, notes, emotions, tags, settings, or a
  device identifier. The app sends it only when the person taps Send.
- Reports go to the Mauroner Tools reports inbox without an account, a token,
  or a cookie. The server can receive normal connection data, as any site can.
- Only builds made from the `production` EAS profile, and the profiles that
  extend it, know the address of the inbox. Other builds do not show the
  screen.

Reason: the developer needs to hear about problems, and the app has no
account or analytics to find them. A report that holds only typed text keeps
the promise that mood data never leaves the device without a deliberate
export. A development or QA build must never write test reports into the real
inbox.
