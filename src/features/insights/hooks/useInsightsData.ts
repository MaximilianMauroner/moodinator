import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { addDays, format, endOfDay, startOfDay } from "date-fns";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { MoodEntry, MoodScaleSnapshot } from "@db/types";
import { moodService } from "@/services/moodService";
import { useMoodsStore } from "@/shared/state/moodsStore";
import { useThemeColors } from "@/constants/colors";
import { getMoodRatingLabel } from "@/constants/moodScaleInterpretation";
import { getEntryLocalDayKey } from "@/lib/entryTimezone";
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
  error: string | null;
  streak: { current: number; longest: number };
  getMoodLabel: (value: number, sourceScale?: MoodScaleSnapshot) => string;
  getMoodColor: (value: number, sourceScale?: MoodScaleSnapshot) => string;
  refresh: () => Promise<void>;
}
// Opposing device and recorded offsets can differ by 28 hours. Keep an indexed
// SQL timestamp window, then select exact recorded local days from candidates.
async function queryLocalDays(range: AnalysisRange, today: number) {
  const start =
    range === "all" ? undefined : analysisStart(range, new Date(today));
  const end = endOfDay(new Date(today));
  const padding = 28 * 60 * 60 * 1000;
  const entries = await moodService.getInRange(
    start
      ? {
          startDate: start.getTime() - padding,
          endDate: end.getTime() + padding,
        }
      : undefined,
  );
  const firstDay = start ? format(start, "yyyy-MM-dd") : "";
  const lastDay = format(end, "yyyy-MM-dd");
  return entries.filter((entry) => {
    const day = getEntryLocalDayKey(entry);
    return day >= firstDay && day <= lastDay;
  });
}
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
  const revision = useMoodsStore((state) => state.revision);
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);
  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof moodService.getHistorySummary>>
  >({ totalCount: 0, oldestTimestamp: null, days: [] });
  const [analysisMoods, setAnalysisMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedSelection = useRef<string | null>(null);
  const generation = useRef(0);
  const summaryGeneration = useRef(0);
  const invalidateSummary = useCallback(() => {
    summaryGeneration.current++;
  }, []);
  const invalidateAnalysis = useCallback(() => {
    generation.current++;
  }, []);
  const loadSummary = useCallback(async () => {
    const request = ++summaryGeneration.current;
    try {
      const [value, recent] = await Promise.all([
        moodService.getHistorySummary(),
        moodService.getPaginated({ limit: 14, offset: 0 }),
      ]);
      if (request !== summaryGeneration.current) return;
      setSummary(value);
      setRecentMoods(recent.data);
      setSummaryError(null);
    } catch (reason) {
      if (request === summaryGeneration.current) {
        setSummaryError(
          reason instanceof Error
            ? reason.message
            : "Could not load history summary",
        );
      }
    }
  }, []);
  useEffect(() => {
    void loadSummary();
    return invalidateSummary;
  }, [loadSummary, revision, invalidateSummary]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    const selection = `${analysisRange}:${localDay}`;
    setLoading(true);
    if (loadedSelection.current !== selection) setAnalysisMoods([]);
    try {
      const entries = await queryLocalDays(analysisRange, localDay);
      if (request !== generation.current) return;
      loadedSelection.current = selection;
      setAnalysisMoods(entries);
      setError(null);
    } catch (reason) {
      if (request === generation.current) {
        setError(
          reason instanceof Error ? reason.message : "Could not load insights",
        );
      }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [analysisRange, localDay]);
  useEffect(() => {
    void load();
    return invalidateAnalysis;
  }, [load, revision, invalidateAnalysis]);
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
  const refresh = useCallback(async () => {
    await Promise.all([load(), loadSummary()]);
  }, [load, loadSummary]);
  const streak = useMemo(
    () => calculateStreak(summary.days, new Date(localDay)),
    [summary.days, localDay],
  );
  const analysis = useMemo(() => {
    const oldestDay = analysisMoods.reduce(
      (oldest, entry) => {
        const day = getEntryLocalDayKey(entry);
        return day < oldest ? day : oldest;
      },
      format(new Date(localDay), "yyyy-MM-dd"),
    );
    const start =
      analysisRange === "all"
        ? new Date(`${oldestDay}T00:00:00`)
        : analysisStart(analysisRange, new Date(localDay));
    return analyzeMoods(analysisMoods, start, new Date(localDay));
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
    loading,
    error: error ?? summaryError,
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
