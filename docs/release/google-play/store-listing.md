# Moodinator Google Play listing

This is the reviewable source for the first English Google Play listing. The
Play Console remains authoritative for submission state. Screenshots must use
fabricated data only.

## Listing metadata

- App name: Moodinator
- Package: `com.lab4code.moodinator`
- Release candidate version: `0.1.5` (Android versionCode is assigned from the
  monotonically increasing EAS remote counter)
- Category: Health & Fitness
- Pricing: Free
- Ads: None
- In-app purchases: None
- Initial distribution: Global
- Target audience: Ages 13–15, 16–17, and 18+ (approved September 15, 2026)
- Support email: `support.moodinator@lab4code.com`
- Website: <https://github.com/MaximilianMauroner/moodinator>
- Privacy policy: <https://github.com/MaximilianMauroner/moodinator/blob/main/PRIVACY_POLICY.md>

## Declaration reference

- Health apps: Mental and behavioral health; personal wellness only.
- Ads, Advertising ID, government, and financial features: None.
- IARC: ESRB E10+ (Violent References), PEGI 3, and USK 6+. Bundled
  self-harm/crisis-support text was disclosed in the questionnaire.
- Data Safety: No required data collection or sharing. This is based on no
  developer-operated backend, account, analytics, advertising, or remote sync;
  disabled Android Auto Backup; and user-initiated export, share, document
  provider, and external-link flows. Revalidate this answer against every final
  signed candidate and revise it if dependencies or data flows change.

## Short description

Track moods privately, spot patterns, and keep your data on your device.

Character count: 72 of 80.

## Full description

Understand how you feel, one private check-in at a time.

Moodinator is a personal mood journal that makes it quick to record how you
feel and review your history over time. Tap for a quick entry or add emotions,
context, energy, and notes when you want more detail.

YOUR PRIVATE MOOD JOURNAL

- Record moods on an 11-level scale where 0 is best and 10 needs the most support
- Add optional emotions, context tags, energy levels, and notes
- Edit or delete entries whenever you choose
- Set local check-in reminders

REFLECT ON YOUR HISTORY

- Browse previous entries and calendar days
- Review descriptive weekly, monthly, and longer-range summaries
- Filter history by mood, text, emotions, context, and dates
- Create a plaintext CSV report for a therapist or healthcare professional you choose

LOCAL-FIRST BY DESIGN

- No Moodinator account
- No developer-operated data server
- Moodinator does not use advertising or analytics
- Core mood tracking works offline
- Export, share, and back up data only through destinations you select

Mood data is stored in the app's local Android database. Moodinator does not
apply database-level encryption to that database. JSON exports, backups, and
CSV reports are plaintext, so protect files you save or share. User-selected
destinations, including cloud-backed providers, apply their own practices.

Moodinator is not a medical device and does not diagnose, treat, cure, or prevent any medical condition. Consult a healthcare professional for medical advice, diagnosis, or treatment.

Moodinator does not monitor entries, provide live crisis support, contact
emergency services, or dispatch help. If someone may be in immediate danger,
call the local emergency number. U.S. users can call or text 988; users
elsewhere can open Find A Helpline to locate external support resources.

## Release notes

Initial Google Play release with private mood logging, searchable history,
descriptive insights, local reminders, app lock, and user-controlled exports
and backups.

## App access and reviewer instructions

- No Moodinator account, sign-in, subscription, or access credential is required.
- App lock is optional and disabled on a fresh install. It does not block review.
- On first launch, use **Next** to view the four onboarding pages, then choose
  **Get Started**. Tap a mood on Home to create a quick entry, or press and hold
  a mood to open the detailed entry form.
- To review the optional local lock, open **Settings > Security > Enable App
  Lock** and create any temporary 4- or 6-digit PIN. No preconfigured PIN is
  supplied. Biometric review appears only when strong biometrics are supported
  and enrolled. The PIN and biometric match remain on the device.
- Use fabricated mood data only. No reviewer identity or personal health data is
  needed.

## Graphic inventory

- `assets/store/google-play/icon-512.png`: 512×512 32-bit RGBA PNG store icon.
- `assets/store/google-play/feature-graphic-1024x500.png`: 1024×500 PNG feature graphic draft; human visual approval required.
- `assets/store/google-play/screenshots/01-home.png` through `04-quick-entry.png`: 1080×2160 24-bit RGB portrait phone screenshots from a release QA build with fabricated data. Recapture from the final audited release candidate if its UI differs.
- `assets/store/google-play/screenshots/05-history-insights.png`: 1080×2160 24-bit RGB populated Findings screenshot captured on the `moodqa` Android 35 AVD from a locally signed universal APK generated from the audited production AAB version code 34. Its 100 entries came from the repository's synthetic QA fixture generator.

## Screenshot order and captions

1. Home — “A private check-in, whenever you need it”
2. Detailed entry — “Add the detail that matters to you”
3. Data export — “Your history stays under your control”
4. Quick entry — “Log how you feel in a moment”
5. History and insights — “See descriptive findings from your history”

## Claim and submission guardrails

- Keep “local-first” rather than “data never leaves your device”: exports,
  backups, clipboard actions, and external crisis links can move data or open
  another provider.
- Do not claim Android database encryption or encrypted exports.
- Do not claim diagnosis, treatment, causal insights, monitoring, guaranteed
  backup execution, or emergency response.
- Recheck the final text against the production AAB and the approved Data Safety
  and Health apps declarations before pasting it into Play Console.
