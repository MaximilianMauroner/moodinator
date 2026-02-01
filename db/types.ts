/**
 * Represents an emotion with its category.
 */
export type Emotion = {
    name: string;
    category: 'positive' | 'negative' | 'neutral';
};

/**
 * Represents a location with coordinates and optional name.
 */
export type Location = {
    latitude: number;
    longitude: number;
    name?: string;
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
    photos: string[];              // Array of file URIs
    location: Location | null;     // Location coordinates
    voiceMemos: string[];          // Array of audio file URIs
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
    photos?: string[];
    location?: Location | null;
    voiceMemos?: string[];
    basedOnEntryId?: number | null;
};
