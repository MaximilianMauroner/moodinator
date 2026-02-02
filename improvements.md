# Improvements Tracking

Planned improvements for Moodinator. See CLAUDE.md for instructions on maintaining this file.

---

## Low Priority - Features

### Analytics & Insights
- Mood correlations with emotions/context/time-of-day
- Weekly trend notifications
- "Good day" pattern detection
- Streak milestones and celebrations

### Entry Management
- Batch edit/delete capability
- Entry templates for common moods
- Duplicate detection
- Undo/redo for recent actions

### Notifications
- Customizable daily check-in reminders
- Crisis detection (mood < 2 for extended time)
- Weekly summary digests

### Export Options
- CSV/Excel export
- PDF reports with charts
- Encrypted export with password protection
- HealthKit/Google Fit integration

### Personalization
- Custom mood scale (emoji, 0-100, etc.)
- Configurable number of mood levels (e.g., 5 buttons instead of 10)
- Customizable mood labels (rename "Elated", "Crisis", etc. to user-preferred terms)
- Customizable mood level colors
- Theme color customization
- Font size adjustment
- Language/localization

### Privacy & Data
- App lock with biometric authentication (FaceID/TouchID/fingerprint) or PIN/password
- Local encryption option
- Cloud backup (iCloud/Google Drive)
- Background auto-backup via expo-task-manager
- Cross-device sync (optional, user-controlled)

### Widgets
- Calendar widget for quick mood entry
- Home screen widget showing recent mood

### User Experience
- Onboarding tutorial for new users
- Improved haptic feedback patterns (varied intensity, custom patterns)

---

## Release Preparation

### App Store Submission
- App icon design
- Splash screen design
- App Store screenshots and preview video
- App Store listing copy (description, keywords)
- Privacy policy URL configuration
- App review preparation

---

## Testing Coverage

### Missing Tests
- Component tests (MoodEntryModal, charts, modals)
- Service tests (analyticsService calculations, backup/restore flow)
- Hook tests (useMoodData, useEntrySettings)
- Integration tests (full mood entry flow, import/export roundtrip)

### Test Infrastructure
- Setup `@testing-library/react-native`
- Create test utilities and mocks
- Add coverage reporting
