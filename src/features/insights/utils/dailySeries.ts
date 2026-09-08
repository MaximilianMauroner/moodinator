import { addDays, format, startOfDay } from "date-fns";
import { getEntryLocalDayKey } from "@/lib/entryTimezone";
import type { MoodEntry } from "@db/types";
import { getInterpretedMoodRating } from "@/constants/moodScaleInterpretation";

export interface DailyPoint {
  day: string;
  mean: number | null;
  min: number | null;
  max: number | null;
  count: number;
}
export function dailySeries(
  entries: MoodEntry[],
  start: Date,
  end: Date,
): DailyPoint[] {
  const buckets = new Map<string, number[]>();
  for (const entry of entries) {
    const key = getEntryLocalDayKey(entry);
    const values = buckets.get(key) ?? [];
    values.push(getInterpretedMoodRating(entry));
    buckets.set(key, values);
  }
  const result: DailyPoint[] = [];
  for (let date = startOfDay(start); date <= end; date = addDays(date, 1)) {
    const day = format(date, "yyyy-MM-dd");
    const values = buckets.get(day) ?? [];
    result.push({
      day,
      count: values.length,
      mean: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
      min: values.length
        ? values.reduce((a, b) => Math.min(a, b), Infinity)
        : null,
      max: values.length
        ? values.reduce((a, b) => Math.max(a, b), -Infinity)
        : null,
    });
  }
  return result;
}
