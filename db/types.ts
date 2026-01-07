/**
 * Represents an emotion with its category.
 */
export type Emotion = {
    name: string;
    category: 'positive' | 'negative' | 'neutral';
};

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
};
