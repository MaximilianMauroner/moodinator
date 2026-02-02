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
- HealthKit/Google Fit integration

### Personalization
- Custom mood scale (emoji, 0-100, etc.)
- Theme color customization
- Font size adjustment
- Language/localization

### Privacy & Data
- Local encryption option
- Cloud backup (iCloud/Google Drive)
- Background auto-backup via expo-task-manager

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
