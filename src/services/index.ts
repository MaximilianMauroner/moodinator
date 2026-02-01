/**
 * Service layer exports
 * Provides a clean API for all data operations
 */

export { moodService, type MoodServiceInterface } from "./moodService";
export { emotionService, type EmotionServiceInterface } from "./emotionService";
export {
  analyticsService,
  type AnalyticsServiceInterface,
  type MoodStats,
  type DailyChartData,
  type WeeklyChartData,
} from "./analyticsService";
