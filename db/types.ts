/**
 * Represents a single mood entry in the database.
 */
export type MoodEntry = {
    id: number;
    mood: number; // 0-10
    note: string | null;
    timestamp: string; // ISO format
};

/**
 * The minimum allowed mood value.
 */
export const MOOD_MIN = 0;

/**
 * The maximum allowed mood value.
 */
export const MOOD_MAX = 10;
