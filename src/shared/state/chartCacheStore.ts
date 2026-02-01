/**
 * Chart Cache Store
 * Caches processed chart data to avoid recomputation.
 */

import { create } from "zustand";
import type { DailyDataPoint, WeeklyDataPoint } from "@/components/charts/ChartComponents";

export interface ChartCacheData {
  // Daily chart cache
  dailyLabels: string[];
  dailyAggregates: DailyDataPoint[];
  dailyCachedAt: number | null;

  // Weekly chart cache
  weeklyLabels: string[];
  weeklyAggregates: WeeklyDataPoint[];
  weeklyCachedAt: number | null;

  // Cached mood count (to detect staleness)
  cachedMoodCount: number;
}

export type ChartCacheStore = ChartCacheData & {
  // Setters
  setDailyCache: (labels: string[], aggregates: DailyDataPoint[], moodCount: number) => void;
  setWeeklyCache: (labels: string[], aggregates: WeeklyDataPoint[], moodCount: number) => void;

  // Cache validity checks
  isDailyCacheValid: (moodCount: number, maxAgeMs?: number) => boolean;
  isWeeklyCacheValid: (moodCount: number, maxAgeMs?: number) => boolean;

  // Clear cache
  clearCache: () => void;
  clearDailyCache: () => void;
  clearWeeklyCache: () => void;
};

const DEFAULT_MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export const useChartCacheStore = create<ChartCacheStore>((set, get) => ({
  // Daily cache
  dailyLabels: [],
  dailyAggregates: [],
  dailyCachedAt: null,

  // Weekly cache
  weeklyLabels: [],
  weeklyAggregates: [],
  weeklyCachedAt: null,

  // Mood count tracker
  cachedMoodCount: 0,

  setDailyCache: (labels, aggregates, moodCount) =>
    set({
      dailyLabels: labels,
      dailyAggregates: aggregates,
      dailyCachedAt: Date.now(),
      cachedMoodCount: moodCount,
    }),

  setWeeklyCache: (labels, aggregates, moodCount) =>
    set({
      weeklyLabels: labels,
      weeklyAggregates: aggregates,
      weeklyCachedAt: Date.now(),
      cachedMoodCount: moodCount,
    }),

  isDailyCacheValid: (moodCount, maxAgeMs = DEFAULT_MAX_CACHE_AGE_MS) => {
    const state = get();
    if (!state.dailyCachedAt) return false;
    if (state.cachedMoodCount !== moodCount) return false;
    return Date.now() - state.dailyCachedAt < maxAgeMs;
  },

  isWeeklyCacheValid: (moodCount, maxAgeMs = DEFAULT_MAX_CACHE_AGE_MS) => {
    const state = get();
    if (!state.weeklyCachedAt) return false;
    if (state.cachedMoodCount !== moodCount) return false;
    return Date.now() - state.weeklyCachedAt < maxAgeMs;
  },

  clearCache: () =>
    set({
      dailyLabels: [],
      dailyAggregates: [],
      dailyCachedAt: null,
      weeklyLabels: [],
      weeklyAggregates: [],
      weeklyCachedAt: null,
      cachedMoodCount: 0,
    }),

  clearDailyCache: () =>
    set({
      dailyLabels: [],
      dailyAggregates: [],
      dailyCachedAt: null,
    }),

  clearWeeklyCache: () =>
    set({
      weeklyLabels: [],
      weeklyAggregates: [],
      weeklyCachedAt: null,
    }),
}));

export default useChartCacheStore;
