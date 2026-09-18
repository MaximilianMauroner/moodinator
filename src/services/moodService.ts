/**
 * Mood Service
 * Abstracts database operations for mood entries.
 * Provides a clean API for CRUD operations and queries.
 */

import type { MoodEntry, MoodEntryInput, Emotion } from "@db/types";
import {
  insertMoodEntry,
  updateMoodEntry,
  updateMoodNote,
  updateMoodTimestamp,
  deleteMood,
  getAllMoods,
  getMoodCount,
  getMoodsWithinRange,
  getMoodsPaginated,
  getMoodsByMonth,
  hasMoodBeenLoggedToday,
  updateEmotionCategoryInMoods,
  getEmotionNamesFromMoods,
  getContextTagsFromMoods,
  clearMoodData,
  seedMoods,
  type PaginationOptions,
  type PaginatedResult,
} from "@db/db";
import { getMoodHistorySummary, getLatestMood } from "@db/moods/repository";
import type { MoodDateRange, MoodRangePreset } from "@db/moods/range";
export {
  createMoodEntryWorkflow,
  type MoodEntryWorkflowRepository,
  type MoodEntryWorkflowStoreAdapter,
} from "./moodEntryWorkflow";

export type { PaginationOptions, PaginatedResult };
export type { MoodHistoryFilters } from "@db/moods/repository";
export type { MoodDateRange, MoodRangePreset };

export interface MoodServiceInterface {
  // CRUD operations
  create: (entry: MoodEntryInput) => Promise<MoodEntry>;
  update: (id: number, updates: Partial<MoodEntryInput>) => Promise<MoodEntry | undefined>;
  delete: (id: number) => Promise<void>;

  // Queries
  getAll: () => Promise<MoodEntry[]>;
  getHistorySummary: () => ReturnType<typeof getMoodHistorySummary>;
  getPaginated: (options: PaginationOptions) => Promise<PaginatedResult<MoodEntry>>;
  getInRange: (range?: MoodDateRange) => Promise<MoodEntry[]>;
  getByMonth: (year: number, month: number) => Promise<Map<number, MoodEntry[]>>;
  getYesterday: () => Promise<MoodEntry | null>;
  getLastEntry: () => Promise<MoodEntry | null>;
  getCount: () => Promise<number>;
  hasLoggedToday: () => Promise<boolean>;
  clearAll: () => Promise<void>;
  seedSampleData: () => Promise<number>;

  // Note & timestamp updates
  updateNote: (id: number, note: string) => Promise<MoodEntry | undefined>;
  updateTimestamp: (
    id: number,
    timestamp: number,
    utcOffsetMinutes?: number | null,
  ) => Promise<MoodEntry | undefined>;

  // Emotion management in moods
  updateEmotionCategory: (
    emotionName: string,
    category: Emotion["category"]
  ) => Promise<{ updated: number }>;
  getEmotionNames: () => Promise<string[]>;
  getContextTags: () => Promise<string[]>;
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
  getHistorySummary: () => getMoodHistorySummary(),
  async create(entry: MoodEntryInput): Promise<MoodEntry> {
    return insertMoodEntry(entry);
  },

  async update(
    id: number,
    updates: Partial<MoodEntryInput>
  ): Promise<MoodEntry | undefined> {
    return updateMoodEntry(id, updates);
  },

  async delete(id: number): Promise<void> {
    await deleteMood(id);
  },

  async getAll(): Promise<MoodEntry[]> {
    return getAllMoods();
  },

  async getPaginated(options: PaginationOptions): Promise<PaginatedResult<MoodEntry>> {
    return getMoodsPaginated(options);
  },

  async getInRange(range?: MoodDateRange): Promise<MoodEntry[]> {
    return getMoodsWithinRange(range);
  },

  async getByMonth(year: number, month: number): Promise<Map<number, MoodEntry[]>> {
    return getMoodsByMonth(year, month);
  },

  async getYesterday(): Promise<MoodEntry | null> {
    const moods = await getMoodsWithinRange({
      startDate: getStartOfYesterday(),
      endDate: getEndOfYesterday(),
    });
    return moods.length > 0 ? moods[0] : null;
  },

  async getLastEntry(): Promise<MoodEntry | null> {
    return getLatestMood();
  },

  async getCount(): Promise<number> {
    return getMoodCount();
  },

  async hasLoggedToday(): Promise<boolean> {
    return hasMoodBeenLoggedToday();
  },

  async clearAll(): Promise<void> {
    await clearMoodData();
  },

  async seedSampleData(): Promise<number> {
    return seedMoods();
  },

  async updateNote(id: number, note: string): Promise<MoodEntry | undefined> {
    return updateMoodNote(id, note);
  },

  async updateTimestamp(
    id: number,
    timestamp: number,
    utcOffsetMinutes?: number | null,
  ): Promise<MoodEntry | undefined> {
    return updateMoodTimestamp(id, timestamp, utcOffsetMinutes);
  },

  async updateEmotionCategory(
    emotionName: string,
    category: Emotion["category"]
  ): Promise<{ updated: number }> {
    return updateEmotionCategoryInMoods(emotionName, category);
  },

  async getEmotionNames(): Promise<string[]> {
    return getEmotionNamesFromMoods();
  },

  async getContextTags(): Promise<string[]> {
    return getContextTagsFromMoods();
  },
};

export default moodService;
