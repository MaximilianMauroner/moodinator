/**
 * Emotion Service
 * Abstracts database operations for emotions.
 * Provides a clean API for managing emotions separately from moods.
 */

import type { Emotion } from "@db/types";
import {
  getAllEmotions,
  addEmotion,
  updateEmotion,
  deleteEmotion,
  upsertEmotionCategory,
  ensureDefaultEmotions,
  migrateEmotionsToTable,
  hasEmotionTableMigrated,
  countMoodEntriesWithEmotionName,
  renameEmotionInMoodEntries,
  recategorizeEmotionInMoodEntries,
} from "@db/moods/emotions";
import { migrateEmotionsToCategories } from "@db/moods/migrations";
import { getEmotionNamesFromMoods } from "@db/moods/repository";

export interface HistoricalUpdatePreview {
  affectedMoodEntryCount: number;
}

export interface EmotionServiceInterface {
  // CRUD operations
  getAll: () => Promise<Emotion[]>;
  add: (emotion: Emotion) => Promise<void>;
  update: (oldName: string, newEmotion: Emotion) => Promise<void>;
  delete: (name: string) => Promise<void>;

  // Category management
  upsertCategory: (name: string, category: Emotion["category"]) => Promise<void>;

  // Historical updates
  previewRenameHistoricalUpdate: (
    oldName: string,
    newName: string
  ) => Promise<HistoricalUpdatePreview>;
  applyRenameHistoricalUpdate: (oldName: string, newName: string) => Promise<void>;
  previewCategoryHistoricalUpdate: (
    name: string,
    category: Emotion["category"]
  ) => Promise<HistoricalUpdatePreview>;
  applyCategoryHistoricalUpdate: (
    name: string,
    category: Emotion["category"]
  ) => Promise<void>;
  getImportableEmotionNames: () => Promise<string[]>;
  applyImportedEmotionAdditions: (names: string[]) => Promise<void>;

  // Initialization and migration
  ensureDefaults: () => Promise<void>;
  migrateToTable: () => Promise<{ migrated: number }>;
  migrateToCategories: () => Promise<{ migrated: number; skipped: number }>;
  hasMigrated: () => Promise<boolean>;
}

export const emotionService: EmotionServiceInterface = {
  /**
   * Get all emotions from the database
   */
  async getAll(): Promise<Emotion[]> {
    return getAllEmotions();
  },

  /**
   * Add a new emotion
   */
  async add(emotion: Emotion): Promise<void> {
    return addEmotion(emotion);
  },

  /**
   * Update an existing emotion
   */
  async update(oldName: string, newEmotion: Emotion): Promise<void> {
    return updateEmotion(oldName, newEmotion);
  },

  /**
   * Delete an emotion
   */
  async delete(name: string): Promise<void> {
    return deleteEmotion(name);
  },

  /**
   * Upsert emotion category (create or update)
   */
  async upsertCategory(name: string, category: Emotion["category"]): Promise<void> {
    return upsertEmotionCategory(name, category);
  },

  async previewRenameHistoricalUpdate(
    oldName: string,
    _newName: string
  ): Promise<HistoricalUpdatePreview> {
    return {
      affectedMoodEntryCount: await countMoodEntriesWithEmotionName(oldName),
    };
  },

  async applyRenameHistoricalUpdate(oldName: string, newName: string): Promise<void> {
    const emotions = await getAllEmotions();
    const existing = emotions.find(
      (emotion) => emotion.name.trim().toLowerCase() === oldName.trim().toLowerCase()
    );

    if (!existing) {
      return;
    }

    await updateEmotion(oldName, {
      name: newName,
      category: existing.category,
    });
    await renameEmotionInMoodEntries(oldName, newName);
  },

  async previewCategoryHistoricalUpdate(
    name: string,
    _category: Emotion["category"]
  ): Promise<HistoricalUpdatePreview> {
    return {
      affectedMoodEntryCount: await countMoodEntriesWithEmotionName(name),
    };
  },

  async applyCategoryHistoricalUpdate(
    name: string,
    category: Emotion["category"]
  ): Promise<void> {
    await recategorizeEmotionInMoodEntries(name, category);
  },

  async getImportableEmotionNames(): Promise<string[]> {
    return getEmotionNamesFromMoods();
  },

  async applyImportedEmotionAdditions(names: string[]): Promise<void> {
    const existing = new Set(
      (await getAllEmotions()).map((emotion) => emotion.name.trim().toLowerCase())
    );

    for (const rawName of names) {
      const trimmedName = rawName.trim();
      const normalizedName = trimmedName.toLowerCase();

      if (!trimmedName || existing.has(normalizedName)) {
        continue;
      }

      await addEmotion({
        name: trimmedName,
        category: "neutral",
      });
      existing.add(normalizedName);
    }
  },

  /**
   * Ensure default emotions exist in the database
   */
  async ensureDefaults(): Promise<void> {
    return ensureDefaultEmotions();
  },

  /**
   * Migrate emotions from JSON columns to separate table
   */
  async migrateToTable(): Promise<{ migrated: number }> {
    return migrateEmotionsToTable();
  },

  /**
   * Migrate old string-only emotions to include categories
   */
  async migrateToCategories(): Promise<{ migrated: number; skipped: number }> {
    return migrateEmotionsToCategories();
  },

  /**
   * Check if emotion table migration has been completed
   */
  async hasMigrated(): Promise<boolean> {
    return hasEmotionTableMigrated();
  },
};

export default emotionService;
