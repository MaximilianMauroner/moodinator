import { useState, useEffect, useCallback, useMemo } from "react";
import { getMoodsByMonth } from "@db/db";
import type { MoodEntry } from "@db/types";
import { moodScale } from "@/constants/moodScale";

export type CalendarDayData = {
  day: number;
  entries: MoodEntry[];
  averageMood: number | null;
  moodColor: string;
  moodColorDark: string;
  hasMultiple: boolean;
};

export type CalendarMonthData = {
  year: number;
  month: number;
  days: Map<number, CalendarDayData>;
  daysInMonth: number;
  firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
};

export function useCalendarData(initialYear?: number, initialMonth?: number) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());
  const [monthData, setMonthData] = useState<CalendarMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const moodsByDay = await getMoodsByMonth(year, month);

      // Calculate days in month and first day of week
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const firstDayOfWeek = firstDay.getDay();

      // Process each day with moods
      const days = new Map<number, CalendarDayData>();

      for (const [day, entries] of moodsByDay) {
        if (entries.length === 0) continue;

        // Calculate average mood
        const totalMood = entries.reduce((sum, e) => sum + e.mood, 0);
        const averageMood = totalMood / entries.length;

        // Get mood color from the scale
        const moodIndex = Math.round(averageMood);
        const moodInfo = moodScale[Math.min(moodIndex, moodScale.length - 1)];

        days.set(day, {
          day,
          entries,
          averageMood,
          moodColor: moodInfo?.bgHex ?? "#F9F5ED",
          moodColorDark: moodInfo?.bgHexDark ?? "#302A22",
          hasMultiple: entries.length > 1,
        });
      }

      setMonthData({
        year,
        month,
        days,
        daysInMonth,
        firstDayOfWeek,
      });
    } catch (error) {
      console.error("Failed to load calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  const goToPreviousMonth = useCallback(() => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNextMonth = useCallback(() => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }, []);

  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return year === today.getFullYear() && month === today.getMonth();
  }, [year, month]);

  const canGoNext = useMemo(() => {
    const today = new Date();
    return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  }, [year, month]);

  const monthName = useMemo(() => {
    return new Date(year, month).toLocaleDateString("en-US", { month: "long" });
  }, [year, month]);

  return {
    year,
    month,
    monthName,
    monthData,
    loading,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    isCurrentMonth,
    canGoNext,
    refresh: loadMonthData,
  };
}
