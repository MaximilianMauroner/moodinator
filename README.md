# Moodinator

A privacy-focused mood tracking app built with React Native. Track your emotional wellbeing, identify patterns, and gain insights—all while keeping your data entirely on your device.

## Features

### Mood Tracking
- **10-point mood scale** from Elated (0) to Crisis (10)
- **Quick entry** with tap for fast logging
- **Detailed entry** with long-press for comprehensive records
- Attach **emotions**, **context tags**, **photos**, **voice notes**, and **location**
- Add personal notes to each entry

### Insights & Analytics
- **Interactive charts** showing mood trends over time
- **Weekly and monthly statistics**
- Pattern detection across emotions and contexts
- Streak tracking and milestones

### Privacy First
- **100% local storage**—no accounts, no cloud, no tracking
- All data stays on your device
- Export your data anytime
- No internet connection required

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

See [improvements.md](./improvements.md) for planned features and enhancements.

## Privacy & Legal

- [Privacy Policy](./PRIVACY_POLICY.md)
- [Terms of Service](./TERMS_OF_SERVICE.md)

**Your data stays on your device.** Moodinator does not collect, transmit, or store any personal information on external servers.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Contact

For support or feedback: support.moodinator@lab4code.com

## License

MIT
