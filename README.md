# Moodinator

A privacy-focused mood tracking app built with React Native. Track your emotional wellbeing, identify patterns, and gain insights without a Moodinator account or developer-operated data server.

## Features

### Mood Tracking
- **11-level mood scale** from Elated (0) to Emergency (10)
- **Quick entry** with tap for fast logging
- **Detailed entry** with long-press for comprehensive records
- Attach **emotions**, **context tags**, **energy**, and **notes**
- Add personal notes to each entry

### Insights & Analytics
- **Interactive charts** showing mood trends over time
- **Weekly and monthly statistics**
- Pattern detection across emotions and contexts
- Streak tracking and milestones

### Privacy First
- **Local-first storage**. No accounts, developer cloud sync, analytics, or ads
- Mood data stays in the app unless you choose to export, share, copy, or back it up
- Plaintext JSON exports and backups can be saved to user-selected destinations, including cloud-backed providers
- Core mood tracking works offline; crisis-support links and user-selected sharing destinations may require connectivity

### User Experience
- **Dark and light mode** with warm, organic color palette
- Haptic feedback for tactile interactions
- Swipe actions for quick edits and deletes
- Customizable emotion and context tags
- Configurable quick entry fields

## Tech Stack

- **React Native** with **Expo** (SDK 55)
- **TypeScript** for type safety
- **SQLite** via expo-sqlite for local persistence
- **NativeWind** (TailwindCSS) for styling
- **Expo Router** for file-based navigation
- **Zustand** for state management
- **Reanimated** for smooth animations

## Getting Started

### Prerequisites

- Node.js 24 LTS, version 24.13.1 or newer within major 24 (`.node-version`)
- Bun 1.3.14 (`packageManager` in `package.json`)
- Android Studio and an emulator, or Xcode on macOS for iOS

The test suite uses Node's built-in SQLite. Expo Go cannot verify custom native
configuration such as SQLCipher; use a native build for that coverage.

### Installation

```bash
git clone https://github.com/MaximilianMauroner/moodinator.git
cd moodinator
bun install --frozen-lockfile
bun start
```

### Running the app

```bash
bun run android
bun run ios
```

These commands build the normal app identifier. For disposable test data and
automation, use the separate QA app described in [Native QA](docs/native-qa.md).
Do not open a browser for normal app verification.

## Project Structure

```
/src
  /app              # Expo Router screens and navigation
  /components       # Reusable UI components
  /features         # Feature-specific components and logic
  /hooks            # Custom React hooks
  /shared/state     # Zustand stores
  /constants        # Theme colors, mood scale definitions
  /lib              # Utilities and helpers
/db                 # SQLite database, repositories, migrations
```

## Development

```bash
bun run verify   # Lint, typecheck, tests, Expo Doctor, Android release config
bun run test     # Watch tests while editing
bun run test:run # Run tests once
```

The suite includes real in-memory SQLite queries, migrations and rollback,
store/date regressions, and rendered emotion/energy interactions. Native hosts
and haptic APIs are mocked in component tests. Physical feedback, native layout,
SQLCipher and the Expo bridge require a device build.

Expo Doctor needs network access to check SDK compatibility. It is installed
locally so the command does not download a different checker on each run.

### Isolated native verification

```bash
bun run qa:prepare
# In the printed temporary workspace:
bun install --frozen-lockfile
MOODINATOR_VARIANT=qa bunx expo run:android --variant release --device
bun run qa:smoke -- emulator-5554
```

`qa:prepare` copies current tracked files and relevant new source/test files,
including uncommitted edits, into a temporary directory. It excludes native
build folders, dependencies, credentials and personal scratch files. It does
not install or launch anything. Use one disposable emulator per concurrent run.
The release QA build embeds its bundle and does not need a shared Metro port.
After collecting evidence, remove that temporary workspace and disposable AVD.

The QA app uses `com.lab4code.moodinator.qa` and separate local storage. The smoke
runner accepts an explicit emulator serial and checks that package before
running a flow which clears QA data. See [Native QA](docs/native-qa.md) for
coverage, fixture generation, manual checks and performance captures.

### Versions and builds

`bun run version:bump` explicitly increments the minor version in `app.json`
and `package.json`. Build commands do not invoke it automatically. Run it only
when preparing an intended version change. Native generation uses
`bunx expo prebuild` in an isolated workspace.

## Known Issues

### NativeWind shadows + Expo Router

In older Expo builds, toggling NativeWind `shadow-*` utilities during state updates can trigger a React Navigation context warning. Workaround: use inline `style` with iOS shadow props + Android `elevation` instead of `shadow-*` classes in dynamic components.

## Roadmap

Use the task tracker for planned features, implementation slices, dependencies, and task
status. See [AGENTS.md](./AGENTS.md) for the parent-task, vertical-slice,
review, and merge workflow.

## Privacy & Legal

- [Privacy Policy](./PRIVACY_POLICY.md)
- [Terms of Service](./TERMS_OF_SERVICE.md)

**Your working data is stored locally.** Moodinator has no developer-operated account or data server. Data can leave the app when you deliberately export, share, copy, or back it up to a destination you select. See the Privacy Policy for Android database-encryption, notification, deletion, and platform-backup details.

## Contributing

Contributions are welcome. Use the task tracker for planned work and implementation
handoff; pull requests should reference the relevant task when one exists.

## Contact

For support or feedback: support.moodinator@lab4code.com

## License

[MIT](./LICENSE)
