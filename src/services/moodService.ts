/**
 * Mood Service
 * Abstracts database operations for mood entries.
 * Provides a clean API for CRUD operations and queries.
 */

import type { MoodEntry, MoodEntryInput, Emotion } from "@db/types";
import { reconcileRemindersAfterMoodChange } from "./reminderReconciliation";
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
    const created = await insertMoodEntry(entry);
    await reconcileRemindersAfterMoodChange();
    return created;
  },

  async update(
    id: number,
    updates: Partial<MoodEntryInput>
  ): Promise<MoodEntry | undefined> {
    const updated = await updateMoodEntry(id, updates);
    if (updated) await reconcileRemindersAfterMoodChange();
    return updated;
  },

  async delete(id: number): Promise<void> {
    await deleteMood(id);
    await reconcileRemindersAfterMoodChange();
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
    await reconcileRemindersAfterMoodChange();
  },

  async seedSampleData(): Promise<number> {
    try {
      return await seedMoods();
    } finally {
      // Seeding commits in batches, so a rejected later batch can leave changes.
      await reconcileRemindersAfterMoodChange();
    }
  },

  async updateNote(id: number, note: string): Promise<MoodEntry | undefined> {
    const updated = await updateMoodNote(id, note);
    if (updated) await reconcileRemindersAfterMoodChange();
    return updated;
  },

  async updateTimestamp(
    id: number,
    timestamp: number,
    utcOffsetMinutes?: number | null,
  ): Promise<MoodEntry | undefined> {
    const updated = await updateMoodTimestamp(id, timestamp, utcOffsetMinutes);
    if (updated) await reconcileRemindersAfterMoodChange();
    return updated;
  },

  async updateEmotionCategory(
    emotionName: string,
    category: Emotion["category"]
  ): Promise<{ updated: number }> {
    const result = await updateEmotionCategoryInMoods(emotionName, category);
    if (result.updated > 0) await reconcileRemindersAfterMoodChange();
    return result;
  },

  async getEmotionNames(): Promise<string[]> {
    return getEmotionNamesFromMoods();
  },

  async getContextTags(): Promise<string[]> {
    return getContextTagsFromMoods();
  },
};

export default moodService;
