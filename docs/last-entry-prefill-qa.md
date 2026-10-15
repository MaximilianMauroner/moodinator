# Last-entry copy and Save acceptance

Use this procedure with [Native QA](native-qa.md). It covers the Add detail
sheet's **Copy last entry** tap and long-press preview. Software tests cannot
prove Android touch geometry or persisted native values.

Use a disposable Android emulator and the separate
`com.lab4code.moodinator.qa` package. Never use personal data. Prepare from clean
committed source with `bun run qa:prepare`, install frozen dependencies, generate
and seal Android through Native QA, and build a nondebuggable QA release. Record
the source revision, sealed inputs, installed APK checksum, API level, screen and
navigation mode. Check the actual merged QA release manifest. Confirm the app's
QA source badge and installed APK bytes before testing.

## Fixtures and byte checks

Use fabricated records with different IDs, timestamps and values. Include two
source records with tied timestamps and one newest record to edit. Set one
source's mood and energy to zero. Give it emotions, context tags and a note with
leading/trailing spaces and a newline. Keep those fields hidden in the quick
entry preset for the hidden-field case.

Fixture writes and database reads are allowed only on the owned QA installation
while the app is force-stopped. Prefer the existing native QA fixture and SQLite
readback helpers. Retain baseline rows and compare all supported fields after
Save: mood, energy, emotions, context tags, exact note bytes, mood scale, recorded
offset and source lineage. Also check destination ID and timestamp. Do not use a
screenshot, toast or visible field alone as saved-value proof. Preserve zero,
NULL, empty and whitespace distinctions.

Include supported version-2 records whose 0–10 scale is higher-is-better,
alongside current version-1 records whose scale is lower-is-better. A legacy
10 means Elated and must appear as current form value 0; legacy 0 means
Emergency and must appear as current form value 10. Preview must retain the
source's interpreted label. Save must encode the form value in the destination's
existing scale, without changing its scale snapshot or any source record.

## Public journeys

1. With no other record, quick-save an entry, add a note, and tap Copy last entry.
   The draft stays intact. Hide the keyboard, tap Done, force-stop and relaunch.
   Cold database readback must contain the exact note and one destination row.
2. With tied sources and a current entry, tap Copy last entry. It must exclude
   the current row and choose deterministically by timestamp descending, then
   ID descending. Done must save hidden fields, zeros and exact note whitespace.
3. Change a draft, long-press Copy last entry, inspect the preview and cancel.
   The draft stays intact. Repeat and use the preview. Its selected source and
   saved values must match the tap path.
4. Edit the newest entry, then an older entry. Each copy must exclude the entry
   being edited. Save must retain the destination's identity and recorded time.
5. Copy, then edit a visible field. Save must retain the later edit and all other
   copied values. Close and reopen an entry with persisted copy lineage; a new
   session must allow normal quick-entry field clearing. Old lineage must not
   keep a previous session's copy mode active.
6. Quick-save a new destination and keep Add detail open. Copy from a prior
   entry, then use the header Undo before Done. Wait for History to confirm the
   committed deletion. Cold readback must remove that destination only and
   leave all source rows unchanged.
7. Tap-copy a legacy source into a newly kept current-scale destination. Check
   the interpreted form label, then Save and cold-read the current-scale value,
   exact hidden fields, zeros, note whitespace and lineage. Preview a current
   source while editing a legacy destination, then use it and Save. The
   destination must retain its ID, time and legacy snapshot while storing the
   equivalent legacy value. Also copy between two legacy entries, including
   the opposite endpoint. Verify all other rows stay unchanged in each case.
8. Open a legacy entry without copying. Its initial form mood must be current
   scale. Edit only its note and Save; cold readback must retain its original
   raw mood and scale. Use rendered regressions to cover a later mood change
   and rejected Save/retry in a legacy destination, without double conversion.

On Android three-button navigation, record Done's bounds and a screenshot with
the keyboard hidden. Its tap target must be above the system navigation bar,
and tapping it must save and close the sheet. Check notes with the keyboard
shown and hidden. Repeat with gesture navigation when available. An untested
navigation mode stays NOT_RUN. iOS layout and physical haptics need separate
coverage; Android emulator evidence does not prove them.

## Failure, retry and cleanup

Stop on the first unexpected failure. Retain the source identity, hierarchy,
action, screenshot and cold database oracle before diagnosis. A failed tap or
incomplete Save does not establish that Copy erased data.

Use the existing rendered entry feedback regressions for rejected Save, retry
and later-edit preservation. Induce a native write failure only through an
approved existing fixture mechanism. Without one, report native retry as
NOT_INDUCED and keep source regression evidence separate. Do not add a release
fault-injection or authentication bypass.

Stop only owned PID/start identities, including late shutdown children in proven
owned sessions. Verify the private ADB/emulator ports are closed before removing
the owned AVD. Retain evidence outside disposable state. Report product journeys,
software checks, native compilation, CI and cleanup separately as PASS, FAIL,
BLOCKED or NOT_RUN, including any observation gaps.
