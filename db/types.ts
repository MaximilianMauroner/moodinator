import type { Emotion } from "../domain/entrySettings";

export type { Emotion } from "../domain/entrySettings";

export type CurrentMoodScaleSnapshot = {
    version: 1;
    min: 0;
    max: 10;
    lowerIsBetter: true;
};

export type LegacyHigherIsBetterMoodScaleSnapshot = {
    version: 2;
    min: 0;
    max: 10;
    lowerIsBetter: false;
};

export type MoodScaleSnapshot =
    | CurrentMoodScaleSnapshot
    | LegacyHigherIsBetterMoodScaleSnapshot;

/**
 * Represents a single mood entry in the database.
 */
export type MoodEntry = {
    id: number;
    mood: number; // 0-10
    note: string | null;
    timestamp: number; // milliseconds since epoch
    emotions: Emotion[];
    contextTags: string[];
    energy: number | null;
    moodScale: MoodScaleSnapshot;
    basedOnEntryId: number | null; // Reference to copied entry
};

/**
 * The minimum allowed mood value.
 */
export const MOOD_MIN = 0;

/**
 * The maximum allowed mood value.
 */
export const MOOD_MAX = 10;

export type MoodEntryInput = {
    mood: number;
    note?: string | null;
    timestamp?: number;
    emotions?: Emotion[];
    contextTags?: string[];
    energy?: number | null;
    moodScale?: MoodScaleSnapshot;
    basedOnEntryId?: number | null;
};
