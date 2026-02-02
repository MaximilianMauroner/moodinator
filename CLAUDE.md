# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm start           # Start Expo dev server
npm run ios         # Run on iOS simulator
npm run android     # Run on Android emulator

# Testing
npm test            # Run all tests in watch mode
npx jest --testPathPattern="db" --no-coverage  # Run only DB tests
npx jest path/to/test.ts --no-coverage         # Run single test file

# Linting & Type Checking
npm run lint        # Run ESLint
npx tsc --noEmit    # Type check without emitting
```

## Architecture Overview

### Data Layer (`/db`)
- **SQLite** via `expo-sqlite` for local persistence
- `db.ts` - Database initialization, migrations, and exports all repository functions
- `moods/repository.ts` - CRUD operations for mood entries
- `moods/schema.ts` - Table definitions and migrations
- `moods/serialization.ts` - JSON serialization for arrays (emotions, photos, etc.)
- `backup.ts` - Import/export and automatic backup system

### State Management
- **Zustand** stores in `/src/shared/state/` for global state
- Custom hooks in `/src/hooks/` for component-level state
- `moodService.ts` abstracts database operations with clean async API

### UI Components
- **Expo Router** for file-based navigation (`/src/app/`)
- **NativeWind** (TailwindCSS) for styling with inline style fallbacks for shadows
- Components in `/src/components/` with feature-specific subfolders

### Key Files
- `/src/constants/colors.ts` - Centralized theme system with `useThemeColors()` hook
- `/src/constants/moodScale.ts` - Mood level definitions (0-10 scale)
- `/src/lib/entrySettings.ts` - User preferences storage (emotions, contexts, quick entry)

## Design System

**Soft Organic Palette** - warm, natural, cozy tones:
- Primary: Sage green (`#5B8A5B`)
- Backgrounds: Warm creams (light) / Deep browns (dark)
- Emotion categories: `positive` (green), `negative` (coral), `neutral` (purple/dusk)
- Use `useThemeColors()` hook for all color access
- Use `getCategoryColors(category, isSelected)` for emotion/tag chips

**Mood Scale**: 0 (Elated) to 10 (Emergency) - lower is better. Each level has distinct colors defined in `moodScale.ts`.

## Important Patterns

### Database Operations
Always use service layer (`moodService`, `analyticsService`) instead of direct repository calls in components.

### Shadows on Expo
Avoid NativeWind `shadow-*` classes in dynamic components - use inline `style` with iOS shadow props + Android `elevation` to prevent React Navigation warnings.

### Entry Modals
- Quick Entry (tap mood button): Basic fields configured via `quickEntryFieldConfig`
- Detailed Entry (long press): All fields including photos, voice, location via `detailedFieldConfig`

## Privacy & Legal Documents

**Data Storage Policy**: All user data is stored locally on-device only. No data is transmitted to external servers, no accounts are required, and no analytics/tracking is used.

**Legal Files**:
- `PRIVACY_POLICY.md` - Root markdown file
- `TERMS_OF_SERVICE.md` - Root markdown file
- `src/app/settings/privacy-policy.tsx` - In-app screen
- `src/app/settings/terms-of-service.tsx` - In-app screen

**When modifying data collection or storage:**
1. Update both the markdown files AND the in-app screens
2. Update the "Last Updated" date in all four files
3. Ensure the privacy policy accurately reflects what data is collected and how it's stored
4. Maintain consistency: the app must never store data externally without updating these documents

## Improvements Tracking

**CRITICAL**: All improvement recommendations are tracked in `improvements.md`.

**When implementing ANY suggestion from improvements.md:**
1. Complete the implementation fully
2. **REMOVE the item from `improvements.md`** - this is mandatory
3. Commit both your code changes AND the updated improvements.md

**When committing and pushing code:**
1. Review the changed code for potential improvements
2. Add any new suggestions to `improvements.md` (code quality, performance, features, etc.)
3. Include the updated improvements.md in your commit

The improvements.md file must only contain unimplemented items. Stale/completed items make the list unreliable for future work.
