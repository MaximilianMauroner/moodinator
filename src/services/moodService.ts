/**
 * Mood Service
 * Abstracts database operations for mood entries.
 * Provides a clean API for CRUD operations and queries.
 */

import type { MoodEntry, MoodEntryInput, Emotion } from "@db/types";
import {
  insertMood,
  insertMoodEntry,
  updateMoodEntry,
  updateMoodNote,
  updateMoodTimestamp,
  deleteMood,
  getAllMoods,
  getMoodCount,
  getMoodsWithinRange,
  getMoodsPaginated,
  hasMoodBeenLoggedToday,
  updateEmotionCategoryInMoods,
  removeEmotionFromMoods,
  getEmotionNamesFromMoods,
  type PaginationOptions,
  type PaginatedResult,
} from "@db/db";
import type { MoodDateRange } from "@db/moods/range";

export type { PaginationOptions, PaginatedResult };

export interface MoodServiceInterface {
  // CRUD operations
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (id: number, updates: Partial<MoodEntryInput>) => Promise<MoodEntry | undefined>;
  delete: (id: number) => Promise<void>;

  // Queries
  getAll: () => Promise<MoodEntry[]>;
  getPaginated: (options: PaginationOptions) => Promise<PaginatedResult<MoodEntry>>;
  getInRange: (range?: MoodDateRange) => Promise<MoodEntry[]>;
  getToday: () => Promise<MoodEntry | null>;
  getYesterday: () => Promise<MoodEntry | null>;
  getLastEntry: () => Promise<MoodEntry | null>;
  getCount: () => Promise<number>;
  hasLoggedToday: () => Promise<boolean>;

  // Note & timestamp updates
  updateNote: (id: number, note: string) => Promise<MoodEntry | undefined>;
  updateTimestamp: (id: number, timestamp: number) => Promise<MoodEntry | undefined>;

  // Legacy insert function
  insertLegacy: (
    mood: number,
    note?: string,
    metadata?: Omit<MoodEntryInput, "mood" | "note">
  ) => Promise<MoodEntry>;

  // Emotion management in moods
  updateEmotionCategory: (
    emotionName: string,
    category: Emotion["category"]
  ) => Promise<{ updated: number }>;
  removeEmotion: (emotionName: string) => Promise<{ updated: number }>;
  getEmotionNames: () => Promise<string[]>;
}

/**
 * Helper to get start of today in ms
 */
function getStartOfToday(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

/**
 * Helper to get end of today in ms
 */
function getEndOfToday(): number {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today.getTime();
}

/**
 * Helper to get start of yesterday in ms
 */
function getStartOfYesterday(): number {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday.getTime();
}

/**
 * Helper to get end of yesterday in ms
 */
function getEndOfYesterday(): number {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);
  return yesterday.getTime();
}

export const moodService: MoodServiceInterface = {
  /**
   * Create a new mood entry
   */
  async create(entry: MoodEntryInput): Promise<MoodEntry> {
    return insertMoodEntry(entry);
  },

  /**
   * Update an existing mood entry
   */
  async update(
    id: number,
    updates: Partial<MoodEntryInput>
  ): Promise<MoodEntry | undefined> {
    return updateMoodEntry(id, updates);
  },

  /**
   * Delete a mood entry
   */
  async delete(id: number): Promise<void> {
    await deleteMood(id);
  },

  /**
   * Get all mood entries, sorted by timestamp descending
   */
  async getAll(): Promise<MoodEntry[]> {
    return getAllMoods();
  },

  /**
   * Get mood entries with pagination
   */
  async getPaginated(options: PaginationOptions): Promise<PaginatedResult<MoodEntry>> {
    return getMoodsPaginated(options);
  },

  /**
   * Get mood entries within a date range
   */
  async getInRange(range?: MoodDateRange): Promise<MoodEntry[]> {
    return getMoodsWithinRange(range);
  },

  /**
   * Get the most recent mood entry from today
   */
  async getToday(): Promise<MoodEntry | null> {
    const moods = await getMoodsWithinRange({
      startDate: getStartOfToday(),
      endDate: getEndOfToday(),
    });
    return moods.length > 0 ? moods[0] : null;
  },

  /**
   * Get the most recent mood entry from yesterday (for "same as yesterday" feature)
   */
  async getYesterday(): Promise<MoodEntry | null> {
    const moods = await getMoodsWithinRange({
      startDate: getStartOfYesterday(),
      endDate: getEndOfYesterday(),
    });
    return moods.length > 0 ? moods[0] : null;
  },

  /**
   * Get the most recent mood entry (for "same as last entry" feature)
   */
  async getLastEntry(): Promise<MoodEntry | null> {
    const moods = await getAllMoods();
    return moods.length > 0 ? moods[0] : null;
  },

  /**
   * Get total count of mood entries
   */
  async getCount(): Promise<number> {
    return getMoodCount();
  },

  /**
   * Check if a mood has been logged today
   */
  async hasLoggedToday(): Promise<boolean> {
    return hasMoodBeenLoggedToday();
  },

  /**
   * Update just the note of a mood entry
   */
  async updateNote(id: number, note: string): Promise<MoodEntry | undefined> {
    return updateMoodNote(id, note);
  },

  /**
   * Update just the timestamp of a mood entry
   */
  async updateTimestamp(
    id: number,
    timestamp: number
  ): Promise<MoodEntry | undefined> {
    return updateMoodTimestamp(id, timestamp);
  },

  /**
   * Legacy insert function (for backwards compatibility)
   */
  async insertLegacy(
    mood: number,
    note?: string,
    metadata?: Omit<MoodEntryInput, "mood" | "note">
  ): Promise<MoodEntry> {
    return insertMood(mood, note, metadata);
  },

  /**
   * Update emotion category across all moods
   */
  async updateEmotionCategory(
    emotionName: string,
    category: Emotion["category"]
  ): Promise<{ updated: number }> {
    return updateEmotionCategoryInMoods(emotionName, category);
  },

  /**
   * Remove an emotion from all moods
   */
  async removeEmotion(emotionName: string): Promise<{ updated: number }> {
    return removeEmotionFromMoods(emotionName);
  },

  /**
   * Get all unique emotion names used in moods
   */
  async getEmotionNames(): Promise<string[]> {
    return getEmotionNamesFromMoods();
  },
};

export default moodService;
