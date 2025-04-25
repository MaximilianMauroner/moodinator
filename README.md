# Moodinator

A React Native app for tracking your daily mood and thoughts.

## Features

- Track your mood on a scale from 0-10
- Add notes to your mood entries
- View your mood history
- Swipe actions for quick interactions
- Dark mode support
- Charts and statistics (coming soon)

## Tech Stack

- React Native with Expo
- TypeScript
- SQLite for local storage
- TailwindCSS (NativeWind)
- React Navigation
- Reanimated for animations

## Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Use Expo Go app to run on your device or use a simulator

## Project Structure

- `/app` - Main app screens and navigation
- `/components` - Reusable React components
- `/db` - Database operations and types
- `/hooks` - Custom React hooks
- `/types` - TypeScript type definitions
- `/utils` - Utility functions

## TODO List

- [ ] Implement chart visualization for mood trends
- [ ] Add a calendar view for mood entries
- [ ] Add a widget for quick mood entry
- [ ] Add weekly/monthly mood averages
- [ ] Add mood labels/categories
- [ ] Add data export functionality
- [ ] Implement mood reminders/notifications
- [ ] Add data backup/sync feature
- [ ] Implement settings screen
- [ ] Add mood insights and statistics
- [ ] Support sharing "critical" mood entries - e.g. > 8 send email to X
- [ ] Add password protection(and fingerprint/face ID)
- [ ] Create app icon and splash screen
- [ ] Make buttons have haptic feedback
- [ ] Add onboarding tutorial
- [ ] Prepare for app store submission

## License

MIT
