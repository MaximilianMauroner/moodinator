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

## One pad recording

With quick energy on and detailed labels off, Today uses the One pad dock.
Start with no thumb and a disabled Keep button. Touch or drag across the pad.
Left is mood 0 and right is mood 10. Top is energy 10 and bottom is energy 0.
Use the mood-pad test ID and scripts/native-ui.js cell-coordinate helper in
native runners. Use the device tool session for manual input and captures.

Test Clear, note folding with the keyboard, More and Done without saving,
three-emotion limits, context selection, Keep and Undo. Check a severe draft
saves before support, then Not now shows Undo. Switch tabs and return before
Keep to check draft retention. Test screen-reader mood and energy adjustments,
light and dark themes, and large system text. Capture the empty pad, selected
pad, note, More and kept entry. Enable Notes in Quick Entry settings for note
coverage. Restore settings after the journey.

The pad has no long press to detailed entry. Check detailed-entry journeys in
tile modes, with energy off or detailed labels on.
