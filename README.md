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
- **Local-first storage**—no accounts, developer cloud sync, analytics, or ads
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

- **React Native** with **Expo** (SDK 53)
- **TypeScript** for type safety
- **SQLite** via expo-sqlite for local persistence
- **NativeWind** (TailwindCSS) for styling
- **Expo Router** for file-based navigation
- **Zustand** for state management
- **Reanimated** for smooth animations

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app (for device testing) or iOS Simulator / Android Emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/MaximilianMauroner/moodinator.git
cd moodinator

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

```bash
npm run ios      # Run on iOS simulator
npm run android  # Run on Android emulator
```

Or scan the QR code with Expo Go on your physical device.

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
npm test         # Run tests in watch mode
npm run lint     # Run ESLint
npx tsc --noEmit # Type check
```

## Known Issues

### NativeWind shadows + Expo Router

On Expo SDK 53 with `expo-router` 5, toggling NativeWind `shadow-*` utilities during state updates can trigger a React Navigation context warning. Workaround: use inline `style` with iOS shadow props + Android `elevation` instead of `shadow-*` classes in dynamic components.

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
