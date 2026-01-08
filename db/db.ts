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
  updateMoodNote,
  updateMoodTimestamp,
} from "./moods/repository";
export { exportMoods, importMoods } from "./moods/importExport";
export { clearMoods, seedMoods, seedMoodsFromFile } from "./moods/seed";

import { createMoodTable } from "./moods/schema";
void createMoodTable();
