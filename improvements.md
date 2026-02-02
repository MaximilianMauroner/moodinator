# Improvements Tracking

Planned improvements for Moodinator. See CLAUDE.md for instructions on maintaining this file.

---

## High Priority

### Database Schema Normalization
- **Issue**: Emotions stored both as JSON strings AND in normalized tables (duplicate data)
- **Files**: `/db/moods/schema.ts`, `/db/moods/serialization.ts`
- **Fix**: Remove JSON emotion column, use only junction tables (`mood_emotions`)
- **Note**: Requires careful migration to avoid data loss; consider phased approach

---

## Medium Priority

### Chart Memoization
- **Issue**: `processWeeklyMoodData(moods, 52)` recalculates every render
- **File**: `/src/components/charts/OverviewTab.tsx`
- **Fix**: Wrap in `useMemo` with proper dependencies

### Settings Service Layer
- **Issue**: Settings screen calls AsyncStorage directly; no abstraction
- **File**: `/src/features/settings/screens/SettingsScreen.tsx`
- **Fix**: Create `/src/services/settingsService.ts` similar to `moodService` pattern

### UI Component Standardization
- **Issue**: No reusable loading/empty/error state components
- **Fix**: Create `/src/components/ui/LoadingSpinner.tsx`, `EmptyState.tsx`, `ErrorState.tsx`

### Color Token System
- **Issue**: Mix of Tailwind classes, inline styles, and hardcoded hex colors
- **Fix**: Consolidate into unified token system in `/src/constants/colors.ts`

### Database Indexes
- **Issue**: Missing indexes for common queries
- **File**: `/db/moods/schema.ts`
- **Fix**: Add indexes on `emotions.name`, `emotion_id` in `mood_emotions`

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

---

## Accessibility

### Gaps
- Charts lack proper ARIA labels and `accessibilityRole`
- Color-only information in charts (needs patterns for colorblind users)
- Inconsistent haptic feedback usage across components
- No global haptic feedback toggle setting
