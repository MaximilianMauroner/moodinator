import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { AppState } from "react-native";
import { calculateStreak } from "../utils/patternDetection";
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
import { useThemeColors } from "@/constants/colors";

export type { PeriodStats };

export interface InsightsData {
  // Data state
  allMoods: MoodEntry[];
  periodMoods: MoodEntry[];
  loading: boolean;
  error: string | null;

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
  const { isDark } = useThemeColors();
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [localDay, setLocalDay] = useState(() => startOfDay(new Date()).getTime());
  const updateLocalDay = useCallback(() => {
    setLocalDay(startOfDay(new Date()).getTime());
  }, []);

  useEffect(() => {
    const timer = setTimeout(updateLocalDay, addDays(new Date(localDay), 1).getTime() - Date.now());
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") updateLocalDay();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [localDay, updateLocalDay]);
  const allMoods = useMoodsStore((state) => state.moods);
  const status = useMoodsStore((state) => state.status);
  const error = useMoodsStore((state) => state.error);
  const isStale = useMoodsStore((state) => state.isStale);
  const ensureFresh = useMoodsStore((state) => state.ensureFresh);
  const refreshMoods = useMoodsStore((state) => state.refreshMoods);
  const loading =
    status === "loading" ||
    (status === "refreshing" && allMoods.length === 0) ||
    (allMoods.length === 0 && isStale && status === "idle" && error === null);

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
      updateLocalDay();
      void ensureFresh();
    }, [ensureFresh, updateLocalDay])
  );

  const insights = useMemo(
    () => buildMoodInsights(allMoods, period, currentDate),
    [allMoods, period, currentDate]
  );
  const { periodMoods, stats, patterns } = insights;
  const streak = useMemo(
    () => calculateStreak(allMoods, new Date(localDay)),
    [allMoods, localDay]
  );

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
    const nextStart = period === "week"
      ? startOfWeek(nextDate, { weekStartsOn: 1 })
      : startOfMonth(nextDate);
    return nextStart.getTime() <= localDay;
  }, [period, currentDate, localDay]);

  const canGoPrevious = useMemo(() => {
    if (period === "all") return false;
    if (allMoods.length === 0) return false;

    // Can go back as long as there's data
    const oldestTimestamp = allMoods.reduce((oldest, mood) => Math.min(oldest, mood.timestamp), Infinity);
    const prevDate = getPreviousPeriodDate(period, currentDate);

    const previousEnd = period === "week"
      ? endOfWeek(prevDate, { weekStartsOn: 1 })
      : endOfMonth(prevDate);
    return previousEnd.getTime() >= oldestTimestamp;
  }, [period, currentDate, allMoods]);

  // Helpers
  const getMoodLabel = useCallback((value: number, sourceScale?: MoodScaleSnapshot) => {
    return getMoodRatingLabel(value, sourceScale);
  }, []);

  const getMoodColor = useCallback(
    (value: number, sourceScale?: MoodScaleSnapshot) =>
      getMoodHex(value, isDark, sourceScale),
    [isDark]
  );

  return {
    allMoods,
    periodMoods,
    loading,
    error,
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
