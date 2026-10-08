import { useState, useEffect, useCallback, useMemo } from "react";
import { addDays, format, endOfDay, startOfDay } from "date-fns";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { MoodEntry, MoodScaleSnapshot } from "@db/types";
import { moodQueries } from "@/services/moodQueries";
import { useMoodQuery } from "@/hooks/useMoodQuery";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getEntryLocalDayKey, hasKnownDate } from "@/lib/entryTimezone";
import { getMoodHex } from "@/lib/moodPresentation";
import { calculateStreak } from "../utils/streaks";
import {
  analyzeMoods,
  analysisStart,
  type AnalysisRange,
  type MoodAnalysis,
} from "../utils/analysis";
export interface InsightsData {
  analysis: MoodAnalysis;
  analysisRange: AnalysisRange;
  setAnalysisRange: (range: AnalysisRange) => void;
  analysisMoods: MoodEntry[];
  recentMoods: MoodEntry[];
  totalCount: number;
  loading: boolean;
  ready: boolean;
  error: string | null;
  streak: { current: number; longest: number };
  getMoodLabel: (value: number, sourceScale?: MoodScaleSnapshot) => string;
  getMoodColor: (value: number, sourceScale?: MoodScaleSnapshot) => string;
  refresh: () => Promise<void>;
}
// Query candidates by instant, then select the exact recorded local days.
function analysisQueryRange(range: AnalysisRange, today: number) {
  if (range === "all") return undefined;
  const padding = 28 * 60 * 60 * 1000;
  return {
    startDate: analysisStart(range, new Date(today)).getTime() - padding,
    endDate: endOfDay(new Date(today)).getTime() + padding,
  };
}

const EMPTY_ENTRIES: MoodEntry[] = [];
const EMPTY_SUMMARY = { totalCount: 0, oldestTimestamp: null, days: [] };

export function useInsightsData(): InsightsData {
  const { isDark } = useThemeColors();
  const [analysisRange, setAnalysisRange] = useState<AnalysisRange>("30");
  const [localDay, setLocalDay] = useState(() =>
    startOfDay(new Date()).getTime(),
  );
  const updateLocalDay = useCallback(
    () => setLocalDay(startOfDay(new Date()).getTime()),
    [],
  );
  const query = useMemo(
    () => moodQueries.range(analysisQueryRange(analysisRange, localDay)),
    [analysisRange, localDay],
  );
  const entriesResult = useMoodQuery(query);
  const summaryResult = useMoodQuery(moodQueries.summary(undefined));
  const recentResult = useMoodQuery(moodQueries.recent(14));
  const summary = summaryResult.data ?? EMPTY_SUMMARY;
  const recentMoods = recentResult.data?.data ?? EMPTY_ENTRIES;
  const analysisMoods = useMemo(() => {
    const entries = entriesResult.data ?? EMPTY_ENTRIES;
    const firstDay = analysisRange === "all" ? "" : format(analysisStart(analysisRange, new Date(localDay)), "yyyy-MM-dd");
    const lastDay = format(new Date(localDay), "yyyy-MM-dd");
    return entries.filter((entry) => {
      const day = getEntryLocalDayKey(entry);
      return day && (analysisRange === "all" || (day >= firstDay && day <= lastDay));
    });
  }, [entriesResult.data, analysisRange, localDay]);
  useEffect(() => {
    const timer = setTimeout(
      updateLocalDay,
      addDays(new Date(localDay), 1).getTime() - Date.now(),
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") updateLocalDay();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [localDay, updateLocalDay]);
  useFocusEffect(updateLocalDay);
  const refreshSummary = summaryResult.refresh;
  const refreshRecent = recentResult.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([query.refresh(), refreshSummary(), refreshRecent()]);
  }, [query, refreshSummary, refreshRecent]);
  const streak = useMemo(
    () => calculateStreak(summary.days, new Date(localDay)),
    [summary.days, localDay],
  );
  const analysis = useMemo(() => {
    // A row with an unreadable timestamp sits at the epoch, and letting it set
    // the start of "All history" would draw every day since 1970.
    const oldestDay = analysisMoods.reduce(
      (oldest, entry) => {
        if (!hasKnownDate(entry)) {
          return oldest;
        }
        const day = getEntryLocalDayKey(entry);
        if (!day) return oldest;
        return day < oldest ? day : oldest;
      },
      format(new Date(localDay), "yyyy-MM-dd"),
    );
    const start =
      analysisRange === "all"
        ? new Date(`${oldestDay}T00:00:00`)
        : analysisStart(analysisRange, new Date(localDay));
    const lastDay = analysisRange === "all"
      ? analysisMoods.reduce((latest, entry) => {
          const day = getEntryLocalDayKey(entry);
          return day && day > latest ? day : latest;
        }, format(new Date(localDay), "yyyy-MM-dd"))
      : format(new Date(localDay), "yyyy-MM-dd");
    return analyzeMoods(analysisMoods, start, new Date(`${lastDay}T00:00:00`));
  }, [analysisMoods, analysisRange, localDay]);
  const getMoodLabel = useCallback(
    (value: number, sourceScale?: MoodScaleSnapshot) =>
      getMoodRatingLabel(value, sourceScale),
    [],
  );
  const getMoodColor = useCallback(
    (value: number, sourceScale?: MoodScaleSnapshot) =>
      getMoodHex(value, isDark, sourceScale),
    [isDark],
  );
  return {
    recentMoods,
    totalCount: summary.totalCount,
    loading: entriesResult.loading,
    ready: !entriesResult.stale && !summaryResult.stale && !recentResult.stale
      && !entriesResult.loading && !summaryResult.loading && !recentResult.loading,
    error: entriesResult.error ?? summaryResult.error ?? recentResult.error,
    streak,
    getMoodLabel,
    getMoodColor,
    refresh,
    analysis,
    analysisRange,
    setAnalysisRange,
    analysisMoods,
  };
}
