# Improvements Tracking

**IMPORTANT**: This file tracks planned improvements for Moodinator. When you implement an item, **remove it from this file**. Keep this list current - only unimplemented improvements should remain here.

---

## High Priority

### State Management Consolidation
- **Issue**: Mix of custom hooks (`useMoodData`) and Zustand stores (`moodsStore.ts`)
- **Fix**: Standardize on Zustand exclusively; migrate `useMoodData` to use `useMoodsStore`

### Database Schema Normalization
- **Issue**: Emotions stored both as JSON strings AND in normalized tables (duplicate data)
- **Files**: `/db/moods/schema.ts`, `/db/moods/serialization.ts`
- **Fix**: Remove JSON emotion column, use only junction tables (`mood_emotions`)

### Data Validation Layer
- **Issue**: Imported data not validated; silent failures on malformed JSON
- **Fix**: Create `/db/validation.ts` with JSON schema validation, range checks (mood 0-10, energy 0-10), timestamp sanity checks

### Performance - Mood History Pagination
- **Issue**: `MoodHistoryList` renders all entries; will lag with 1000+ moods
- **File**: `/src/components/home/MoodHistoryList.tsx`
- **Fix**: Add `maxToRenderPerBatch={30}`, `windowSize`, and implement query-level pagination in repository

### Error Handling
- **Issue**: Async operations fail silently; error boundaries return blank screens
- **Files**: `/db/backup.ts`, `/src/components/ErrorBoundary.tsx`
- **Fix**: Implement Result type pattern `{ success: true; data: T } | { success: false; error: string }`, always show user-friendly recovery UI

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
