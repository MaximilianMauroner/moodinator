/**
 * Analytics Service
 * Processes mood data for charts and statistics.
 * Provides computed analytics and aggregated data.
 */

import type { MoodEntry } from "@db/types";
import {
  processMoodDataForDailyChart,
  processWeeklyMoodData,
  type DailyDataPoint,
  type WeeklyDataPoint,
} from "@/components/charts/ChartComponents";
import { moodService } from "./moodService";

export interface MoodStats {
  totalEntries: number;
  averageMood: number;
  moodDistribution: Record<number, number>;
  mostCommonMood: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  streak: number;
}

export interface DailyChartData {
  labels: string[];
  dailyAggregates: DailyDataPoint[];
}

export interface WeeklyChartData {
  labels: string[];
  weeklyAggregates: WeeklyDataPoint[];
}

export interface AnalyticsServiceInterface {
  // Chart data processing
  getDailyChartData: (moods: MoodEntry[], numDays?: number) => DailyChartData;
  getWeeklyChartData: (moods: MoodEntry[], maxWeeks?: number) => WeeklyChartData;

  // Statistics
  calculateStats: (moods: MoodEntry[]) => MoodStats;

  // Data fetching + processing combined
  fetchAndProcessDaily: (numDays?: number) => Promise<DailyChartData>;
  fetchAndProcessWeekly: (maxWeeks?: number) => Promise<WeeklyChartData>;
}

/**
 * Get start of today in ms
 */
function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get start of current week (Monday)
 */
function getStartOfWeek(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get start of current month
 */
function getStartOfMonth(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Calculate streak of consecutive days with entries
 */
function calculateStreak(moods: MoodEntry[]): number {
  if (moods.length === 0) return 0;

  const sortedMoods = [...moods].sort((a, b) => b.timestamp - a.timestamp);
  const today = getStartOfToday();
  let streak = 0;
  let currentDate = today;

  // Group moods by date
  const moodsByDate = new Map<string, MoodEntry[]>();
  for (const mood of sortedMoods) {
    const date = new Date(mood.timestamp);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString().split("T")[0];
    if (!moodsByDate.has(dateKey)) {
      moodsByDate.set(dateKey, []);
    }
    moodsByDate.get(dateKey)!.push(mood);
  }

  // Check consecutive days
  while (true) {
    const dateKey = currentDate.toISOString().split("T")[0];
    if (moodsByDate.has(dateKey)) {
      streak++;
      // Move to previous day
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

export const analyticsService: AnalyticsServiceInterface = {
  /**
   * Process mood data for daily chart
   */
  getDailyChartData(moods: MoodEntry[], numDays: number = 30): DailyChartData {
    return processMoodDataForDailyChart(moods, numDays);
  },

  /**
   * Process mood data for weekly chart
   */
  getWeeklyChartData(moods: MoodEntry[], maxWeeks: number = 52): WeeklyChartData {
    return processWeeklyMoodData(moods, maxWeeks);
  },

  /**
   * Calculate mood statistics
   */
  calculateStats(moods: MoodEntry[]): MoodStats {
    if (moods.length === 0) {
      return {
        totalEntries: 0,
        averageMood: 0,
        moodDistribution: {},
        mostCommonMood: 5,
        entriesThisWeek: 0,
        entriesThisMonth: 0,
        streak: 0,
      };
    }

    // Calculate average
    const totalMood = moods.reduce((sum, m) => sum + m.mood, 0);
    const averageMood = totalMood / moods.length;

    // Calculate distribution
    const moodDistribution: Record<number, number> = {};
    for (const mood of moods) {
      moodDistribution[mood.mood] = (moodDistribution[mood.mood] || 0) + 1;
    }

    // Find most common mood
    let mostCommonMood = 5;
    let maxCount = 0;
    for (const [mood, count] of Object.entries(moodDistribution)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonMood = parseInt(mood, 10);
      }
    }

    // Calculate entries this week and month
    const weekStart = getStartOfWeek().getTime();
    const monthStart = getStartOfMonth().getTime();
    const entriesThisWeek = moods.filter((m) => m.timestamp >= weekStart).length;
    const entriesThisMonth = moods.filter((m) => m.timestamp >= monthStart).length;

    // Calculate streak
    const streak = calculateStreak(moods);

    return {
      totalEntries: moods.length,
      averageMood: Math.round(averageMood * 10) / 10,
      moodDistribution,
      mostCommonMood,
      entriesThisWeek,
      entriesThisMonth,
      streak,
    };
  },

  /**
   * Fetch moods and process for daily chart
   */
  async fetchAndProcessDaily(numDays: number = 30): Promise<DailyChartData> {
    const moods = await moodService.getAll();
    return this.getDailyChartData(moods, numDays);
  },

  /**
   * Fetch moods and process for weekly chart
   */
  async fetchAndProcessWeekly(maxWeeks: number = 52): Promise<WeeklyChartData> {
    const moods = await moodService.getAll();
    return this.getWeeklyChartData(moods, maxWeeks);
  },
};

export default analyticsService;
