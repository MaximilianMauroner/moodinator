# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

The app is React Native with Expo and also builds for iOS. Google Play is the
only release channel today.

## Users

People who want a private record of how they feel. They check in several times
a day or once at night, often on the move, and sometimes on a bad day. Some
bring the record to a therapist. The Play audience includes ages 13 and up.

## Product Purpose

Moodinator is a personal mood journal. It makes a check-in fast and helps the
user see patterns in their history. Success means the user logs regularly,
feels better understood by their own record, and can find what affects their
mood.

## Positioning

Local-first and private. No account, no developer server, no analytics, no ads.
Data leaves the device only when the user exports, shares, copies, or backs it
up.

## Operating Context

- One tap on a weather tile saves a mood; optional detail follows, with Undo.
- Detailed entry: mood, up to three emotions, context tags, energy, and notes.
- "Same as last entry" repeats the previous entry.
- History list with swipe to edit or delete.
- Insights: trend, rhythm (time and weekday), drivers (emotions and contexts
  linked to better or worse mood), averages, range, streaks.
- Therapy export and JSON backup to a location the user selects.
- Reminders through notifications. Optional app lock.
- Crisis-support links for severe ratings.

## Capabilities and Constraints

- The stored scale is 11 levels, 0 (Elated) to 10 (Emergency). Lower is better.
  Labels: Elated, Very Happy, Good, Positive, Okay, Neutral, Low, Struggling,
  Overwhelmed, Crisis, Emergency.
- Entries store a scale snapshot, so a new input model is possible with a
  mapping or migration.
- Energy is a separate optional segmented value.
- Emotions and context tags are user-customizable.
- Works offline. Dark and light mode are both supported.
- Open decision (2026-09-28): a redesign may replace the input model entirely.

## Brand Commitments

- Name: Moodinator.
- Icons use Ionicons, not emoji.
- The product must not present itself as a medical device, diagnosis, or
  treatment. Wording stays descriptive and self-reflective.
- Keep the current visual world (decided 2026-09-28): the soft organic
  palette (sage, paper, sand, dusk, coral), a serif greeting over a sans body,
  rounded shapes, and a calm, comfortable feel in dark and light mode. A
  redesign changes structure and interaction inside this world, and it must
  feel lighter than today, not heavier.
- Redesign direction (chosen 2026-09-29): "Inner weather". Each level is a
  weather sign, from sun at 0 to a storm at 10, always with its word and
  number. The level picker uses rows of 4, 3, and 4 (clear 0 to 3, cloudy
  4 to 6, rain 7 to 10). History reads like a forecast with each day's lightest-to-heaviest
  range. Colors: the Soft Sage surfaces with slightly livelier mood colors.
  Severe ratings keep the entry, then show support first. Source:
  `.agents/artifacts/design/moodinator-redesign/build_r13.py` and
  `build_r14.py`.

## Evidence on Hand

- Store listing source: `docs/release/google-play/store-listing.md`.
- No testimonials, user counts, or clinical evidence exist. Do not invent them.
- Screenshots must use fabricated data.

## Product Principles

1. A check-in must be fast enough to do on a bad day.
2. Private by construction. Never imply sync, accounts, or tracking.
3. Insight explains the user's own data. It does not judge or diagnose.
4. Severe ratings always offer a clear path to support.

## Accessibility & Inclusion

- Mood must never be conveyed by color alone; each level keeps a label.
- Touch targets meet Android minimums. Screen reader labels on all controls.
- Tone suits teenagers and adults and stays calm on severe ratings.
