import { useCallback, useMemo, useState } from "react";
import { buildForecastDays, type ForecastDay } from "./forecast";
import { useRecentMoodEntries } from "./useRecentMoodEntries";

/** Selection is a date; an open detail always uses the current day's entries. */
export function useHistoryForecast(dayCount: number) {
  const recent = useRecentMoodEntries(dayCount);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const days = useMemo(
    () => buildForecastDays(recent.entries, recent.asOf, dayCount),
    [recent.entries, recent.asOf, dayCount],
  );
  const selectedDay = days.find((day) => day.dayKey === selectedDayKey) ?? null;
  const selectDay = useCallback((day: ForecastDay) => setSelectedDayKey(day.dayKey), []);
  const closeDay = useCallback(() => setSelectedDayKey(null), []);
  return { recent, days, selectedDay, selectDay, closeDay };
}
