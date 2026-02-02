import { useState, useEffect, useCallback, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  subWeeks,
  addWeeks,
  subDays,
  addDays,
  isAfter,
  isBefore,
  format,
} from "date-fns";
import type { MoodEntry } from "@db/types";
import { getAllMoods } from "@db/db";
import { TimePeriod } from "../components/TimePeriodSelector";
import { detectPatterns, calculateStreak, Pattern } from "../utils/patternDetection";
import { getTrendDirection, TrendDirection } from "../components/TrendIndicator";
import { moodScale } from "@/constants/moodScale";

export interface PeriodStats {
  entryCount: number;
  averageMood: number;
  moodChange: number; // Change from previous period
  trendDirection: TrendDirection;
  bestDay: string | null;
  worstDay: string | null;
  mostCommonMood: number;
  energyAvg: number | null;
}

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
  getMoodLabel: (value: number) => string;
  getMoodColor: (value: number) => string;

  // Refresh
  refresh: () => Promise<void>;
}

function getMoodsInPeriod(
  moods: MoodEntry[],
  period: TimePeriod,
  date: Date
): MoodEntry[] {
  if (period === "all") return moods;

  let start: Date;
  let end: Date;

  if (period === "week") {
    start = startOfWeek(date, { weekStartsOn: 1 });
    end = endOfWeek(date, { weekStartsOn: 1 });
  } else {
    start = startOfDay(date);
    end = endOfDay(date);
  }

  return moods.filter((mood) => {
    const moodDate = new Date(mood.timestamp);
    return moodDate >= start && moodDate <= end;
  });
}

function calculatePeriodStats(
  currentMoods: MoodEntry[],
  previousMoods: MoodEntry[]
): PeriodStats {
  const entryCount = currentMoods.length;

  if (entryCount === 0) {
    return {
      entryCount: 0,
      averageMood: 0,
      moodChange: 0,
      trendDirection: "stable",
      bestDay: null,
      worstDay: null,
      mostCommonMood: 5,
      energyAvg: null,
    };
  }

  // Calculate average mood
  const totalMood = currentMoods.reduce((sum, m) => sum + m.mood, 0);
  const averageMood = totalMood / entryCount;

  // Calculate mood change from previous period
  let moodChange = 0;
  if (previousMoods.length > 0) {
    const prevAvg = previousMoods.reduce((sum, m) => sum + m.mood, 0) / previousMoods.length;
    moodChange = averageMood - prevAvg;
  }

  // Determine trend direction
  const trendDirection = getTrendDirection(moodChange);

  // Find best and worst days
  const moodsByDay: Record<string, { total: number; count: number }> = {};
  currentMoods.forEach((mood) => {
    const dayKey = format(new Date(mood.timestamp), "EEEE");
    if (!moodsByDay[dayKey]) {
      moodsByDay[dayKey] = { total: 0, count: 0 };
    }
    moodsByDay[dayKey].total += mood.mood;
    moodsByDay[dayKey].count++;
  });

  const dayAverages = Object.entries(moodsByDay)
    .map(([day, data]) => ({ day, avg: data.total / data.count }))
    .sort((a, b) => a.avg - b.avg);

  const bestDay = dayAverages.length > 0 ? dayAverages[0].day : null;
  const worstDay = dayAverages.length > 0 ? dayAverages[dayAverages.length - 1].day : null;

  // Calculate most common mood
  const moodCounts: Record<number, number> = {};
  currentMoods.forEach((mood) => {
    moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
  });
  const mostCommonMood = Object.entries(moodCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  // Calculate energy average
  const moodsWithEnergy = currentMoods.filter((m) => m.energy !== undefined && m.energy !== null);
  const energyAvg =
    moodsWithEnergy.length > 0
      ? moodsWithEnergy.reduce((sum, m) => sum + (m.energy || 0), 0) / moodsWithEnergy.length
      : null;

  return {
    entryCount,
    averageMood: Math.round(averageMood * 10) / 10,
    moodChange: Math.round(moodChange * 10) / 10,
    trendDirection,
    bestDay,
    worstDay,
    mostCommonMood: parseInt(mostCommonMood || "5", 10),
    energyAvg: energyAvg !== null ? Math.round(energyAvg * 10) / 10 : null,
  };
}

export function useInsightsData(): InsightsData {
  const [allMoods, setAllMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Load all moods
  const loadMoods = useCallback(async () => {
    try {
      setLoading(true);
      const moods = await getAllMoods();
      setAllMoods(moods);
    } catch (error) {
      console.error("Failed to load moods:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoods();
  }, [loadMoods]);

  // Get moods for current period
  const periodMoods = useMemo(
    () => getMoodsInPeriod(allMoods, period, currentDate),
    [allMoods, period, currentDate]
  );

  // Get moods for previous period (for comparison)
  const previousPeriodMoods = useMemo(() => {
    if (period === "all") return [];

    const prevDate =
      period === "week"
        ? subWeeks(currentDate, 1)
        : subDays(currentDate, 1);

    return getMoodsInPeriod(allMoods, period, prevDate);
  }, [allMoods, period, currentDate]);

  // Calculate stats
  const stats = useMemo(
    () => calculatePeriodStats(periodMoods, previousPeriodMoods),
    [periodMoods, previousPeriodMoods]
  );

  // Detect patterns (only for all data or larger periods)
  const patterns = useMemo(() => {
    if (period === "day") return [];
    const moodsForPatterns = period === "all" ? allMoods : periodMoods;
    return detectPatterns(moodsForPatterns);
  }, [allMoods, periodMoods, period]);

  // Calculate streak
  const streak = useMemo(() => calculateStreak(allMoods), [allMoods]);

  // Navigation
  const goToPrevious = useCallback(() => {
    if (period === "week") {
      setCurrentDate((d) => subWeeks(d, 1));
    } else if (period === "day") {
      setCurrentDate((d) => subDays(d, 1));
    }
  }, [period]);

  const goToNext = useCallback(() => {
    if (period === "week") {
      setCurrentDate((d) => addWeeks(d, 1));
    } else if (period === "day") {
      setCurrentDate((d) => addDays(d, 1));
    }
  }, [period]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Can navigate?
  const canGoNext = useMemo(() => {
    if (period === "all") return false;
    const nextDate =
      period === "week"
        ? addWeeks(currentDate, 1)
        : addDays(currentDate, 1);
    return !isAfter(startOfDay(nextDate), startOfDay(new Date()));
  }, [period, currentDate]);

  const canGoPrevious = useMemo(() => {
    if (period === "all") return false;
    if (allMoods.length === 0) return false;

    // Can go back as long as there's data
    const oldestMood = allMoods[allMoods.length - 1];
    const oldestDate = new Date(oldestMood.timestamp);
    const prevDate =
      period === "week"
        ? subWeeks(currentDate, 1)
        : subDays(currentDate, 1);

    return !isBefore(prevDate, startOfDay(oldestDate));
  }, [period, currentDate, allMoods]);

  // Helpers
  const getMoodLabel = useCallback((value: number) => {
    const mood = moodScale.find((m) => m.value === Math.round(value));
    return mood?.label || "Unknown";
  }, []);

  const getMoodColor = useCallback((value: number) => {
    const mood = moodScale.find((m) => m.value === Math.round(value));
    if (!mood) return "#64748b";

    // Extract color from Tailwind class
    const colorMap: Record<string, string> = {
      "text-sky-500": "#03a9f4",
      "text-cyan-500": "#00bcd4",
      "text-teal-500": "#009688",
      "text-emerald-500": "#10b981",
      "text-green-500": "#22c55e",
      "text-gray-500": "#64748b",
      "text-lime-500": "#84cc16",
      "text-yellow-500": "#eab308",
      "text-amber-500": "#f59e0b",
      "text-orange-600": "#ea580c",
      "text-red-500": "#ef4444",
      "text-red-700": "#b91c1c",
    };

    return colorMap[mood.color] || "#64748b";
  }, []);

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
    refresh: loadMoods,
  };
}
