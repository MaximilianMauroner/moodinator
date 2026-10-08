import { useState, useCallback, useMemo } from "react";
import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";
import { moodQueries } from "@/services/moodQueries";
import { useMoodQuery } from "@/hooks/useMoodQuery";

export type CalendarDayData = {
  day: number;
  entries: MoodEntry[];
  averageMood: number | null;
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
  const [displayDate, setDisplayDate] = useState(() => (
    new Date(initialYear ?? now.getFullYear(), initialMonth ?? now.getMonth(), 1)
  ));
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const query = useMemo(() => moodQueries.month({ year, month }), [year, month]);
  const result = useMoodQuery(query);
  const monthData = useMemo<CalendarMonthData | null>(() => {
    if (!result.data) return null;
    const days = new Map<number, CalendarDayData>();
    for (const [day, entries] of result.data) {
      if (!entries.length) continue;
      const totalMood = entries.reduce((sum, entry) => sum + getInterpretedMoodRating(entry), 0);
      days.set(day, { day, entries, averageMood: totalMood / entries.length, hasMultiple: entries.length > 1 });
    }
    return {
      year, month, days,
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      firstDayOfWeek: new Date(year, month, 1).getDay(),
    };
  }, [result.data, year, month]);

  const goToPreviousMonth = useCallback(() => {
    setDisplayDate((previousDate) => (
      new Date(previousDate.getFullYear(), previousDate.getMonth() - 1, 1)
    ));
  }, []);

  const goToNextMonth = useCallback(() => {
    setDisplayDate((previousDate) => {
      const today = new Date();
      const maxYear = today.getFullYear();
      const maxMonth = today.getMonth();
      const nextDate = new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, 1);
      const exceedsCurrentMonth =
        nextDate.getFullYear() > maxYear
        || (nextDate.getFullYear() === maxYear && nextDate.getMonth() > maxMonth);

      return exceedsCurrentMonth ? previousDate : nextDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setDisplayDate(new Date(today.getFullYear(), today.getMonth(), 1));
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
    return displayDate.toLocaleDateString("en-US", { month: "long" });
  }, [displayDate]);

  return {
    year,
    month,
    monthName,
    monthData,
    loading: result.loading,
    error: result.error,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    isCurrentMonth,
    canGoNext,
    refresh: result.refresh,
  };
}
