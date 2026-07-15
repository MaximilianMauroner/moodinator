export { createMoodTable } from "./moods/schema";
export type { MoodDateRange, MoodRangePreset } from "./moods/range";
export {
  deleteMood,
  getAllMoods,
  getMoodCount,
  getMoodsWithinRange,
  getMoodsInRange,
  getMoodsByMonth,
  getMoodsPaginated,
  hasMoodBeenLoggedToday,
  insertMood,
  insertMoodEntry,
  updateMoodEntry,
  updateEmotionCategoryInMoods,
  getContextTagsFromMoods,
  getEmotionsFromMoods,
  getEmotionNamesFromMoods,
  updateMoodNote,
  updateMoodTimestamp,
  type PaginationOptions,
  type PaginatedResult,
} from "./moods/repository";
export {
  exportMoods,
  importMoods,
  importOldBackup,
  previewImportMoods,
  type ImportPreviewResult,
  type ImportResult,
} from "./moods/importExport";
export { clearMoodData, clearMoods, seedMoods, seedMoodsFromFile } from "./moods/seed";
export { backfillMoodScaleJson, migrateEmotionsToCategories } from "./moods/migrations";
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
