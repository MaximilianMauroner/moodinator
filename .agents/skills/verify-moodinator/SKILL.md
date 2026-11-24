---
name: verify-moodinator
description: Verify Moodinator native recording, insights and recovery. Use when checking changed journeys with its isolated QA app.
---

# Verify Moodinator

Draft until an owned matching QA build and device/profile are ready.
Read AGENTS.md, README.md, [Native QA](../../../docs/native-qa.md) and
[the feature index](features/README.md). The existing native QA document and runners own
setup, selectors, fixture identity and cleanup. Do not open a browser.
Check active work, host resources, clean source SHA and device ownership first.
Select journeys affected by work in the requested audit window, then read every
selected feature guide, including its expected results, procedure and cleanup,
before setup or execution.

Install with `pnpm install --frozen-lockfile`. Run `pnpm run qa:prepare` only from
clean committed source and use its printed disposable workspace and SHA.
Follow Native QA's prebuild, sealing and QA-package checks exactly. Never point
smoke/stress/matrix/timezone flows at a personal app installation.
Do not use `build`, `build:preview`, `build:production` or release commands:
they run the internal release uploader, not an isolated verification build.

Run mapped journeys serially using the existing QA commands and manual matrix.
Require a ready installed QA app before actions. Check readiness and reset only
owned fixtures before a targeted retry. Record source SHA, sealed build identity,
emulator profile, fabricated fixture, observed outcome and capture. Haptics and
physical notification delivery need bounded human/device evidence.
Supporting checks: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:run`,
`pnpm run test:qa`, `pnpm run doctor`, `pnpm run verify:android-release-config`,
`pnpm run verify:color-tokens`. Report each separately from native product proof.

Follow runners' restoration paths for timezone, text scale, theme and motion.
Stop only owned emulator/build processes, uninstall owned QA app, and remove only
its prepared workspace/AVD after evidence is retained. Preserve redacted captures
outside disposable state. Human approval is required by AGENTS.md before merge.

## Guided recording

With quick energy on and detailed labels off, Today shows the guided check-in.
Choose a named mood, select up to three feelings, and continue to energy and context in the
same lower tray. Verify that energy is directly selectable inline without opening a note sheet,
and that no context is selected by default. Use the configured emotion and context options,
including custom options. Feelings, energy, context, and notes remain optional.

Check Change mood, Back, Clear, All feelings, inline energy (0–10 and Clear), separate Note
sheet, Keep, and Undo. Keep a severe rating and confirm that support appears only after the save;
Not now then shows Undo. Switch tabs and return before Keep to check draft
retention. Check the Android Back action and screen-reader labels, light and dark
themes, and large system text. Capture the mood, feelings, context, optional
details, and kept states. Enable Notes in Quick Entry settings for note coverage.
Restore settings after the journey.

Check detailed-entry journeys in tile modes, with energy off or detailed labels on.
