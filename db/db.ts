export { createMoodTable } from "./moods/schema";
export type { MoodDateRange, MoodRangePreset } from "./moods/range";
export {
  deleteMood,
  getAllMoods,
  getMoodCount,
  getMoodsWithinRange,
  getMoodsInRange,
  getMoodsPaginated,
  hasMoodBeenLoggedToday,
  insertMood,
  insertMoodEntry,
  updateMoodEntry,
  updateEmotionCategoryInMoods,
  removeEmotionFromMoods,
  getEmotionNamesFromMoods,
  updateMoodNote,
  updateMoodTimestamp,
  type PaginationOptions,
  type PaginatedResult,
} from "./moods/repository";
export { exportMoods, importMoods, importOldBackup, type ImportResult } from "./moods/importExport";
export { clearMoods, seedMoods, seedMoodsFromFile } from "./moods/seed";
export { migrateEmotionsToCategories } from "./moods/migrations";
export {
  createEmotionsTable,
  createMoodEmotionsTable,
  getAllEmotions,
  addEmotion,
  updateEmotion,
  deleteEmotion,
  upsertEmotionCategory,
  ensureDefaultEmotions,
  migrateEmotionsToTable,
  hasEmotionTableMigrated,
  getEmotionsForMood,
} from "./moods/emotions";

import { createMoodTable } from "./moods/schema";
import { hasEmotionTableMigrated, migrateEmotionsToTable } from "./moods/emotions";

// Initialize database on module load
async function initializeDatabase() {
  await createMoodTable();

  // Run emotion migration if not already done
  const migrated = await hasEmotionTableMigrated();
  if (!migrated) {
    try {
      await migrateEmotionsToTable();
    } catch (error) {
      console.error("Failed to migrate emotions to table:", error);
    }
  }
}

void initializeDatabase();
