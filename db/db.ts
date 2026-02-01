export { createMoodTable } from "./moods/schema";
export type { MoodDateRange, MoodRangePreset } from "./moods/range";
export {
  deleteMood,
  getAllMoods,
  getMoodCount,
  getMoodsWithinRange,
  hasMoodBeenLoggedToday,
  insertMood,
  insertMoodEntry,
  updateMoodEntry,
  updateEmotionCategoryInMoods,
  removeEmotionFromMoods,
  getEmotionNamesFromMoods,
  updateMoodNote,
  updateMoodTimestamp,
} from "./moods/repository";
export { exportMoods, importMoods, importOldBackup } from "./moods/importExport";
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
} from "./moods/emotions";

import { createMoodTable } from "./moods/schema";
void createMoodTable();
