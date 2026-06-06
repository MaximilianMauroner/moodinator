import { useState, useEffect, useCallback, useMemo } from "react";
import { isAfter, isBefore, startOfDay } from "date-fns";
import { useFocusEffect } from "expo-router";
import type { MoodEntry, MoodScaleSnapshot } from "@db/types";
import type { TimePeriod } from "../components/TimePeriodSelector";
import type { Pattern } from "../utils/patternDetection";
import {
  buildMoodInsights,
  getNextPeriodDate,
  getPreviousPeriodDate,
} from "../utils/moodInsights";
import type { PeriodStats } from "../utils/periodStats";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getMoodHex } from "@/lib/moodPresentation";
import { useMoodsStore } from "@/shared/state/moodsStore";

export type { PeriodStats };

export interface InsightsData {
  // Data state
  allMoods: MoodEntry[];
  periodMoods: MoodEntry[];
  loading: boolean;

  // Period navigation
  period: TimePeriod;
  currentDate: Date;
  setPeriod: (period: TimePeriod) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToToday: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;

  // Stats
  stats: PeriodStats;
  patterns: Pattern[];
  streak: { current: number; longest: number };

  // Helpers
  getMoodLabel: (value: number, sourceScale?: MoodScaleSnapshot) => string;
  getMoodColor: (value: number, sourceScale?: MoodScaleSnapshot) => string;

  // Refresh
  refresh: () => Promise<void>;
}

export function useInsightsData(): InsightsData {
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const allMoods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const isStale = useMoodsStore((state) => state.isStale);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const loading =
    status === "loading" ||
    (status === "refreshing" && allMoods.length === 0) ||
    (allMoods.length === 0 && isStale);

  const loadMoods = useCallback(async () => {
    try {
      await ensureFresh();
    } catch (error) {
      console.error("Failed to load moods:", error);
    }
  }, [ensureFresh]);

  useEffect(() => {
    void loadMoods();
  }, [loadMoods]);

  useFocusEffect(
    useCallback(() => {
      void ensureFresh();
    }, [ensureFresh])
  );

  const insights = useMemo(
    () => buildMoodInsights(allMoods, period, currentDate),
    [allMoods, period, currentDate]
  );
  const { periodMoods, stats, patterns, streak } = insights;

  // Navigation
  const goToPrevious = useCallback(() => {
    if (period !== "all") {
      setCurrentDate((d) => getPreviousPeriodDate(period, d));
    }
  }, [period]);

  const goToNext = useCallback(() => {
    if (period !== "all") {
      setCurrentDate((d) => getNextPeriodDate(period, d));
    }
  }, [period]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Can navigate?
  const canGoNext = useMemo(() => {
    if (period === "all") return false;
    const nextDate = getNextPeriodDate(period, currentDate);
    return !isAfter(startOfDay(nextDate), startOfDay(new Date()));
  }, [period, currentDate]);

  const canGoPrevious = useMemo(() => {
    if (period === "all") return false;
    if (allMoods.length === 0) return false;

    // Can go back as long as there's data
    const oldestMood = allMoods[allMoods.length - 1];
    const oldestDate = new Date(oldestMood.timestamp);
    const prevDate = getPreviousPeriodDate(period, currentDate);

    return !isBefore(prevDate, startOfDay(oldestDate));
  }, [period, currentDate, allMoods]);

  // Helpers
  const getMoodLabel = useCallback((value: number, sourceScale?: MoodScaleSnapshot) => {
    return getMoodRatingLabel(value, sourceScale);
  }, []);

  const getMoodColor = useCallback(
    (value: number, sourceScale?: MoodScaleSnapshot) =>
      getMoodHex(value, false, sourceScale),
    []
  );

  return {
    allMoods,
    periodMoods,
    loading,
    period,
    currentDate,
    setPeriod,
    goToPrevious,
    goToNext,
    goToToday,
    canGoNext,
    canGoPrevious,
    stats,
    patterns,
    streak,
    getMoodLabel,
    getMoodColor,
    refresh: refreshMoods,
  };
}
