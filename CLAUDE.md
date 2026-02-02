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

## Improvements Tracking

**IMPORTANT**: All improvement recommendations are tracked in `improvements.md`. When implementing a suggestion:
1. Complete the implementation
2. Remove the item from `improvements.md`
3. Keep the file current - it should only contain unimplemented improvements
