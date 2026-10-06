---
name: verify-moodinator
description: Verify Moodinator native recording, insights and recovery. Use when checking changed journeys with its isolated QA app.
---

# Verify Moodinator

Draft until an owned matching QA build and device/profile are ready.
Read AGENTS.md, README.md, [Native QA](../../../docs/native-qa.md) and
[features.md](features.md). The existing native QA document and runners own
setup, selectors, fixture identity and cleanup. Do not open a browser.
Check active work, host resources, clean source SHA and device ownership first.
Select journeys affected by work in the requested audit window.

Install with `bun install --frozen-lockfile`. Run `bun run qa:prepare` only from
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
Supporting checks: `bun run lint`, `bun run typecheck`, `bun run test:run`,
`bun run test:qa`, `bun run doctor`, `bun run verify:android-release-config`,
`bun run verify:color-tokens`. Report each separately from native product proof.

Follow runners' restoration paths for timezone, text scale, theme and motion.
Stop only owned emulator/build processes, uninstall owned QA app, and remove only
its prepared workspace/AVD after evidence is retained. Preserve redacted captures
outside disposable state. Human approval is required by AGENTS.md before merge.
