# Moodinator Context

Moodinator helps a person record mood observations and review patterns over time while keeping the data local to their device.

## Language

**Mood Entry**:
A timestamped record of how the person was feeling at a particular moment.
_Avoid_: Entry, mood log, record

**Mood Entry Snapshot**:
The principle that each **Mood Entry** should remain self-contained as the person recorded it, except for explicit edits to that entry.
_Avoid_: Mutable history, derived entry, partial entry

**Historical Update**:
An explicit user-approved rename that applies an **Emotion** or **Context Tag** name change to existing **Mood Entries**.
_Avoid_: Bulk edit, retroactive update, history sync

**Mood Rating**:
A self-reported selection from the **Mood Scale** that is saved on a **Mood Entry**.
_Avoid_: Mood score, mood level

**Mood Scale**:
The ordered scale from which a **Mood Rating** is selected.
_Avoid_: Rating scale, score scale

**Mood Rating Label**:
The named severity band attached to a **Mood Rating**, such as Elated, Neutral, Crisis, or Emergency.
_Avoid_: Mood, emotion, state

**Emotion**:
A named feeling the person can attach to a **Mood Entry** to describe what was present.
_Avoid_: Feeling, affect, emotion tag

**Emotion Type**:
The positive, negative, or neutral classification of an **Emotion**.
_Avoid_: Emotion category, valence

**Emotion Preset**:
An **Emotion** pre-loaded by the app as part of the starting emotion list.
_Avoid_: Emotion option, selectable emotion, default feeling

**Emotion List**:
The person's current selectable set of **Emotions**.
_Avoid_: Emotion presets, emotion options, feelings list

**Context Tag**:
A user-customizable situation label attached to a **Mood Entry**, such as Home, Work, Social, or Commuting.
_Avoid_: Context, activity, place

**Context Tag Preset**:
A **Context Tag** pre-loaded by the app as part of the starting context-tag list.
_Avoid_: Context preset, default context, activity preset

**Context Tag List**:
The person's current selectable set of **Context Tags**.
_Avoid_: Contexts, context options, activities list

**Energy Rating**:
A self-reported selection from the **Energy Scale** that is saved on a **Mood Entry**.
_Avoid_: Energy, energy level, arousal

**Energy Scale**:
The fixed 0-10 scale from which an **Energy Rating** is selected, where lower values mean more drained and higher values mean more wired.
_Avoid_: Energy level scale, arousal scale

**Mood Entry Note**:
Free text the person attaches to a **Mood Entry** for personal context.
_Avoid_: Note, journal entry

**Copied Mood Entry**:
A **Mood Entry** created from another **Mood Entry** as a starting point.
_Avoid_: Based-on entry, duplicated entry, cloned entry

**Streak**:
A count of consecutive local calendar days that each have at least one **Mood Entry**.
_Avoid_: Logging streak, mood streak, usage streak

**Pattern**:
A repeated relationship found across **Mood Entries**, such as a time, day, **Emotion**, or **Context Tag** associated with better or worse **Mood Ratings**.
_Avoid_: Insight, trend, correlation

**Insight**:
A user-facing interpretation of one or more **Patterns**.
_Avoid_: Pattern, statistic, chart

**Statistics**:
Computed summary values from **Mood Entries**, such as average **Mood Rating**, most common **Mood Rating**, and entry counts.
_Avoid_: Stats, metrics, analytics

**Data Export**:
A manual full export of the app database for the person to keep outside the app.
_Avoid_: Backup, therapy export

**Data Import**:
A restore of app data from a **Data Export** or **Backup**.
_Avoid_: Upload, sync, restore

**Backup**:
A full automatic export of the app database for recovery.
_Avoid_: Data export, therapy export

**Therapy Export**:
A special export of user-selected data fields prepared for use in therapy.
_Avoid_: Data export, backup

**App Lock**:
An optional access gate that protects local Moodinator data on the device.
_Avoid_: PIN, biometrics, authentication

**Reminder**:
A scheduled prompt for the person to create a **Mood Entry**.
_Avoid_: Mood reminder, notification, alert

**Entry Customization**:
The person's choice of which optional **Mood Entry** fields are available while logging.
_Avoid_: Quick entry preferences, field visibility, entry settings

**Quick Entry**:
A faster workflow for creating a **Mood Entry** with the person's configured optional fields.
_Avoid_: Quick mood, lightweight entry, simple entry

**Detailed Entry**:
A fuller workflow for creating or editing a **Mood Entry** with all supported fields.
_Avoid_: Full entry, comprehensive entry, advanced entry

## Relationships

- A **Mood Entry** has exactly one **Mood Rating**
- A **Mood Entry** is a **Mood Entry Snapshot**
- A **Mood Rating** is selected from exactly one **Mood Scale**
- Each value on the **Mood Scale** has exactly one **Mood Rating Label**
- In the current version, the **Mood Scale** is fixed at 0-10 where lower values are better and higher values are worse
- A **Mood Rating** is interpreted against the **Mood Scale** that was active when its **Mood Entry** was created, not against the current **Mood Scale** if the scale later changes
- A **Mood Entry** may include zero or more **Emotions**
- An **Emotion** has exactly one **Emotion Type**
- **Emotion Presets** provide the starting list of **Emotions** before the person customizes it
- The **Emotion List** is initialized from **Emotion Presets** and can later be customized by the person
- Edits to an **Emotion** in the **Emotion List** affect future selection by default and apply to existing **Mood Entries** only through a **Historical Update**
- Deleting an **Emotion** from the **Emotion List** prevents future selection but does not remove it from existing **Mood Entries**
- A **Mood Entry** may include zero or more **Context Tags**
- **Context Tag Presets** provide the starting list of **Context Tags** before the person customizes it
- The **Context Tag List** is initialized from **Context Tag Presets** and can later be customized by the person
- Edits to a **Context Tag** in the **Context Tag List** affect future selection by default and apply to existing **Mood Entries** only through a **Historical Update**
- Deleting a **Context Tag** from the **Context Tag List** prevents future selection but does not remove it from existing **Mood Entries**
- A **Mood Entry** may have one **Energy Rating**
- An **Energy Rating** is selected from exactly one **Energy Scale**
- The **Energy Scale** is permanently fixed at 0-10 where lower values mean more drained and higher values mean more wired
- A **Mood Entry** may have one **Mood Entry Note**
- A **Copied Mood Entry** references exactly one source **Mood Entry**
- A person may create multiple **Mood Entries** on the same local calendar day
- A day counts as logged when it has at least one **Mood Entry**
- A **Mood Entry** may be updated by explicitly editing that entry
- A **Mood Entry** may be deleted only by manually deleting that individual entry, except when **Data Import** replaces all app data or development-only reset/delete-all tools are used
- A **Streak** increases by one for each consecutive logged local calendar day
- A **Pattern** is derived from multiple **Mood Entries**
- An **Insight** presents one or more **Patterns** to the person
- **Statistics** are derived from multiple **Mood Entries**
- **Statistics**, **Patterns**, and **Insights** may compare **Mood Ratings** only when their **Mood Scales** are compatible or an explicit normalization rule exists
- **Data Export** and **Backup** contain the full app database needed for exact restoration
- **Data Export** is manually initiated by the person
- **Data Import** replaces the current app data with data from a **Data Export** or **Backup**
- **Data Import** requires explicit confirmation because it replaces current app data
- **Backup** is automatic
- **Therapy Export** contains only the fields selected by the person
- **Therapy Export** must include enough **Mood Scale** context for exported **Mood Ratings** to be interpreted
- **Therapy Export** may select and format **Mood Entry Snapshot** fields but must not mutate app data
- **Backup** remains local-device storage unless the person explicitly chooses a destination managed by the operating system or another provider
- **App Lock** protects access to locally stored Moodinator data
- A **Reminder** prompts the person to create a **Mood Entry**
- **Entry Customization** controls optional **Mood Entry** fields such as **Emotions**, **Context Tags**, **Energy Rating**, and **Mood Entry Note**
- Only saved fields belong to the **Mood Entry Snapshot**; **Entry Customization** controls logging workflow, not historical entry state
- **Quick Entry** creates a **Mood Entry**, not a separate kind of entry
- **Quick Entry** respects **Entry Customization**
- **Detailed Entry** creates or edits a **Mood Entry**, not a separate kind of entry
- **Detailed Entry** exposes all currently supported **Mood Entry** fields
- The currently supported **Mood Entry** fields are **Mood Rating**, **Emotions**, **Context Tags**, **Energy Rating**, and **Mood Entry Note**

## Example dialogue

> **Dev:** "Can a person create more than one **Mood Entry** in a day?"
> **Domain expert:** "Yes - each **Mood Entry** captures one moment, not the whole day."

## Flagged ambiguities

- "entry" appears in UI copy as shorthand for **Mood Entry**; resolved: use **Mood Entry** in domain language and allow "entry" only as a clear UI alias.
- The code currently stores **Emotion Type** in a field named `category`; resolved: domain language uses **Emotion Type** even though the implementation uses `category`.
- "context" appears as shorthand for **Context Tag**; resolved: use **Context Tag** because these are labels, not architectural contexts or full situational records.
- Photos, voice memos, and location currently exist in code, but are not accepted domain concepts until they work reliably; resolved: remove them from the product/code for now and reintroduce later through an explicit design pass.
- The **Mood Scale** range and direction are fixed in the current version, but should remain conceptually modifiable in the future; avoid baking 0-10 or "lower is better" into domain language as permanent invariants.
- The code currently removes deleted **Emotions** from existing **Mood Entries**, but the domain rule is that deletion only prevents future selection.
- "manual backup" wording conflicts with the boundary between **Data Export** and **Backup**; resolved: manual full-database export is **Data Export**, while **Backup** is automatic.
